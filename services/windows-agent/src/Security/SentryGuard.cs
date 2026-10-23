using System;
using System.IO;
using System.Runtime.Versioning;
using System.Text.Json;
using System.Threading.Tasks;
using ILock.WindowsAgent.Access;
using ILock.WindowsAgent.Config;
using ILock.WindowsAgent.Network;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Security
{
    [SupportedOSPlatform("windows")]
    public class SentryGuard
    {
        public static SentryGuard Instance { get; } = new SentryGuard();

        private readonly object _lock = new();
        private bool _isArmed = false;
        private bool _alarmOnTamper = false;
        private bool _snapOnFailedLogon = true;
        private bool _alertOnPowerDisconnect = true;
        private bool _lastChargingState = true;
        private DateTime _lastAlertUtc = DateTime.MinValue;

        public bool IsArmed
        {
            get { lock (_lock) return _isArmed; }
        }

        public void Configure(bool enabled, bool alarmOnTamper = false, bool snapOnLogon = true, bool alertOnPower = true, ILogger? logger = null)
        {
            lock (_lock)
            {
                _isArmed = enabled;
                _alarmOnTamper = alarmOnTamper;
                _snapOnFailedLogon = snapOnLogon;
                _alertOnPowerDisconnect = alertOnPower;
                logger?.LogInformation("SentryGuard configured: Armed={Armed}, AlarmOnTamper={Alarm}, SnapOnLogon={Snap}, AlertOnPower={Power}",
                    enabled, alarmOnTamper, snapOnLogon, alertOnPower);
            }
        }

        public async Task CheckPowerStatusAsync(bool isCharging, AgentConfig config, CloudClient cloudClient, ILogger? logger = null)
        {
            lock (_lock)
            {
                if (!_isArmed || !_alertOnPowerDisconnect)
                {
                    _lastChargingState = isCharging;
                    return;
                }

                // If charger was disconnected while armed
                if (_lastChargingState && !isCharging && (DateTime.UtcNow - _lastAlertUtc).TotalSeconds > 30)
                {
                    _lastAlertUtc = DateTime.UtcNow;
                    _lastChargingState = isCharging;
                    logger?.LogWarning("[SENTRY] AC Adapter unplugged while Armed! Triggering security capture...");

                    Task.Run(async () =>
                    {
                        await TriggerSecurityAlertAsync("AC Adapter Disconnected (Possible Snatch/Theft)", config, cloudClient, logger);
                    });
                }
                _lastChargingState = isCharging;
            }
        }

        public async Task TriggerSecurityAlertAsync(string reason, AgentConfig config, CloudClient cloudClient, ILogger? logger = null)
        {
            try
            {
                logger?.LogWarning("[SENTRY ALERT] {Reason}. Capturing camera surveillance...", reason);

                // 1. Capture webcam photo
                string? photoBase64 = SystemUtilities.GenerateCameraSnapshotBase64(config.DeviceName, config.Hostname, logger);

                // 2. Play acoustic deterrent alarm if enabled
                if (_alarmOnTamper)
                {
                    SystemUtilities.PlaySecurityAlarm(10, logger);
                }

                // 3. Immediately lock workstation
                WindowsAccessProvider.ExecuteNativeLock();

                // 4. Report event to cloud
                string url = $"{config.BackendUrl.TrimEnd('/')}/api/devices/{config.DeviceUuid}/sentry/alert";
                using var httpClient = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(10) };
                if (!string.IsNullOrEmpty(config.AuthToken))
                {
                    httpClient.DefaultRequestHeaders.TryAddWithoutValidation("X-Device-Token", config.AuthToken);
                    httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", config.AuthToken);
                }

                var payload = new
                {
                    deviceUuid = config.DeviceUuid,
                    reason,
                    timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    photoBase64 = photoBase64 ?? string.Empty
                };

                string json = JsonSerializer.Serialize(payload);
                using var content = new System.Net.Http.StringContent(json, System.Text.Encoding.UTF8, "application/json");
                await httpClient.PostAsync(url, content);
                logger?.LogInformation("[SENTRY ALERT] Security alert successfully transmitted to owner cloud account.");
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Failed to dispatch Sentry alert");
            }
        }
    }
}
