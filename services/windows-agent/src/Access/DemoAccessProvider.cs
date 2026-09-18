using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Access
{
    /// <summary>
    /// Safe sandbox / development implementation of IWindowsAccessProvider.
    /// Simulates temporary access sessions, active timers, and lock states
    /// without compromising or modifying real Windows user credentials or authentication packages.
    /// </summary>
    public class DemoAccessProvider : IWindowsAccessProvider
    {
        private readonly ILogger<DemoAccessProvider> _logger;
        private AccessSessionInfo? _currentSession;
        private bool _isWorkstationLocked = true;
        private readonly object _lock = new();

        public DemoAccessProvider(ILogger<DemoAccessProvider> logger)
        {
            _logger = logger;
            _logger.LogInformation("[DEMO-MODE] DemoAccessProvider initialized. Running in safe simulation sandbox.");
        }

        public Task<bool> RequestAuthorizedAccessAsync(Guid sessionId, DateTime expiresAtUtc, CancellationToken ct = default)
        {
            lock (_lock)
            {
                _logger.LogInformation(
                    "[DEMO-MODE] Granting temporary access for Session={SessionId}. ExpiresAt={ExpiresAt:u}",
                    sessionId, expiresAtUtc
                );

                _currentSession = new AccessSessionInfo(sessionId, expiresAtUtc, AccessState.Active, "Simulated Temporary Access Active");
                _isWorkstationLocked = false;
            }

            return Task.FromResult(true);
        }

        public Task<bool> RevokeAuthorizedAccessAsync(Guid sessionId, string reason, CancellationToken ct = default)
        {
            lock (_lock)
            {
                _logger.LogWarning(
                    "[DEMO-MODE] Revoking temporary access for Session={SessionId}. Reason={Reason}",
                    sessionId, reason
                );

                if (_currentSession?.SessionId == sessionId || sessionId == Guid.Empty)
                {
                    _currentSession = new AccessSessionInfo(
                        sessionId,
                        DateTime.UtcNow,
                        AccessState.Revoked,
                        $"Revoked: {reason}"
                    );
                }

                _isWorkstationLocked = true;
            }

            return Task.FromResult(true);
        }

        public AccessState GetAccessState()
        {
            lock (_lock)
            {
                if (_currentSession == null)
                {
                    return _isWorkstationLocked ? AccessState.Locked : AccessState.Active;
                }

                if (_currentSession.State == AccessState.Revoked)
                {
                    return AccessState.Revoked;
                }

                if (DateTime.UtcNow >= _currentSession.ExpiresAtUtc)
                {
                    _currentSession = _currentSession with { State = AccessState.Expired };
                    _isWorkstationLocked = true;
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
                    _isWorkstationLocked = true;
                }
                return _currentSession;
            }
        }

        public Task<bool> LockAsync(CancellationToken ct = default)
        {
            lock (_lock)
            {
                _logger.LogInformation("[DEMO-MODE] Workstation locked simulated.");
                _isWorkstationLocked = true;
                if (_currentSession?.State == AccessState.Active)
                {
                    _currentSession = _currentSession with { State = AccessState.Locked };
                }
            }
            return Task.FromResult(true);
        }

        public Task<bool> UnlockAsync(CancellationToken ct = default)
        {
            lock (_lock)
            {
                _logger.LogInformation("[DEMO-MODE] Workstation unlock simulated.");
                _isWorkstationLocked = false;
                if (_currentSession?.State == AccessState.Locked)
                {
                    _currentSession = _currentSession with { State = AccessState.Active };
                }
            }
            return Task.FromResult(true);
        }

        public Task<(bool isLocked, string? activeUser)> GetStatusAsync(CancellationToken ct = default)
        {
            lock (_lock)
            {
                var user = Environment.UserName;
                return Task.FromResult((_isWorkstationLocked, (string?)user));
            }
        }
    }
}
