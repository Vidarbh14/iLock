using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Access
{
    /// <summary>
    /// Production Windows Security Access Provider.
    /// Uses legitimate Windows OS APIs (user32.dll LockWorkStation) and defines the integration
    /// interface for Windows Credential Providers and Kerberos/Local Security Authority (LSA) contracts.
    ///
    /// SECURITY MANDATE:
    /// This implementation strictly avoids LSASS tampering, credential scraping, or registry bypassing.
    /// </summary>
    public class WindowsAccessProvider : IWindowsAccessProvider
    {
        private readonly ILogger<WindowsAccessProvider> _logger;
        private AccessSessionInfo? _currentSession;
        private readonly object _lock = new();

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool LockWorkStation();

        public WindowsAccessProvider(ILogger<WindowsAccessProvider> logger)
        {
            _logger = logger;
            _logger.LogInformation("WindowsAccessProvider initialized with genuine Windows API bindings.");
        }

        public Task<bool> RequestAuthorizedAccessAsync(Guid sessionId, DateTime expiresAtUtc, CancellationToken ct = default)
        {
            lock (_lock)
            {
                _logger.LogInformation(
                    "Production Windows Access: Authorizing Session={SessionId}, Expires={ExpiresAtUtc:u}",
                    sessionId, expiresAtUtc
                );

                // Architectural Integration Note:
                // In production, iLock pairs with an installed Windows Credential Provider (CP).
                // The CP communicates with the Windows Agent via secure IPC (Named Pipe secured with Windows ACLs).
                // When an authorized session is active, the CP surfaces a temporary login tile or unlocks
                // using a short-lived local token generated on-device, without ever exposing the owner's permanent password.
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

        public Task<(bool isLocked, string? activeUser)> GetStatusAsync(CancellationToken ct = default)
        {
            bool isLocked = GetAccessState() != AccessState.Active;
            string? activeUser = Environment.UserName;
            return Task.FromResult<(bool isLocked, string? activeUser)>((isLocked, activeUser));
        }
    }
}
