using System.Text;
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
                _logger.LogWarning("Command {Id} failed replay check ({Error}). Skipping duplicate execution.", command.Id, nonceError);
                return;
            }

            // 3. Dispatch to Access Provider
            try
            {
                // Normalize effective command type by inspecting payload action
                // (e.g. Postgres authorization_command_type enum wrapper "DEVICE_PING" or "CREATE_ACCESS_SESSION")
                string effectiveType = command.CommandType;
                if (command.Payload != null && command.Payload.TryGetValue("action", out var rawAct) && rawAct != null)
                {
                    string act = rawAct.ToString()?.Trim().ToUpperInvariant() ?? "";
                    if (!string.IsNullOrEmpty(act))
                    {
                        if (act == "SLEEP") effectiveType = "POWER_SLEEP";
                        else if (act == "RESTART") effectiveType = "POWER_RESTART";
                        else if (act == "DISPLAY_OFF") effectiveType = "DISPLAY_OFF";
                        else if (act == "SCREENSHOT") effectiveType = "SCREENSHOT";
                        else if (act == "CAMERA" || act == "CAPTURE_CAMERA") effectiveType = "CAPTURE_CAMERA";
                        else if (act == "SEND_TOAST" || act == "TOAST") effectiveType = "SEND_TOAST";
                        else if (act == "SET_CLIPBOARD" || act == "CLIPBOARD") effectiveType = "SET_CLIPBOARD";
                        else if (act == "VERIFY_TOTP" || act == "TOTP") effectiveType = "VERIFY_TOTP";
                        else if (act == "ALARM" || act == "TRIGGER_ALARM" || act == "SECURITY_ALARM") effectiveType = "TRIGGER_ALARM";
                        else if (act == "STEALTH_LOCK") effectiveType = "STEALTH_LOCK";
                        else if (act == "UNLOCK") effectiveType = "UNLOCK_REQUEST";
                        else if (act == "LOCK") effectiveType = "LOCK_REQUEST";
                        else if (act == "START_SCREEN_STREAM" || act == "START_STREAM") effectiveType = "START_SCREEN_STREAM";
                        else if (act == "STOP_SCREEN_STREAM" || act == "STOP_STREAM") effectiveType = "STOP_SCREEN_STREAM";
                        else if (act == "STREAM_PING" || act == "PING_STREAM") effectiveType = "STREAM_PING";
                        else if (act == "REMOTE_INPUT" || act == "INPUT") effectiveType = "REMOTE_INPUT";
                        else if (act == "TEXT_TO_SPEECH" || act == "SPEAK") effectiveType = "TEXT_TO_SPEECH";
                        else if (act == "PROCESS_ACTION" || act == "PROCESSES") effectiveType = "PROCESS_ACTION";
                        else if (act == "FILE_CONDUIT" || act == "FILES") effectiveType = "FILE_CONDUIT";
                        else if (act == "SENTRY_CONFIG" || act == "SENTRY") effectiveType = "SENTRY_CONFIG";
                        else if (act == "BLE_PROXIMITY" || act == "PROXIMITY") effectiveType = "BLE_PROXIMITY";
                        else if (command.CommandType == "DEVICE_PING") effectiveType = act;
                    }
                }
                if (command.Payload != null && command.Payload.TryGetValue("isUnlock", out var unl) &&
                    (unl is JsonElement el && (el.ValueKind == JsonValueKind.True || el.ToString() == "true")))
                {
                    effectiveType = "UNLOCK_REQUEST";
                }

                _logger.LogInformation("Dispatching effective command: {EffectiveType} (Raw={RawType})", effectiveType, command.CommandType);

                switch (effectiveType)
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

                    case "POWER_SLEEP":
                        var (sleepOk, sleepMsg) = SystemUtilities.ExecutePowerCommand("sleep", _logger);
                        await ReportResultAsync(command, config, sleepOk ? "SUCCESS" : "FAILED", "POWER_STATE_CHANGED", sleepMsg, ct);
                        break;

                    case "POWER_RESTART":
                        var (rstOk, rstMsg) = SystemUtilities.ExecutePowerCommand("restart", _logger);
                        await ReportResultAsync(command, config, rstOk ? "SUCCESS" : "FAILED", "POWER_STATE_CHANGED", rstMsg, ct);
                        break;

                    case "DISPLAY_OFF":
                        var (dispOk, dispMsg) = SystemUtilities.ExecutePowerCommand("display_off", _logger);
                        await ReportResultAsync(command, config, dispOk ? "SUCCESS" : "FAILED", "DISPLAY_OFF_ACTIVE", dispMsg, ct);
                        break;

                    case "SCREENSHOT":
                        var screenBase64 = SystemUtilities.CaptureScreenBase64(_logger);
                        if (!string.IsNullOrEmpty(screenBase64))
                        {
                            await ReportResultAsync(command, config, "SUCCESS", "SCREENSHOT_CAPTURED", "Screen captured successfully", ct, screenBase64);
                        }
                        else
                        {
                            await ReportResultAsync(command, config, "FAILED", "SCREENSHOT_FAILED", "Failed to capture desktop screenshot. Workstation may be locked or screen off.", ct);
                        }
                        break;

                    case "SEND_TOAST":
                        string toastTitle = "iLock Security Alert";
                        string toastMsg = "Remote Notification";
                        if (command.Payload != null)
                        {
                            if (command.Payload.TryGetValue("title", out var tTitle) && tTitle != null)
                                toastTitle = tTitle.ToString() ?? toastTitle;
                            if (command.Payload.TryGetValue("message", out var tMsg) && tMsg != null)
                                toastMsg = tMsg.ToString() ?? toastMsg;
                        }
                        bool toastOk = SystemUtilities.DisplayOnScreenMessage(toastTitle, toastMsg, _logger);
                        await ReportResultAsync(command, config, toastOk ? "SUCCESS" : "FAILED", "TOAST_DISPLAYED", toastMsg, ct);
                        break;

                    case "SET_CLIPBOARD":
                        string clipText = string.Empty;
                        if (command.Payload != null && command.Payload.TryGetValue("text", out var cVal) && cVal != null)
                        {
                            clipText = cVal.ToString() ?? string.Empty;
                        }
                        bool clipOk = SystemUtilities.SetClipboardText(clipText, _logger);
                        await ReportResultAsync(command, config, clipOk ? "SUCCESS" : "FAILED", "CLIPBOARD_SET", $"Set {clipText.Length} chars to clipboard", ct);
                        break;

                    case "CAPTURE_CAMERA":
                        var camBase64 = SystemUtilities.GenerateCameraSnapshotBase64(config.DeviceName, config.Hostname, _logger);
                        await ReportResultAsync(command, config, "SUCCESS", "CAMERA_CAPTURED", "Security camera frame captured", ct, camBase64);
                        break;

                    case "VERIFY_TOTP":
                        string inputCode = string.Empty;
                        if (command.Payload != null && command.Payload.TryGetValue("code", out var codeVal) && codeVal != null)
                        {
                            inputCode = codeVal.ToString() ?? string.Empty;
                        }
                        string totpSecret = TotpValidator.DeriveTotpSecret(config.DeviceUuid);
                        bool isTotpValid = TotpValidator.ValidateTotp(inputCode, totpSecret);
                        if (isTotpValid)
                        {
                            _logger.LogInformation("Offline TOTP Emergency Unlock authorized! Unlocking PC...");
                            await _accessProvider.UnlockAsync(ct);
                            await ReportResultAsync(command, config, "SUCCESS", "TOTP_VERIFIED", "Emergency TOTP authorized workstation unlock", ct);
                        }
                        else
                        {
                            await ReportResultAsync(command, config, "FAILED", "TOTP_INVALID", "Invalid or expired emergency TOTP code", ct);
                        }
                        break;

                    case "TRIGGER_ALARM":
                        int alarmSec = 10;
                        if (command.Payload != null && command.Payload.TryGetValue("duration", out var alSec) && alSec != null)
                        {
                            int.TryParse(alSec.ToString(), out alarmSec);
                        }
                        bool alarmStarted = SystemUtilities.PlaySecurityAlarm(alarmSec > 0 ? alarmSec : 10, _logger);
                        await ReportResultAsync(command, config, alarmStarted ? "SUCCESS" : "FAILED", "ALARM_TRIGGERED", "Audio deterrent alarm sounding on workstation", ct);
                        break;

                    case "STEALTH_LOCK":
                        await _accessProvider.LockAsync(ct);
                        SystemUtilities.ExecutePowerCommand("display_off", _logger);
                        await ReportResultAsync(command, config, "SUCCESS", "STEALTH_LOCKED", "Workstation locked and display powered down.", ct);
                        break;

                    case "START_SCREEN_STREAM":
                        string streamSessionId = Guid.NewGuid().ToString();
                        string quality = "balanced";
                        int targetFps = 4;

                        if (command.Payload != null)
                        {
                            if (command.Payload.TryGetValue("streamSessionId", out var sessObj) && sessObj != null)
                                streamSessionId = sessObj.ToString() ?? streamSessionId;
                            if (command.Payload.TryGetValue("quality", out var qObj) && qObj != null)
                                quality = qObj.ToString() ?? quality;
                            if (command.Payload.TryGetValue("targetFps", out var fpsObj) && fpsObj != null)
                            {
                                if (fpsObj is JsonElement fpsElem && fpsElem.TryGetInt32(out int parsedFps))
                                    targetFps = parsedFps;
                                else
                                    int.TryParse(fpsObj.ToString(), out targetFps);
                            }
                        }

                        LiveScreenStreamer.Instance.Start(
                            config.DeviceUuid,
                            config.BackendUrl,
                            config.AuthToken,
                            streamSessionId,
                            targetFps,
                            quality,
                            _logger);

                        await ReportResultAsync(command, config, "SUCCESS", "STREAM_STARTED", $"Live screen streaming active ({quality}, {targetFps} FPS)", ct);
                        break;

                    case "STOP_SCREEN_STREAM":
                        LiveScreenStreamer.Instance.Stop(_logger);
                        await ReportResultAsync(command, config, "SUCCESS", "STREAM_STOPPED", "Live screen streaming terminated. Battery saver active.", ct);
                        break;

                    case "STREAM_PING":
                        LiveScreenStreamer.Instance.KeepAlive();
                        await ReportResultAsync(command, config, "SUCCESS", "PONG", "Stream keep-alive ping received", ct);
                        break;

                    case "DEVICE_PING":
                        await ReportResultAsync(command, config, "SUCCESS", "PONG", "Device active and reachable.", ct);
                        break;

                    case "GET_DEVICE_STATUS":
                        var (isLocked, activeUser) = await _accessProvider.GetStatusAsync(ct);
                        var statusDetails = $"Locked={isLocked}, User={activeUser}, State={_accessProvider.GetAccessState()}";
                        await ReportResultAsync(command, config, "SUCCESS", "STATUS_REPORT", statusDetails, ct);
                        break;

                    
                    case "REMOTE_INPUT":
                        string inputJson = command.Payload != null ? JsonSerializer.Serialize(command.Payload) : "{}";
                        byte[] inputBytes = Encoding.UTF8.GetBytes(inputJson);
                        string inputBase64 = Convert.ToBase64String(inputBytes);
                        bool inputOk = WindowsAccessProvider.TryLaunchInSession($"--input-helper \"BASE64:{inputBase64}\"", @"Winsta0\Default", _logger, 2000, out _);
                        await ReportResultAsync(command, config, inputOk ? "SUCCESS" : "FAILED", "INPUT_EXECUTED", "Input event processed", ct);
                        break;

                    case "TEXT_TO_SPEECH":
                        string spText = "Alert from iLock";
                        int spRate = 0;
                        int spVol = 100;
                        if (command.Payload != null)
                        {
                            if (command.Payload.TryGetValue("text", out var tObj) && tObj != null) spText = tObj.ToString() ?? spText;
                            if (command.Payload.TryGetValue("rate", out var rObj) && rObj != null) int.TryParse(rObj.ToString(), out spRate);
                            if (command.Payload.TryGetValue("volume", out var vObj) && vObj != null) int.TryParse(vObj.ToString(), out spVol);
                        }
                        bool spOk = WindowsAccessProvider.TryLaunchInSession($"--speak \"{spText}\" {spRate} {spVol}", @"Winsta0\Default", _logger, 10000, out _);
                        await ReportResultAsync(command, config, spOk ? "SUCCESS" : "FAILED", "SPEECH_COMPLETED", $"Announced '{spText}'", ct);
                        break;

                    case "PROCESS_ACTION":
                        string pAction = "list";
                        int killPid = 0;
                        if (command.Payload != null)
                        {
                            if (command.Payload.TryGetValue("action", out var paObj) && paObj != null) pAction = paObj.ToString()?.ToLowerInvariant() ?? "list";
                            if (command.Payload.TryGetValue("pid", out var pidObj) && pidObj != null) int.TryParse(pidObj.ToString(), out killPid);
                        }
                        if (pAction == "kill" && killPid > 0)
                        {
                            var (kOk, kMsg) = Diagnostics.ProcessManager.KillProcess(killPid, _logger);
                            await ReportResultAsync(command, config, kOk ? "SUCCESS" : "FAILED", "PROCESS_KILLED", kMsg, ct);
                        }
                        else
                        {
                            string procJson = Diagnostics.ProcessManager.GetTopProcessesJson(15, _logger);
                            await ReportResultAsync(command, config, "SUCCESS", "PROCESS_LIST", procJson, ct, procJson);
                        }
                        break;

                    case "FILE_CONDUIT":
                        string fAction = "list";
                        string fFolder = "desktop";
                        string fName = "";
                        string fData = "";
                        if (command.Payload != null)
                        {
                            if (command.Payload.TryGetValue("fileAction", out var fActObj) && fActObj != null)
                                fAction = fActObj.ToString()?.ToLowerInvariant() ?? "list";
                            else if (command.Payload.TryGetValue("action", out var faObj) && faObj != null && faObj.ToString()?.ToUpperInvariant() != "FILE_CONDUIT")
                                fAction = faObj.ToString()?.ToLowerInvariant() ?? "list";
                            if (command.Payload.TryGetValue("folder", out var foObj) && foObj != null) fFolder = foObj.ToString()?.ToLowerInvariant() ?? "desktop";
                            if (command.Payload.TryGetValue("fileName", out var fnObj) && fnObj != null) fName = fnObj.ToString() ?? "";
                            if (command.Payload.TryGetValue("contentBase64", out var fdObj) && fdObj != null) fData = fdObj.ToString() ?? "";
                        }
                        if (fAction == "read" && !string.IsNullOrEmpty(fName))
                        {
                            var (rOk, rB64, rMsg) = FileConduit.ReadFileBase64(fFolder, fName, _logger);
                            await ReportResultAsync(command, config, rOk ? "SUCCESS" : "FAILED", "FILE_READ", rMsg, ct, rB64);
                        }
                        else if (fAction == "write" && !string.IsNullOrEmpty(fName))
                        {
                            var (wOk, wMsg) = FileConduit.WriteFileBase64(fFolder, fName, fData, _logger);
                            await ReportResultAsync(command, config, wOk ? "SUCCESS" : "FAILED", "FILE_WRITTEN", wMsg, ct);
                        }
                        else
                        {
                            string fileListJson = FileConduit.ListFilesJson(fFolder, _logger);
                            await ReportResultAsync(command, config, "SUCCESS", "FILE_LIST", fileListJson, ct, fileListJson);
                        }
                        break;

                    case "SENTRY_CONFIG":
                        bool sArmed = false;
                        bool sAlarm = false;
                        bool sSnap = true;
                        bool sPower = true;
                        if (command.Payload != null)
                        {
                            if (command.Payload.TryGetValue("enabled", out var enObj) && enObj != null) bool.TryParse(enObj.ToString(), out sArmed);
                            if (command.Payload.TryGetValue("alarmOnTamper", out var alObj) && alObj != null) bool.TryParse(alObj.ToString(), out sAlarm);
                            if (command.Payload.TryGetValue("snapOnFailedLogon", out var snObj) && snObj != null) bool.TryParse(snObj.ToString(), out sSnap);
                            if (command.Payload.TryGetValue("alertOnPowerDisconnect", out var pwObj) && pwObj != null) bool.TryParse(pwObj.ToString(), out sPower);
                        }
                        Security.SentryGuard.Instance.Configure(sArmed, sAlarm, sSnap, sPower, _logger);
                        await ReportResultAsync(command, config, "SUCCESS", "SENTRY_CONFIGURED", $"Sentry Armed={sArmed}", ct);
                        break;

                    case "BLE_PROXIMITY":
                        bool bleEn = false;
                        int bleRssi = -75;
                        int bleTimeout = 5;
                        if (command.Payload != null)
                        {
                            if (command.Payload.TryGetValue("enabled", out var beObj) && beObj != null) bool.TryParse(beObj.ToString(), out bleEn);
                            if (command.Payload.TryGetValue("rssiThreshold", out var brObj) && brObj != null) int.TryParse(brObj.ToString(), out bleRssi);
                            if (command.Payload.TryGetValue("timeoutSeconds", out var btObj) && btObj != null) int.TryParse(btObj.ToString(), out bleTimeout);
                        }
                        Security.BleProximityWatcher.Instance.Configure(bleEn, bleRssi, bleTimeout, _logger);
                        await ReportResultAsync(command, config, "SUCCESS", "BLE_CONFIGURED", $"BLE Walk-Away={bleEn}", ct);
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
            if (success)
            {
                await ReportResultAsync(command, config, "SUCCESS", "LOCKED", "Workstation locked.", ct);
            }
            else
            {
                await ReportResultAsync(command, config, "FAILED", "LOCK_FAILED", "Failed to lock workstation.", ct);
            }
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
            CancellationToken ct,
            string? data = null)
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
                Error = status == "SUCCESS" ? null : (errorOrMsg != null && errorOrMsg.Length > 500 ? errorOrMsg.Substring(0, 500) : errorOrMsg),
                Nonce = nonce,
                Timestamp = timestamp,
                Signature = signature,
                Data = data
            };

            await _cloudClient.SendCommandResultAsync(config.BackendUrl, resultPayload, config.AuthToken, ct);
        }

    }
}
