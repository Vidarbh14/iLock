using System;
using System.Threading;
using System.Threading.Tasks;

namespace ILock.WindowsAgent.Access
{
    public enum AccessState
    {
        Locked,
        Authorized,
        Active,
        Revoked,
        Expired,
        Error
    }

    public record AccessSessionInfo(
        Guid SessionId,
        DateTime ExpiresAtUtc,
        AccessState State,
        string? AdditionalInfo = null
    );

    /// <summary>
    /// Mandatory abstraction separating Cloud Authorization from Windows OS Access Enforcement.
    /// This ensures zero unsafe authentication bypasses and clean pluggability between
    /// production Windows security integration and safe developer demo sandboxing.
    /// </summary>
    public interface IWindowsAccessProvider
    {
        /// <summary>
        /// Applies authorized temporary access for the given session ID and expiration time.
        /// </summary>
        Task<bool> RequestAuthorizedAccessAsync(Guid sessionId, DateTime expiresAtUtc, CancellationToken ct = default);

        /// <summary>
        /// Immediately revokes temporary access and terminates active authorization.
        /// </summary>
        Task<bool> RevokeAuthorizedAccessAsync(Guid sessionId, string reason, CancellationToken ct = default);

        /// <summary>
        /// Retrieves the current operational access state of the PC.
        /// </summary>
        AccessState GetAccessState();

        /// <summary>
        /// Gets current active temporary access session info, if one exists.
        /// </summary>
        AccessSessionInfo? GetCurrentSession();

        /// <summary>
        /// Enforces workstation lock via legitimate Windows security primitives (e.g. LockWorkStation).
        /// </summary>
        Task<bool> LockAsync(CancellationToken ct = default);

        /// <summary>
        /// Unlocks the workstation using zero-knowledge credentials from the local DPAPI vault.
        /// </summary>
        Task<bool> UnlockAsync(CancellationToken ct = default);

        /// <summary>
        /// Queries PC status telemetry (locked state, active console user, OS info).
        /// </summary>
        Task<(bool isLocked, string? activeUser)> GetStatusAsync(CancellationToken ct = default);
    }
}
