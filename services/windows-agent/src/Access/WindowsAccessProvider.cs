using System;
using System.Diagnostics;
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
    /// SECURITY MANDATE:
    /// Windows login credentials (e.g. 6-digit PIN) are NEVER transmitted over the cloud.
    /// Credentials reside exclusively on the physical device protected by Windows DPAPI.
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

        private const uint KEYEVENTF_KEYUP = 0x0002;
        private const uint MOUSEEVENTF_MOVE = 0x0001;
        private const byte VK_SPACE = 0x20;
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

                await Task.Run(() => SimulateUnlock(pin), ct);

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

        /// <summary>
        /// Simulates hardware input to wake the monitor, dismiss the lock screen overlay,
        /// and type the 6-digit PIN into the Windows logon prompt.
        /// </summary>
        public static void SimulateUnlock(string pin)
        {
            // 1. Wake display / power management
            mouse_event(MOUSEEVENTF_MOVE, 0, 1, 0, UIntPtr.Zero);
            Thread.Sleep(50);
            mouse_event(MOUSEEVENTF_MOVE, 0, -1, 0, UIntPtr.Zero);
            Thread.Sleep(100);

            // 2. Dismiss lock screen wallpaper overlay (Space key)
            keybd_event(VK_SPACE, 0, 0, UIntPtr.Zero);
            Thread.Sleep(50);
            keybd_event(VK_SPACE, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

            // Wait for PIN field to slide up and focus
            Thread.Sleep(450);

            // 3. Type each digit of the PIN
            foreach (char c in pin)
            {
                byte vk = (byte)c;
                keybd_event(vk, 0, 0, UIntPtr.Zero);
                Thread.Sleep(30);
                keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                Thread.Sleep(30);
            }

            // 4. Press Enter to submit
            Thread.Sleep(100);
            keybd_event(VK_RETURN, 0, 0, UIntPtr.Zero);
            Thread.Sleep(50);
            keybd_event(VK_RETURN, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        }

        public Task<(bool isLocked, string? activeUser)> GetStatusAsync(CancellationToken ct = default)
        {
            bool isLocked = GetAccessState() != AccessState.Active;
            string? activeUser = Environment.UserName;
            return Task.FromResult<(bool isLocked, string? activeUser)>((isLocked, activeUser));
        }
    }
}
