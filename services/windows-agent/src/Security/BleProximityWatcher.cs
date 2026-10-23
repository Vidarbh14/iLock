using System;
using System.Runtime.Versioning;
using ILock.WindowsAgent.Access;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Security
{
    [SupportedOSPlatform("windows")]
    public class BleProximityWatcher
    {
        public static BleProximityWatcher Instance { get; } = new BleProximityWatcher();

        private readonly object _lock = new();
        private bool _isEnabled = false;
        private int _thresholdRssi = -75;
        private int _timeoutSeconds = 5;
        private DateTime _lastSeenUtc = DateTime.UtcNow;

        public bool IsEnabled
        {
            get { lock (_lock) return _isEnabled; }
        }

        public void Configure(bool enabled, int thresholdRssi = -75, int timeoutSeconds = 5, ILogger? logger = null)
        {
            lock (_lock)
            {
                _isEnabled = enabled;
                _thresholdRssi = thresholdRssi;
                _timeoutSeconds = timeoutSeconds;
                _lastSeenUtc = DateTime.UtcNow;

                logger?.LogInformation("BleProximityWatcher configured: Enabled={Enabled}, RSSI={Rssi}dBm, Timeout={Timeout}s",
                    enabled, thresholdRssi, timeoutSeconds);
            }
        }

        public void ReportSignal(int currentRssi, ILogger? logger = null)
        {
            lock (_lock)
            {
                if (!_isEnabled) return;

                if (currentRssi >= _thresholdRssi)
                {
                    _lastSeenUtc = DateTime.UtcNow;
                }
                else if ((DateTime.UtcNow - _lastSeenUtc).TotalSeconds > _timeoutSeconds)
                {
                    logger?.LogWarning("[BLE PROXIMITY] Signal dropped to {Rssi} dBm (below threshold {Threshold} dBm). Walk-away auto-locking...",
                        currentRssi, _thresholdRssi);
                    WindowsAccessProvider.ExecuteNativeLock();
                    _lastSeenUtc = DateTime.UtcNow;
                }
            }
        }
    }
}
