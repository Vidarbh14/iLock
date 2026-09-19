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

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

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

        [DllImport("wtsapi32.dll", SetLastError = true)]
        private static extern bool WTSQuerySessionInformation(
            IntPtr hServer,
            int sessionId,
            int wtsInfoClass,
            out IntPtr ppBuffer,
            out int pBytesReturned);

        [DllImport("wtsapi32.dll")]
        private static extern void WTSFreeMemory(IntPtr pMemory);

        private const int WTSSessionInfoEx = 25;
        private const int WTS_SESSIONSTATE_LOCK = 0;
        private const int WTS_SESSIONSTATE_UNLOCK = 1;

        [StructLayout(LayoutKind.Sequential)]
        private struct WTSINFOEX
        {
            public int Level;
            public WTSINFOEX_LEVEL1 Data;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct WTSINFOEX_LEVEL1
        {
            public int SessionId;
            public int SessionState;
            public int SessionFlags;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 33)]
            public string WinStationName;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 21)]
            public string UserName;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 18)]
            public string DomainName;
            public long LogonTime;
            public long ConnectTime;
            public long DisconnectTime;
            public long LastInputTime;
            public long CurrentTime;
            public long IncomingBytes;
            public long OutgoingBytes;
            public long IncomingFrames;
            public long OutgoingFrames;
            public long IncomingCompressedBytes;
            public long OutgoingCompressedBytes;
        }

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

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern uint SetThreadExecutionState(uint esFlags);
        private const uint ES_SYSTEM_REQUIRED = 0x00000001;
        private const uint ES_DISPLAY_REQUIRED = 0x00000002;

        private const uint KEYEVENTF_KEYUP = 0x0002;
        private const uint MOUSEEVENTF_MOVE = 0x0001;
        private const byte VK_SPACE = 0x20;
        private const byte VK_BACK = 0x08;
        private const byte VK_RETURN = 0x0D;
        private const byte VK_SHIFT = 0x10;
        private const byte VK_ESCAPE = 0x1B;
        private const byte VK_UP = 0x26;

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

        public static void RestoreDefaultLockScreenPolicy()
        {
            try
            {
                using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Policies\Microsoft\Windows\Personalization", true);
                key?.DeleteValue("NoLockScreen", false);
            }
            catch { }
        }

        /// <summary>
        /// Native lock method callable from interactive sessions or --lock-helper
        /// </summary>
        public static bool ExecuteNativeLock()
        {
            RestoreDefaultLockScreenPolicy();
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
        /// Uses distinct clean threads to guarantee accurate desktop attachment (Default for curtain dismiss, Winlogon for PIN entry).
        /// Returns true if the screen was successfully unlocked, false otherwise.
        /// </summary>
        public static bool SimulateUnlock(string pin, Action<string>? log = null)
        {
            bool success = false;
            try
            {
                string? initialDesktop = GetActiveDesktopName();
                log?.Invoke($"SimulateUnlock starting. Initial active desktop: {initialDesktop}");

                // Phase 1: If on Default desktop (LockApp wallpaper curtain), wake and dismiss
                if (initialDesktop != "Winlogon")
                {
                    log?.Invoke("Phase 1: Waking display hardware and dismissing wallpaper curtain...");
                    var wakeThread = new Thread(() =>
                    {
                        IntPtr hCur = OpenInputDesktop(0, false, 0x01FF);
                        if (hCur == IntPtr.Zero) hCur = OpenInputDesktop(0, false, 0x0100);
                        if (hCur != IntPtr.Zero)
                        {
                            SetThreadDesktop(hCur);
                            CloseDesktop(hCur);
                        }

                        try { SetThreadExecutionState(ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED); } catch { }
                        mouse_event(MOUSEEVENTF_MOVE, 0, 5, 0, UIntPtr.Zero);
                        Thread.Sleep(20);
                        mouse_event(MOUSEEVENTF_MOVE, 0, -5, 0, UIntPtr.Zero);
                        Thread.Sleep(30);

                        byte shiftScan = (byte)MapVirtualKey(VK_SHIFT, 0);
                        keybd_event(VK_SHIFT, shiftScan, 0, UIntPtr.Zero);
                        Thread.Sleep(25);
                        keybd_event(VK_SHIFT, shiftScan, KEYEVENTF_KEYUP, UIntPtr.Zero);
                        Thread.Sleep(200);

                        log?.Invoke("Dismissing lock screen wallpaper curtain with Space...");
                        byte spaceScan = (byte)MapVirtualKey(VK_SPACE, 0);
                        keybd_event(VK_SPACE, spaceScan, 0, UIntPtr.Zero);
                        Thread.Sleep(25);
                        keybd_event(VK_SPACE, spaceScan, KEYEVENTF_KEYUP, UIntPtr.Zero);
                        Thread.Sleep(80);
                        keybd_event(VK_SPACE, spaceScan, 0, UIntPtr.Zero);
                        Thread.Sleep(25);
                        keybd_event(VK_SPACE, spaceScan, KEYEVENTF_KEYUP, UIntPtr.Zero);
                    });
                    wakeThread.SetApartmentState(ApartmentState.MTA);
                    wakeThread.Start();
                    wakeThread.Join();

                    // Dynamically watch for the active input desktop to transition to Winlogon
                    log?.Invoke("Waiting for active input desktop to transition to Winlogon...");
                    bool reachedWinlogon = false;
                    for (int i = 0; i < 40; i++) // up to 2.0 seconds (polling every 50ms)
                    {
                        Thread.Sleep(50);
                        string? curDt = GetActiveDesktopName();
                        if (curDt == "Winlogon")
                        {
                            log?.Invoke($"Active desktop transitioned to Winlogon in {(i + 1) * 50}ms!");
                            reachedWinlogon = true;
                            break;
                        }
                    }

                    if (!reachedWinlogon)
                    {
                        log?.Invoke("Timeout waiting for Winlogon transition, proceeding with typing sequence...");
                    }

                    // Settle delay for LogonUI to focus the PIN box
                    Thread.Sleep(200);
                }
                else
                {
                    log?.Invoke("Workstation is already on Winlogon password screen. Skipping curtain dismiss.");
                    try { SetThreadExecutionState(ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED); } catch { }
                    Thread.Sleep(100);
                }

                // Phase 2: Type PIN on a FRESH, dedicated thread attached specifically to Winlogon
                void TypePinOnWinlogon(string attemptLabel)
                {
                    var typeThread = new Thread(() =>
                    {
                        IntPtr hWinlogon = IntPtr.Zero;
                        try
                        {
                            hWinlogon = OpenInputDesktop(0, false, 0x01FF);
                            if (hWinlogon == IntPtr.Zero) hWinlogon = OpenInputDesktop(0, false, 0x0100);
                            if (hWinlogon == IntPtr.Zero) hWinlogon = OpenDesktop("Winlogon", 0, false, 0x01FF);
                            if (hWinlogon == IntPtr.Zero) hWinlogon = OpenDesktop("Winlogon", 0, false, 0x0100);

                            if (hWinlogon != IntPtr.Zero)
                            {
                                bool set = SetThreadDesktop(hWinlogon);
                                string curName = GetActiveDesktopName() ?? "unknown";
                                log?.Invoke($"[{attemptLabel}] SetThreadDesktop result: {set}, Attached Desktop: {curName}");
                            }
                            else
                            {
                                log?.Invoke($"[{attemptLabel}] Warning: Could not acquire Winlogon desktop handle.");
                            }

                            // 8 backspaces to ensure clean empty PIN field
                            byte backScan = (byte)MapVirtualKey(VK_BACK, 0);
                            for (int i = 0; i < 8; i++)
                            {
                                keybd_event(VK_BACK, backScan, 0, UIntPtr.Zero);
                                Thread.Sleep(10);
                                keybd_event(VK_BACK, backScan, KEYEVENTF_KEYUP, UIntPtr.Zero);
                                Thread.Sleep(10);
                            }
                            Thread.Sleep(40);

                            // Type PIN digits with hardware scan codes
                            log?.Invoke($"[{attemptLabel}] Typing {pin.Length} PIN digits on Winlogon desktop...");
                            foreach (char c in pin)
                            {
                                byte vk = (byte)c;
                                byte scan = (byte)MapVirtualKey(vk, 0);
                                keybd_event(vk, scan, 0, UIntPtr.Zero);
                                Thread.Sleep(18);
                                keybd_event(vk, scan, KEYEVENTF_KEYUP, UIntPtr.Zero);
                                Thread.Sleep(18);
                            }

                            // Submit Enter key
                            log?.Invoke($"[{attemptLabel}] Submitting PIN with Enter key...");
                            Thread.Sleep(35);
                            byte enterScan = (byte)MapVirtualKey(VK_RETURN, 0);
                            keybd_event(VK_RETURN, enterScan, 0, UIntPtr.Zero);
                            Thread.Sleep(20);
                            keybd_event(VK_RETURN, enterScan, KEYEVENTF_KEYUP, UIntPtr.Zero);
                        }
                        catch (Exception ex)
                        {
                            log?.Invoke($"[{attemptLabel}] Exception during typing: {ex.Message}");
                        }
                        finally
                        {
                            if (hWinlogon != IntPtr.Zero)
                            {
                                CloseDesktop(hWinlogon);
                            }
                        }
                    });
                    typeThread.SetApartmentState(ApartmentState.MTA);
                    typeThread.Start();
                    typeThread.Join();
                }

                // Attempt-1: Primary typing attempt
                TypePinOnWinlogon("Attempt-1");

                // Responsive polling for workstation unlock
                bool stillLocked = true;
                for (int i = 0; i < 20; i++)
                {
                    Thread.Sleep(80);
                    stillLocked = CheckIfScreenIsLocked();
                    if (!stillLocked)
                    {
                        log?.Invoke($"Workstation successfully unlocked on Attempt-1 after {(i + 1) * 80}ms!");
                        break;
                    }
                }

                // Attempt-2 retry if still locked
                if (stillLocked)
                {
                    log?.Invoke("Workstation still locked after Attempt-1. Initiating Attempt-2 retry on Winlogon desktop...");
                    Thread.Sleep(300);
                    TypePinOnWinlogon("Attempt-2");
                    for (int i = 0; i < 20; i++)
                    {
                        Thread.Sleep(80);
                        stillLocked = CheckIfScreenIsLocked();
                        if (!stillLocked)
                        {
                            log?.Invoke($"Workstation successfully unlocked on Attempt-2 after {(i + 1) * 80}ms!");
                            break;
                        }
                    }
                }

                // Attempt-3 tertiary retry if still locked
                if (stillLocked)
                {
                    log?.Invoke("Workstation still locked after Attempt-2. Initiating Attempt-3 tertiary retry on Winlogon desktop...");
                    Thread.Sleep(300);
                    TypePinOnWinlogon("Attempt-3");
                    for (int i = 0; i < 20; i++)
                    {
                        Thread.Sleep(80);
                        stillLocked = CheckIfScreenIsLocked();
                        if (!stillLocked)
                        {
                            log?.Invoke($"Workstation successfully unlocked on Attempt-3 after {(i + 1) * 80}ms!");
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

        /// <summary>
        /// Authoritative query directly to the Windows Terminal Services kernel subsystem.
        /// Returns true if the active console session is locked, disconnected, or at Winlogon.
        /// </summary>
        public static bool QueryIsConsoleSessionLocked()
        {
            try
            {
                uint activeSession = WTSGetActiveConsoleSessionId();
                if (activeSession == 0xFFFFFFFF)
                {
                    // No interactive console session attached (e.g. at logon/switch screen or asleep)
                    return true;
                }

                IntPtr pBuf = IntPtr.Zero;
                int bytesReturned = 0;
                if (WTSQuerySessionInformation(IntPtr.Zero, (int)activeSession, WTSSessionInfoEx, out pBuf, out bytesReturned) && pBuf != IntPtr.Zero)
                {
                    try
                    {
                        var info = (WTSINFOEX)Marshal.PtrToStructure(pBuf, typeof(WTSINFOEX));
                        // SessionFlags: 0 = WTS_SESSIONSTATE_LOCK (Workstation is locked), 1 = WTS_SESSIONSTATE_UNLOCK (Unlocked)
                        // If SessionFlags is 0, it is definitively LOCKED by the Windows OS.
                        if (info.Data.SessionFlags == WTS_SESSIONSTATE_LOCK)
                        {
                            return true;
                        }
                        // If session state is not active (0 = WTSActive), e.g. disconnected or idle, it is not in active use
                        if (info.Data.SessionState != 0)
                        {
                            return true;
                        }
                        return false;
                    }
                    finally
                    {
                        WTSFreeMemory(pBuf);
                    }
                }
            }
            catch { }

            // Secondary check: if active desktop is Winlogon or Screen-saver
            if (CheckIfScreenIsLocked())
            {
                return true;
            }

            // Fallback: check lock_state.txt
            try
            {
                string statePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "iLock", "lock_state.txt");
                if (File.Exists(statePath))
                {
                    string state = File.ReadAllText(statePath).Trim();
                    return state.Equals("LOCKED", StringComparison.OrdinalIgnoreCase);
                }
            }
            catch { }

            return false;
        }

        public Task<(bool isLocked, string? activeUser)> GetStatusAsync(CancellationToken ct = default)
        {
            bool isLocked = QueryIsConsoleSessionLocked();

            // Keep lock_state.txt strictly synchronized with ground truth
            try
            {
                string statePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "iLock", "lock_state.txt");
                File.WriteAllText(statePath, isLocked ? "LOCKED" : "UNLOCKED");
            }
            catch { }

            string? activeUser = Environment.UserName;
            return Task.FromResult<(bool isLocked, string? activeUser)>((isLocked, activeUser));
        }

        public void Dispose()
        {
            _sessionListener?.Dispose();
        }
    }
}
