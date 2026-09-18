using System;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using ILock.WindowsAgent.Security;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Access
{
    /// <summary>
    /// Production Windows Security Access Provider.
    /// Uses legitimate Windows OS APIs (user32.dll LockWorkStation, keybd_event/mouse_event)
    /// and securely integrates with the local DPAPI credential vault.
    ///
    /// Supports both interactive execution and SYSTEM Windows Service execution targeting Winsta0\Winlogon.
    /// </summary>
    public class WindowsAccessProvider : IWindowsAccessProvider
    {
        private readonly ILogger<WindowsAccessProvider> _logger;
        private readonly SecureCredentialVault _vault;
        private AccessSessionInfo? _currentSession;
        private readonly object _lock = new();

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool LockWorkStation();

        [DllImport("user32.dll")]
        private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        private static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetThreadDesktop(IntPtr hDesktop);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool CloseDesktop(IntPtr hDesktop);

        [DllImport("user32.dll")]
        private static extern uint MapVirtualKey(uint uCode, uint uMapType);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern uint WTSGetActiveConsoleSessionId();

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, int dwProcessId);

        [DllImport("advapi32.dll", SetLastError = true)]
        private static extern bool OpenProcessToken(IntPtr ProcessHandle, uint DesiredAccess, out IntPtr TokenHandle);

        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern bool LookupPrivilegeValue(string? lpSystemName, string lpName, out LUID lpLuid);

        [DllImport("advapi32.dll", SetLastError = true)]
        private static extern bool AdjustTokenPrivileges(
            IntPtr TokenHandle,
            bool DisableAllPrivileges,
            ref TOKEN_PRIVILEGES NewState,
            uint BufferLength,
            IntPtr PreviousState,
            IntPtr ReturnLength);

        [DllImport("advapi32.dll", SetLastError = true)]
        private static extern bool DuplicateTokenEx(
            IntPtr hExistingToken,
            uint dwDesiredAccess,
            IntPtr lpTokenAttributes,
            int ImpersonationLevel,
            int TokenType,
            out IntPtr phNewToken);

        [DllImport("advapi32.dll", SetLastError = true)]
        private static extern bool SetTokenInformation(
            IntPtr TokenHandle,
            int TokenInformationClass,
            ref uint TokenInformation,
            uint TokenInformationLength);

        [DllImport("wtsapi32.dll", SetLastError = true)]
        private static extern bool WTSQueryUserToken(uint SessionId, out IntPtr phToken);

        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern bool CreateProcessAsUser(
            IntPtr hToken,
            string? lpApplicationName,
            string? lpCommandLine,
            IntPtr lpProcessAttributes,
            IntPtr lpThreadAttributes,
            bool bInheritHandles,
            uint dwCreationFlags,
            IntPtr lpEnvironment,
            string? lpCurrentDirectory,
            ref STARTUPINFO lpStartupInfo,
            out PROCESS_INFORMATION lpProcessInformation);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool CloseHandle(IntPtr hObject);

        [StructLayout(LayoutKind.Sequential)]
        private struct LUID
        {
            public uint LowPart;
            public int HighPart;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct TOKEN_PRIVILEGES
        {
            public uint PrivilegeCount;
            public LUID Luid;
            public uint Attributes;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        private struct STARTUPINFO
        {
            public int cb;
            public string? lpReserved;
            public string? lpDesktop;
            public string? lpTitle;
            public int dwX;
            public int dwY;
            public int dwXSize;
            public int dwYSize;
            public int dwXCountChars;
            public int dwYCountChars;
            public int dwFillAttribute;
            public int dwFlags;
            public short wShowWindow;
            public short cbReserved2;
            public IntPtr lpReserved2;
            public IntPtr hStdInput;
            public IntPtr hStdOutput;
            public IntPtr hStdError;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct PROCESS_INFORMATION
        {
            public IntPtr hProcess;
            public IntPtr hThread;
            public int dwProcessId;
            public int dwThreadId;
        }

        private const string SE_DEBUG_NAME = "SeDebugPrivilege";
        private const uint SE_PRIVILEGE_ENABLED = 0x00000002;
        private const uint TOKEN_ADJUST_PRIVILEGES = 0x0020;
        private const uint TOKEN_DUPLICATE = 0x0002;
        private const uint TOKEN_ASSIGN_PRIMARY = 0x0001;
        private const uint TOKEN_QUERY = 0x0008;
        private const uint MAXIMUM_ALLOWED = 0x02000000;
        private const int TokenSessionId = 7;
        private const uint PROCESS_QUERY_INFORMATION = 0x0400;

        private const uint KEYEVENTF_KEYUP = 0x0002;
        private const uint MOUSEEVENTF_MOVE = 0x0001;
        private const byte VK_SPACE = 0x20;
        private const byte VK_BACK = 0x08;
        private const byte VK_RETURN = 0x0D;

        public WindowsAccessProvider(ILogger<WindowsAccessProvider> logger, SecureCredentialVault vault)
        {
            _logger = logger;
            _vault = vault;
            _logger.LogInformation("WindowsAccessProvider initialized with genuine Windows API bindings and DPAPI Vault.");
        }

        public Task<bool> RequestAuthorizedAccessAsync(Guid sessionId, DateTime expiresAtUtc, CancellationToken ct = default)
        {
            lock (_lock)
            {
                _logger.LogInformation(
                    "Production Windows Access: Authorizing Session={SessionId}, Expires={ExpiresAtUtc:u}",
                    sessionId, expiresAtUtc
                );

                _currentSession = new AccessSessionInfo(sessionId, expiresAtUtc, AccessState.Active, "Windows Authorized Session Active");
            }

            return Task.FromResult(true);
        }

        public async Task<bool> RevokeAuthorizedAccessAsync(Guid sessionId, string reason, CancellationToken ct = default)
        {
            _logger.LogWarning("Production Windows Access: Revoking Session={SessionId}. Reason={Reason}", sessionId, reason);

            lock (_lock)
            {
                if (_currentSession?.SessionId == sessionId || sessionId == Guid.Empty)
                {
                    _currentSession = new AccessSessionInfo(sessionId, DateTime.UtcNow, AccessState.Revoked, reason);
                }
            }

            // Immediately invoke Windows OS Workstation Lock
            return await LockAsync(ct);
        }

        public AccessState GetAccessState()
        {
            lock (_lock)
            {
                if (_currentSession == null)
                {
                    return AccessState.Locked;
                }

                if (_currentSession.State == AccessState.Revoked)
                {
                    return AccessState.Revoked;
                }

                if (DateTime.UtcNow >= _currentSession.ExpiresAtUtc)
                {
                    _currentSession = _currentSession with { State = AccessState.Expired };
                    return AccessState.Expired;
                }

                return _currentSession.State;
            }
        }

        public AccessSessionInfo? GetCurrentSession()
        {
            lock (_lock)
            {
                if (_currentSession != null && DateTime.UtcNow >= _currentSession.ExpiresAtUtc && _currentSession.State == AccessState.Active)
                {
                    _currentSession = _currentSession with { State = AccessState.Expired };
                }
                return _currentSession;
            }
        }

        public Task<bool> LockAsync(CancellationToken ct = default)
        {
            _logger.LogInformation("Invoking user32.dll LockWorkStation()...");
            try
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    bool result = LockWorkStation();
                    if (!result)
                    {
                        int error = Marshal.GetLastWin32Error();
                        _logger.LogError("LockWorkStation failed with Win32 Error Code: {Error}", error);
                        return Task.FromResult(false);
                    }
                    _logger.LogInformation("Workstation locked successfully via Win32 API.");
                    return Task.FromResult(true);
                }
                else
                {
                    _logger.LogWarning("LockWorkStation called on non-Windows platform. No-op.");
                    return Task.FromResult(true);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error calling LockWorkStation");
                return Task.FromResult(false);
            }
        }

        public async Task<bool> UnlockAsync(CancellationToken ct = default)
        {
            _logger.LogInformation("Workstation unlock requested via authenticated remote authorization.");

            var pin = _vault.RetrievePin();
            if (string.IsNullOrEmpty(pin))
            {
                _logger.LogWarning("Workstation unlock refused: No PIN configured in local DPAPI vault. Run: ILock.WindowsAgent.exe --set-pin <PIN>");
                return false;
            }

            try
            {
                if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    _logger.LogWarning("Unlock called on non-Windows platform. No-op.");
                    return true;
                }

                _logger.LogInformation("Initiating unlock sequence for console session...");

                // First attempt: Token duplication onto Winsta0\Winlogon (available when running as SYSTEM Windows Service)
                bool launchedOnWinlogon = TryLaunchHelperOnWinlogon(_logger);
                if (!launchedOnWinlogon)
                {
                    _logger.LogInformation("Falling back to active desktop input simulation...");
                    await Task.Run(() => SimulateUnlock(pin), ct);
                }

                lock (_lock)
                {
                    _currentSession = new AccessSessionInfo(
                        Guid.NewGuid(),
                        DateTime.UtcNow.AddMinutes(30),
                        AccessState.Active,
                        "Workstation Unlocked via Remote Phone Biometrics"
                    );
                }

                _logger.LogInformation("Workstation unlock signal executed successfully.");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error executing workstation unlock.");
                return false;
            }
        }

        private static bool EnablePrivilege(string privilegeName, ILogger logger)
        {
            try
            {
                if (OpenProcessToken(Process.GetCurrentProcess().Handle, TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, out IntPtr hToken))
                {
                    try
                    {
                        if (LookupPrivilegeValue(null, privilegeName, out LUID luid))
                        {
                            var tp = new TOKEN_PRIVILEGES
                            {
                                PrivilegeCount = 1,
                                Luid = luid,
                                Attributes = SE_PRIVILEGE_ENABLED
                            };
                            bool ok = AdjustTokenPrivileges(hToken, false, ref tp, 0, IntPtr.Zero, IntPtr.Zero);
                            return ok;
                        }
                    }
                    finally
                    {
                        CloseHandle(hToken);
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to enable privilege {Priv}", privilegeName);
            }
            return false;
        }

        private static bool TryLaunchHelperOnWinlogon(ILogger logger)
        {
            try
            {
                uint activeSessionId = WTSGetActiveConsoleSessionId();
                logger.LogInformation("Attempting secure unlock targeting active console session {SessionId}...", activeSessionId);

                EnablePrivilege(SE_DEBUG_NAME, logger);

                IntPtr hPrimaryToken = IntPtr.Zero;

                // Attempt 1: Duplicate winlogon token in the active session
                var winlogonProc = Process.GetProcessesByName("winlogon")
                    .FirstOrDefault(p => p.SessionId == (int)activeSessionId);

                if (winlogonProc != null)
                {
                    IntPtr hProcess = OpenProcess(PROCESS_QUERY_INFORMATION, false, winlogonProc.Id);
                    if (hProcess != IntPtr.Zero)
                    {
                        try
                        {
                            if (OpenProcessToken(hProcess, TOKEN_DUPLICATE | TOKEN_ASSIGN_PRIMARY | TOKEN_QUERY, out IntPtr hProcessToken))
                            {
                                try
                                {
                                    if (DuplicateTokenEx(hProcessToken, MAXIMUM_ALLOWED, IntPtr.Zero, 2, 1, out IntPtr hDup))
                                    {
                                        logger.LogInformation("Successfully duplicated winlogon primary token for session {SessionId}.", activeSessionId);
                                        hPrimaryToken = hDup;
                                    }
                                    else
                                    {
                                        logger.LogWarning("DuplicateTokenEx on winlogon token failed: {Err}", Marshal.GetLastWin32Error());
                                    }
                                }
                                finally
                                {
                                    CloseHandle(hProcessToken);
                                }
                            }
                            else
                            {
                                logger.LogWarning("OpenProcessToken on winlogon failed: {Err}", Marshal.GetLastWin32Error());
                            }
                        }
                        finally
                        {
                            CloseHandle(hProcess);
                        }
                    }
                    else
                    {
                        logger.LogWarning("OpenProcess on winlogon PID {Pid} failed: {Err}", winlogonProc.Id, Marshal.GetLastWin32Error());
                    }
                }
                else
                {
                    logger.LogWarning("No winlogon process found in session {SessionId}.", activeSessionId);
                }

                // Attempt 2: If winlogon token failed, duplicate own SYSTEM token and assign SessionId
                if (hPrimaryToken == IntPtr.Zero)
                {
                    if (OpenProcessToken(Process.GetCurrentProcess().Handle, TOKEN_DUPLICATE | TOKEN_ASSIGN_PRIMARY | TOKEN_QUERY, out IntPtr hMyToken))
                    {
                        try
                        {
                            if (DuplicateTokenEx(hMyToken, MAXIMUM_ALLOWED, IntPtr.Zero, 2, 1, out IntPtr hDup))
                            {
                                uint sess = activeSessionId;
                                if (SetTokenInformation(hDup, TokenSessionId, ref sess, sizeof(uint)))
                                {
                                    logger.LogInformation("Assigned session {SessionId} to duplicated service token.", activeSessionId);
                                    hPrimaryToken = hDup;
                                }
                                else
                                {
                                    logger.LogWarning("SetTokenInformation TokenSessionId failed: {Err}", Marshal.GetLastWin32Error());
                                    CloseHandle(hDup);
                                }
                            }
                        }
                        finally
                        {
                            CloseHandle(hMyToken);
                        }
                    }
                }

                // Attempt 3: WTSQueryUserToken
                if (hPrimaryToken == IntPtr.Zero)
                {
                    if (WTSQueryUserToken(activeSessionId, out IntPtr hUserToken))
                    {
                        logger.LogInformation("Obtained user token via WTSQueryUserToken for session {SessionId}.", activeSessionId);
                        hPrimaryToken = hUserToken;
                    }
                    else
                    {
                        logger.LogWarning("WTSQueryUserToken failed: {Err}", Marshal.GetLastWin32Error());
                    }
                }

                if (hPrimaryToken == IntPtr.Zero)
                {
                    logger.LogWarning("Unable to acquire an elevated token for session {SessionId}.", activeSessionId);
                    return false;
                }

                try
                {
                    string exePath = Process.GetCurrentProcess().MainModule?.FileName 
                        ?? @"C:\Users\vidar\OneDrive\Desktop\iLock\services\windows-agent\src\bin\Release\net8.0\win-x64\publish\ILock.WindowsAgent.exe";
                    string cmdLine = $"\"{exePath}\" --unlock-helper";

                    var si = new STARTUPINFO();
                    si.cb = Marshal.SizeOf(si);
                    si.lpDesktop = @"Winsta0\Winlogon";

                    var pi = new PROCESS_INFORMATION();

                    bool ok = CreateProcessAsUser(
                        hPrimaryToken,
                        null,
                        cmdLine,
                        IntPtr.Zero,
                        IntPtr.Zero,
                        false,
                        0x08000000, // CREATE_NO_WINDOW
                        IntPtr.Zero,
                        Path.GetDirectoryName(exePath),
                        ref si,
                        out pi
                    );

                    if (!ok)
                    {
                        int err = Marshal.GetLastWin32Error();
                        logger.LogWarning("CreateProcessAsUser on Winsta0\\Winlogon failed: {Err}", err);
                        return false;
                    }

                    logger.LogInformation("Successfully spawned unlock helper on Winsta0\\Winlogon! PID={Pid}", pi.dwProcessId);

                    if (pi.hProcess != IntPtr.Zero)
                    {
                        WaitForSingleObject(pi.hProcess, 6000);
                        CloseHandle(pi.hProcess);
                    }
                    if (pi.hThread != IntPtr.Zero)
                    {
                        CloseHandle(pi.hThread);
                    }
                    return true;
                }
                finally
                {
                    CloseHandle(hPrimaryToken);
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "TryLaunchHelperOnWinlogon caught exception");
                return false;
            }
        }

        /// <summary>
        /// Simulates hardware input to wake the monitor, dismiss the lock screen overlay,
        /// and type the 6-digit PIN into the Windows logon prompt.
        /// Uses a clean dedicated thread attached to the active input desktop (including Winlogon).
        /// </summary>
        public static void SimulateUnlock(string pin, Action<string>? log = null)
        {
            var thread = new Thread(() =>
            {
                IntPtr hDesktop = IntPtr.Zero;
                try
                {
                    log?.Invoke("SimulateUnlock thread started.");

                    // Attach this clean thread to whatever desktop currently receives input (Default or Winlogon)
                    hDesktop = OpenInputDesktop(0, false, 0x01FF);
                    log?.Invoke($"OpenInputDesktop returned: {hDesktop}");
                    if (hDesktop != IntPtr.Zero)
                    {
                        bool set = SetThreadDesktop(hDesktop);
                        log?.Invoke($"SetThreadDesktop result: {set}");
                    }

                    // 1. Wake display / power management
                    log?.Invoke("Waking display with mouse movement...");
                    mouse_event(MOUSEEVENTF_MOVE, 0, 1, 0, UIntPtr.Zero);
                    Thread.Sleep(50);
                    mouse_event(MOUSEEVENTF_MOVE, 0, -1, 0, UIntPtr.Zero);
                    Thread.Sleep(100);

                    // 2. Dismiss lock screen wallpaper overlay (Space key with scan code)
                    log?.Invoke("Dismissing lock screen overlay with Space key...");
                    byte spaceScan = (byte)MapVirtualKey(VK_SPACE, 0);
                    keybd_event(VK_SPACE, spaceScan, 0, UIntPtr.Zero);
                    Thread.Sleep(50);
                    keybd_event(VK_SPACE, spaceScan, KEYEVENTF_KEYUP, UIntPtr.Zero);

                    // Wait 900ms for Windows 11 lock screen animation to slide up and focus the PIN box
                    log?.Invoke("Waiting for lock screen animation to slide up...");
                    Thread.Sleep(900);

                    // 3. Clear any partial or accidental characters in PIN prompt
                    log?.Invoke("Clearing existing input field with backspaces...");
                    byte backScan = (byte)MapVirtualKey(VK_BACK, 0);
                    for (int i = 0; i < 8; i++)
                    {
                        keybd_event(VK_BACK, backScan, 0, UIntPtr.Zero);
                        Thread.Sleep(25);
                        keybd_event(VK_BACK, backScan, KEYEVENTF_KEYUP, UIntPtr.Zero);
                        Thread.Sleep(25);
                    }
                    Thread.Sleep(100);

                    // 4. Type each digit of the PIN with both VK and hardware scan code
                    log?.Invoke($"Typing {pin.Length} PIN digits...");
                    foreach (char c in pin)
                    {
                        byte vk = (byte)c;
                        byte scan = (byte)MapVirtualKey(vk, 0);
                        keybd_event(vk, scan, 0, UIntPtr.Zero);
                        Thread.Sleep(45);
                        keybd_event(vk, scan, KEYEVENTF_KEYUP, UIntPtr.Zero);
                        Thread.Sleep(45);
                    }

                    // 5. Press Enter to submit
                    log?.Invoke("Submitting PIN with Enter key...");
                    Thread.Sleep(150);
                    byte enterScan = (byte)MapVirtualKey(VK_RETURN, 0);
                    keybd_event(VK_RETURN, enterScan, 0, UIntPtr.Zero);
                    Thread.Sleep(50);
                    keybd_event(VK_RETURN, enterScan, KEYEVENTF_KEYUP, UIntPtr.Zero);
                    Thread.Sleep(200);

                    log?.Invoke("SimulateUnlock completed successfully.");
                }
                catch (Exception ex)
                {
                    log?.Invoke($"SimulateUnlock exception: {ex.Message}");
                }
                finally
                {
                    if (hDesktop != IntPtr.Zero)
                    {
                        CloseDesktop(hDesktop);
                    }
                }
            });
            thread.SetApartmentState(ApartmentState.STA);
            thread.Start();
            thread.Join();
        }

        public Task<(bool isLocked, string? activeUser)> GetStatusAsync(CancellationToken ct = default)
        {
            bool isLocked = GetAccessState() != AccessState.Active;
            string? activeUser = Environment.UserName;
            return Task.FromResult<(bool isLocked, string? activeUser)>((isLocked, activeUser));
        }
    }
}
