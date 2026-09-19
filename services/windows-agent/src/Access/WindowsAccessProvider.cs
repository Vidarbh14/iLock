using System;
using System.Diagnostics;
using System.IO;
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
    /// Supports both interactive execution and SYSTEM Windows Service execution targeting Winsta0\Winlogon / Winsta0\Default.
    /// Listens for real-time hardware lock/unlock events via SessionNotificationListener.
    /// </summary>
    public class WindowsAccessProvider : IWindowsAccessProvider, IDisposable
    {
        private readonly ILogger<WindowsAccessProvider> _logger;
        private readonly SecureCredentialVault _vault;
        private readonly SessionNotificationListener _sessionListener;
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

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool GetUserObjectInformation(IntPtr hObj, int nIndex, [Out] byte[] pvInfo, int nLength, out int lpnLengthNeeded);

        private const int UOI_NAME = 2;

        [DllImport("gdi32.dll")]
        private static extern bool BitBlt(IntPtr hdcDest, int nXDest, int nYDest, int nWidth, int nHeight, IntPtr hdcSrc, int nXSrc, int nYSrc, uint dwRop);

        [DllImport("user32.dll")]
        private static extern IntPtr GetDC(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

        [DllImport("user32.dll")]
        private static extern int GetSystemMetrics(int nIndex);

        private const int SM_CXSCREEN = 0;
        private const int SM_CYSCREEN = 1;
        private const uint SRCCOPY = 0x00CC0020;
        private const uint CAPTUREBLT = 0x40000000;

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
        private static extern bool GetExitCodeProcess(IntPtr hProcess, out uint lpExitCode);

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
        private const byte VK_SHIFT = 0x10;

        public WindowsAccessProvider(ILogger<WindowsAccessProvider> logger, SecureCredentialVault vault)
        {
            _logger = logger;
            _vault = vault;
            _sessionListener = new SessionNotificationListener(_logger);
            _logger.LogInformation("WindowsAccessProvider initialized with genuine Windows API bindings, DPAPI Vault, and SessionNotificationListener.");
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
            _logger.LogInformation("Workstation lock requested.");
            try
            {
                if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    _logger.LogWarning("LockWorkStation called on non-Windows platform. No-op.");
                    return Task.FromResult(true);
                }

                bool lockSuccess = false;

                if (Process.GetCurrentProcess().SessionId != 0)
                {
                    // Running in interactive user session directly
                    lockSuccess = ExecuteNativeLock();
                }
                else
                {
                    // Running as Windows Service in Session 0:
                    // Must execute LockWorkStation inside active console session (Session 1)
                    bool launched = TryLaunchInSession("--lock-helper", @"Winsta0\Default", _logger, 5000, out int exitCode);
                    lockSuccess = launched && exitCode == 0;

                    if (!lockSuccess)
                    {
                        // Fallback retry targeting Winsta0\Winlogon
                        _logger.LogWarning("Retrying lock helper on Winsta0\\Winlogon...");
                        TryLaunchInSession("--lock-helper", @"Winsta0\Winlogon", _logger, 5000, out exitCode);
                        lockSuccess = exitCode == 0;
                    }
                }

                try
                {
                    string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "iLock");
                    if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                    File.WriteAllText(Path.Combine(dir, "lock_state.txt"), "LOCKED");
                }
                catch { }

                _logger.LogInformation("Workstation lock completed (success={Success}).", lockSuccess);
                return Task.FromResult(lockSuccess);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error calling LockAsync");
                return Task.FromResult(false);
            }
        }

        /// <summary>
        /// Native lock method callable from interactive sessions or --lock-helper
        /// </summary>
        public static bool ExecuteNativeLock()
        {
            bool locked = LockWorkStation();
            if (!locked)
            {
                try
                {
                    var proc = Process.Start(new ProcessStartInfo
                    {
                        FileName = "rundll32.exe",
                        Arguments = "user32.dll,LockWorkStation",
                        CreateNoWindow = true,
                        UseShellExecute = false
                    });
                    proc?.WaitForExit(2000);
                    return true;
                }
                catch { }
            }
            return locked;
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

                bool unlockSuccess = false;

                if (Process.GetCurrentProcess().SessionId == 0)
                {
                    // Running as SYSTEM Windows Service: target Winsta0\Winlogon
                    bool launched = TryLaunchInSession("--unlock-helper", @"Winsta0\Winlogon", _logger, 20000, out int exitCode);
                    unlockSuccess = launched && exitCode == 0;
                }
                else
                {
                    // Interactive mode
                    unlockSuccess = await Task.Run(() => SimulateUnlock(pin, msg => _logger.LogInformation(msg)), ct);
                }

                if (unlockSuccess)
                {
                    lock (_lock)
                    {
                        _currentSession = new AccessSessionInfo(
                            Guid.NewGuid(),
                            DateTime.UtcNow.AddMinutes(30),
                            AccessState.Active,
                            "Workstation Unlocked via Remote Phone Biometrics"
                        );
                    }

                    try
                    {
                        string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "iLock");
                        if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                        File.WriteAllText(Path.Combine(dir, "lock_state.txt"), "UNLOCKED");
                    }
                    catch { }

                    _logger.LogInformation("Workstation unlocked successfully.");
                    return true;
                }
                else
                {
                    _logger.LogWarning("Workstation unlock sequence did not result in unlocked desktop.");
                    return false;
                }
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

        private static bool TryLaunchInSession(
            string argument,
            string desktop,
            ILogger logger,
            int waitTimeoutMs,
            out int exitCode)
        {
            exitCode = -1;
            try
            {
                uint activeSessionId = WTSGetActiveConsoleSessionId();
                logger.LogInformation("Launching helper in console session {SessionId} on desktop {Desktop} (arg='{Arg}')...", activeSessionId, desktop, argument);

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
                                        hPrimaryToken = hDup;
                                    }
                                }
                                finally
                                {
                                    CloseHandle(hProcessToken);
                                }
                            }
                        }
                        finally
                        {
                            CloseHandle(hProcess);
                        }
                    }
                }

                // Attempt 2: Duplicate own SYSTEM token and assign SessionId
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
                                    hPrimaryToken = hDup;
                                }
                                else
                                {
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
                        hPrimaryToken = hUserToken;
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
                    string cmdLine = $"\"{exePath}\" {argument}";

                    var si = new STARTUPINFO();
                    si.cb = Marshal.SizeOf(si);
                    si.lpDesktop = desktop;

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
                        logger.LogWarning("CreateProcessAsUser on {Desktop} failed: {Err}", desktop, err);
                        return false;
                    }

                    logger.LogInformation("Successfully spawned helper PID={Pid} with arg '{Arg}' on {Desktop}", pi.dwProcessId, argument, desktop);

                    if (pi.hProcess != IntPtr.Zero)
                    {
                        WaitForSingleObject(pi.hProcess, (uint)waitTimeoutMs);
                        if (GetExitCodeProcess(pi.hProcess, out uint code))
                        {
                            exitCode = (int)code;
                            logger.LogInformation("Helper PID={Pid} exited with code {Code}", pi.dwProcessId, exitCode);
                        }
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
                logger.LogWarning(ex, "TryLaunchInSession caught exception");
                return false;
            }
        }

        /// <summary>
        /// Simulates hardware input to wake the monitor, dismiss the lock screen overlay,
        /// and type the 6-digit PIN into the Windows logon prompt.
        /// Uses a clean dedicated MTA thread attached to the active input desktop (including Winlogon).
        /// Returns true if the screen was successfully unlocked, false otherwise.
        /// </summary>
        public static bool SimulateUnlock(string pin, Action<string>? log = null)
        {
            bool success = false;
            var thread = new Thread(() =>
            {
                IntPtr hDesktop = IntPtr.Zero;
                try
                {
                    // Attach clean thread to current input desktop immediately before ANY console/UI calls
                    hDesktop = OpenInputDesktop(0, false, 0x01FF);
                    if (hDesktop == IntPtr.Zero)
                    {
                        hDesktop = OpenInputDesktop(0, false, 0x0100);
                    }

                    if (hDesktop != IntPtr.Zero)
                    {
                        bool set = SetThreadDesktop(hDesktop);
                        log?.Invoke($"SetThreadDesktop result: {set}");
                    }
                    else
                    {
                        log?.Invoke("OpenInputDesktop returned Zero handle.");
                    }

                    log?.Invoke("SimulateUnlock execution thread active.");

                    void PerformTypeSequence(string sequencePin, string attemptLabel)
                    {
                        log?.Invoke($"[{attemptLabel}] 1. Waking display with mouse movement and Shift key...");
                        mouse_event(MOUSEEVENTF_MOVE, 0, 2, 0, UIntPtr.Zero);
                        Thread.Sleep(30);
                        mouse_event(MOUSEEVENTF_MOVE, 0, -2, 0, UIntPtr.Zero);
                        Thread.Sleep(50);

                        byte shiftScan = (byte)MapVirtualKey(VK_SHIFT, 0);
                        keybd_event(VK_SHIFT, shiftScan, 0, UIntPtr.Zero);
                        Thread.Sleep(30);
                        keybd_event(VK_SHIFT, shiftScan, KEYEVENTF_KEYUP, UIntPtr.Zero);
                        Thread.Sleep(100);

                        log?.Invoke($"[{attemptLabel}] 2. Dismissing lock screen overlay with Space key...");
                        byte spaceScan = (byte)MapVirtualKey(VK_SPACE, 0);
                        keybd_event(VK_SPACE, spaceScan, 0, UIntPtr.Zero);
                        Thread.Sleep(40);
                        keybd_event(VK_SPACE, spaceScan, KEYEVENTF_KEYUP, UIntPtr.Zero);
                        Thread.Sleep(120);

                        // Second tap ensures overlay slides up even if screen was waking from standby
                        keybd_event(VK_SPACE, spaceScan, 0, UIntPtr.Zero);
                        Thread.Sleep(40);
                        keybd_event(VK_SPACE, spaceScan, KEYEVENTF_KEYUP, UIntPtr.Zero);

                        log?.Invoke($"[{attemptLabel}] 3. Waiting 1100ms for Windows 11 lock screen slide animation to focus PIN box...");
                        Thread.Sleep(1100);

                        // NOTE: In Windows 11, the PIN box is automatically focused when the overlay slides up.
                        // Do NOT simulate mouse clicks, which de-focus the PIN box on Windows 11.

                        log?.Invoke($"[{attemptLabel}] 4. Clearing input field with 8 backspaces...");
                        byte backScan = (byte)MapVirtualKey(VK_BACK, 0);
                        for (int i = 0; i < 8; i++)
                        {
                            keybd_event(VK_BACK, backScan, 0, UIntPtr.Zero);
                            Thread.Sleep(20);
                            keybd_event(VK_BACK, backScan, KEYEVENTF_KEYUP, UIntPtr.Zero);
                            Thread.Sleep(20);
                        }
                        Thread.Sleep(100);

                        log?.Invoke($"[{attemptLabel}] 5. Typing {sequencePin.Length} PIN digits with hardware scan codes...");
                        foreach (char c in sequencePin)
                        {
                            byte vk = (byte)c;
                            byte scan = (byte)MapVirtualKey(vk, 0);
                            keybd_event(vk, scan, 0, UIntPtr.Zero);
                            Thread.Sleep(40);
                            keybd_event(vk, scan, KEYEVENTF_KEYUP, UIntPtr.Zero);
                            Thread.Sleep(40);
                        }

                        log?.Invoke($"[{attemptLabel}] 6. Submitting PIN with Enter key...");
                        Thread.Sleep(100);
                        byte enterScan = (byte)MapVirtualKey(VK_RETURN, 0);
                        keybd_event(VK_RETURN, enterScan, 0, UIntPtr.Zero);
                        Thread.Sleep(40);
                        keybd_event(VK_RETURN, enterScan, KEYEVENTF_KEYUP, UIntPtr.Zero);
                    }

                    // Attempt 1
                    PerformTypeSequence(pin, "Attempt-1");

                    // Responsive polling: Windows Hello switches desktop from Winlogon to Default in ~1.2s to 2.4s
                    bool stillLocked = true;
                    for (int i = 0; i < 16; i++) // Poll every 200ms up to 3.2s
                    {
                        Thread.Sleep(200);
                        stillLocked = CheckIfScreenIsLocked();
                        if (!stillLocked)
                        {
                            log?.Invoke($"Workstation successfully unlocked on Attempt-1 after {(i + 1) * 200}ms!");
                            break;
                        }
                    }

                    if (stillLocked)
                    {
                        log?.Invoke("Workstation still locked after 3200ms. Initiating secondary retry attempt...");
                        PerformTypeSequence(pin, "Attempt-2");
                        for (int i = 0; i < 16; i++)
                        {
                            Thread.Sleep(200);
                            stillLocked = CheckIfScreenIsLocked();
                            if (!stillLocked)
                            {
                                log?.Invoke($"Workstation successfully unlocked on Attempt-2 after {(i + 1) * 200}ms!");
                                break;
                            }
                        }
                    }

                    success = !stillLocked;
                    log?.Invoke($"SimulateUnlock completed. Unlocked={success}");
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

            thread.Start();
            thread.Join();
            return success;
        }

        public static void CaptureScreen(string filePath, Action<string>? log = null)
        {
            try
            {
                int width = GetSystemMetrics(SM_CXSCREEN);
                int height = GetSystemMetrics(SM_CYSCREEN);
                if (width <= 0 || height <= 0)
                {
                    width = 1920;
                    height = 1080;
                }

                using var bmp = new System.Drawing.Bitmap(width, height);
                using (var g = System.Drawing.Graphics.FromImage(bmp))
                {
                    IntPtr hdcDest = g.GetHdc();
                    IntPtr hdcSrc = GetDC(IntPtr.Zero);
                    BitBlt(hdcDest, 0, 0, width, height, hdcSrc, 0, 0, SRCCOPY | CAPTUREBLT);
                    ReleaseDC(IntPtr.Zero, hdcSrc);
                    g.ReleaseHdc(hdcDest);
                }

                string? dir = Path.GetDirectoryName(filePath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                bmp.Save(filePath, System.Drawing.Imaging.ImageFormat.Png);
                log?.Invoke($"Captured screen to {filePath} ({width}x{height})");
            }
            catch (Exception ex)
            {
                log?.Invoke($"CaptureScreen error: {ex.Message}");
            }
        }

        public static string? GetActiveDesktopName()
        {
            IntPtr hDesktop = OpenInputDesktop(0, false, 0x0100);
            if (hDesktop == IntPtr.Zero)
            {
                return null;
            }

            try
            {
                byte[] buffer = new byte[256];
                if (GetUserObjectInformation(hDesktop, UOI_NAME, buffer, buffer.Length, out int lengthNeeded))
                {
                    return System.Text.Encoding.ASCII.GetString(buffer, 0, lengthNeeded).TrimEnd('\0');
                }
                return null;
            }
            finally
            {
                CloseDesktop(hDesktop);
            }
        }

        public static bool CheckIfScreenIsLocked()
        {
            try
            {
                string? desktopName = GetActiveDesktopName();
                if (desktopName == null)
                {
                    // Access Denied or null handle indicates Winsta0\Winlogon secure desktop is active
                    return true;
                }

                if (desktopName.Equals("Winlogon", StringComparison.OrdinalIgnoreCase) ||
                    desktopName.Equals("Screen-saver", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                return false;
            }
            catch
            {
                return false;
            }
        }

        public Task<(bool isLocked, string? activeUser)> GetStatusAsync(CancellationToken ct = default)
        {
            bool isLocked = true;
            try
            {
                string statePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "iLock", "lock_state.txt");
                if (File.Exists(statePath))
                {
                    string state = File.ReadAllText(statePath).Trim();
                    isLocked = state.Equals("LOCKED", StringComparison.OrdinalIgnoreCase);
                }
                else if (Process.GetCurrentProcess().SessionId != 0)
                {
                    isLocked = CheckIfScreenIsLocked() || GetAccessState() != AccessState.Active;
                }
                else
                {
                    isLocked = GetAccessState() != AccessState.Active;
                }
            }
            catch
            {
                isLocked = CheckIfScreenIsLocked() || GetAccessState() != AccessState.Active;
            }

            string? activeUser = Environment.UserName;
            return Task.FromResult<(bool isLocked, string? activeUser)>((isLocked, activeUser));
        }

        public void Dispose()
        {
            _sessionListener?.Dispose();
        }
    }
}
