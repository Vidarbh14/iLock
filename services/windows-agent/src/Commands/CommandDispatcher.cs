using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ILock.WindowsAgent.Access;
using ILock.WindowsAgent.Config;
using ILock.WindowsAgent.Network;
using ILock.WindowsAgent.Security;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Commands
{
    public class CommandDispatcher
    {
        private readonly ILogger<CommandDispatcher> _logger;
        private readonly IWindowsAccessProvider _accessProvider;
        private readonly NonceValidator _nonceValidator;
        private readonly DeviceIdentity _deviceIdentity;
        private readonly CloudClient _cloudClient;

        public CommandDispatcher(
            ILogger<CommandDispatcher> logger,
            IWindowsAccessProvider accessProvider,
            NonceValidator nonceValidator,
            DeviceIdentity deviceIdentity,
            CloudClient cloudClient)
        {
            _logger = logger;
            _accessProvider = accessProvider;
            _nonceValidator = nonceValidator;
            _deviceIdentity = deviceIdentity;
            _cloudClient = cloudClient;
        }

        public async Task ProcessCommandAsync(AgentCommand command, AgentConfig config, CancellationToken ct)
        {
            _logger.LogInformation("Processing command {Type} (ID={Id}, Nonce={Nonce})", command.CommandType, command.Id, command.Nonce);

            // 1. Expiration Check
            if (DateTime.TryParse(command.ExpiresAt, out var expiresAtUtc) && DateTime.UtcNow > expiresAtUtc)
            {
                _logger.LogWarning("Command {Id} has expired. Rejecting.", command.Id);
                await ReportResultAsync(command, config, "REJECTED", "EXPIRED", "Command expired before processing.", ct);
                return;
            }

            // 2. Replay Protection & Nonce Check
            var commandTime = DateTime.TryParse(command.ExpiresAt, out _) ? DateTime.UtcNow : DateTime.UtcNow;
            if (!_nonceValidator.Validate(command.Nonce, commandTime, out string? nonceError))
            {
                _logger.LogWarning("Command {Id} failed replay check: {Error}", command.Id, nonceError);
                await ReportResultAsync(command, config, "REJECTED", "REPLAY_DETECTED", nonceError, ct);
                return;
            }

            // 3. Dispatch to Access Provider
            try
            {
                switch (command.CommandType)
                {
                    case "CREATE_ACCESS_SESSION":
                        await HandleCreateAccessSessionAsync(command, config, ct);
                        break;

                    case "REVOKE_ACCESS_SESSION":
                        await HandleRevokeAccessSessionAsync(command, config, ct);
                        break;

                    case "LOCK_REQUEST":
                        await HandleLockRequestAsync(command, config, ct);
                        break;

                    case "UNLOCK_REQUEST":
                        await HandleUnlockRequestAsync(command, config, ct);
                        break;

                    case "DEVICE_PING":
                        await ReportResultAsync(command, config, "SUCCESS", "PONG", "Device active and reachable.", ct);
                        break;

                    case "GET_DEVICE_STATUS":
                        var (isLocked, activeUser) = await _accessProvider.GetStatusAsync(ct);
                        var statusDetails = $"Locked={isLocked}, User={activeUser}, State={_accessProvider.GetAccessState()}";
                        await ReportResultAsync(command, config, "SUCCESS", "STATUS_REPORT", statusDetails, ct);
                        break;

                    default:
                        _logger.LogWarning("Unknown command type: {Type}", command.CommandType);
                        await ReportResultAsync(command, config, "REJECTED", "UNKNOWN_COMMAND", $"Unknown command type '{command.CommandType}'", ct);
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing command {Id}", command.Id);
                await ReportResultAsync(command, config, "FAILED", "EXECUTION_ERROR", ex.Message, ct);
            }
        }

        private async Task HandleCreateAccessSessionAsync(AgentCommand command, AgentConfig config, CancellationToken ct)
        {
            if (!Guid.TryParse(command.SessionId, out var sessionId))
            {
                await ReportResultAsync(command, config, "FAILED", "INVALID_SESSION_ID", "Missing or invalid SessionId", ct);
                return;
            }

            int durationMinutes = 30;
            if (command.Payload != null && command.Payload.TryGetValue("durationMinutes", out var durObj))
            {
                if (durObj is JsonElement elem && elem.TryGetInt32(out int parsed))
                {
                    durationMinutes = parsed;
                }
            }

            var sessionExpiry = DateTime.UtcNow.AddMinutes(durationMinutes);
            bool success = await _accessProvider.RequestAuthorizedAccessAsync(sessionId, sessionExpiry, ct);

            if (success)
            {
                await ReportResultAsync(command, config, "SUCCESS", "AUTHORIZED_ACTIVE", $"Access granted until {sessionExpiry:u}", ct);
            }
            else
            {
                await ReportResultAsync(command, config, "FAILED", "ACCESS_DENIED", "Access provider refused session creation.", ct);
            }
        }

        private async Task HandleRevokeAccessSessionAsync(AgentCommand command, AgentConfig config, CancellationToken ct)
        {
            Guid sessionId = Guid.Empty;
            if (!string.IsNullOrEmpty(command.SessionId))
            {
                Guid.TryParse(command.SessionId, out sessionId);
            }

            string reason = "Remote owner immediate revocation";
            if (command.Payload != null && command.Payload.TryGetValue("reason", out var reasonObj))
            {
                reason = reasonObj?.ToString() ?? reason;
            }

            bool success = await _accessProvider.RevokeAuthorizedAccessAsync(sessionId, reason, ct);
            await ReportResultAsync(command, config, success ? "SUCCESS" : "FAILED", "REVOKED", reason, ct);
        }

        private async Task HandleLockRequestAsync(AgentCommand command, AgentConfig config, CancellationToken ct)
        {
            bool success = await _accessProvider.LockAsync(ct);
            await ReportResultAsync(command, config, success ? "SUCCESS" : "FAILED", "LOCKED", "Workstation lock requested.", ct);
        }

        private async Task HandleUnlockRequestAsync(AgentCommand command, AgentConfig config, CancellationToken ct)
        {
            _logger.LogInformation("Processing remote UNLOCK_REQUEST...");
            bool success = await _accessProvider.UnlockAsync(ct);
            if (success)
            {
                await ReportResultAsync(command, config, "SUCCESS", "UNLOCKED", "Workstation unlocked via phone biometric authorization.", ct);
            }
            else
            {
                await ReportResultAsync(command, config, "FAILED", "UNLOCK_FAILED", "Failed to unlock workstation. Check if PIN is configured in DPAPI vault.", ct);
            }
        }

        private async Task ReportResultAsync(
            AgentCommand command,
            AgentConfig config,
            string status,
            string? resultStatus,
            string? errorOrMsg,
            CancellationToken ct)
        {
            long timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            string nonce = Guid.NewGuid().ToString("N");
            string dataToSign = $"{command.Id}:{status}:{timestamp}:{nonce}";
            string signature = _deviceIdentity.SignData(dataToSign);

            var resultPayload = new CommandResultPayload
            {
                CommandId = command.Id,
                SessionId = command.SessionId,
                Status = status,
                ResultStatus = resultStatus,
                Error = status == "SUCCESS" ? null : errorOrMsg,
                Nonce = nonce,
                Timestamp = timestamp,
                Signature = signature
            };

            await _cloudClient.SendCommandResultAsync(config.BackendUrl, resultPayload, config.AuthToken, ct);
        }
    }
}
