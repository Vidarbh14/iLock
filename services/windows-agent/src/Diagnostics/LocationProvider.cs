using System;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using ILock.WindowsAgent.Access;
using Microsoft.Extensions.Logging;
using Windows.Devices.Geolocation;

namespace ILock.WindowsAgent.Diagnostics
{
    public class LocationFix
    {
        [JsonPropertyName("latitude")]
        public double Latitude { get; set; }

        [JsonPropertyName("longitude")]
        public double Longitude { get; set; }

        [JsonPropertyName("accuracyM")]
        public double AccuracyM { get; set; }

        [JsonPropertyName("fixedAtMs")]
        public long FixedAtMs { get; set; }
    }

    /// <summary>
    /// Windows Location (Wi-Fi / GPS) sampler. Heartbeats only read the cached fix; refreshes run in the
    /// background so the 3s heartbeat never blocks on the location platform.
    /// Normal mode samples every 5 minutes; live mode (requested from the phone) samples every 10 seconds
    /// and expires on its own, mirroring the screen stream battery-saver watchdog.
    /// </summary>
    public static class LocationProvider
    {
        private static readonly TimeSpan NormalInterval = TimeSpan.FromMinutes(5);
        private static readonly TimeSpan LiveInterval = TimeSpan.FromSeconds(10);
        private static readonly TimeSpan FixTimeout = TimeSpan.FromSeconds(15);

        // Older fixes are not reported, so the backend can fall back to IP location (e.g. Location Services turned off)
        private static readonly TimeSpan MaxReportedFixAge = TimeSpan.FromMinutes(30);

        private static LocationFix? _latest;
        private static DateTime _lastAttemptUtc = DateTime.MinValue;
        private static DateTime _liveUntilUtc = DateTime.MinValue;
        private static string? _lastAccessStatus;
        private static int _refreshing;
        private static readonly object _lock = new();

        public static bool IsLive => DateTime.UtcNow < _liveUntilUtc;

        public static LocationFix? GetLatest()
        {
            lock (_lock)
            {
                if (_latest == null) return null;
                var age = DateTimeOffset.UtcNow - DateTimeOffset.FromUnixTimeMilliseconds(_latest.FixedAtMs);
                return age <= MaxReportedFixAge ? _latest : null;
            }
        }

        public static void SetLiveMode(bool enabled, int durationSeconds, ILogger logger)
        {
            lock (_lock)
            {
                _liveUntilUtc = enabled ? DateTime.UtcNow.AddSeconds(Math.Clamp(durationSeconds, 30, 600)) : DateTime.MinValue;
                if (enabled) _lastAttemptUtc = DateTime.MinValue; // Force an immediate fix
            }
            logger.LogInformation("Live location tracking {State} (duration={Duration}s)", enabled ? "ENABLED" : "DISABLED", durationSeconds);
        }

        /// <summary>
        /// Starts a background refresh when the sampling interval has elapsed. Never blocks the caller.
        /// </summary>
        public static void RefreshIfDue(ILogger logger)
        {
            lock (_lock)
            {
                var interval = IsLive ? LiveInterval : NormalInterval;
                if (DateTime.UtcNow - _lastAttemptUtc < interval) return;
                if (Interlocked.CompareExchange(ref _refreshing, 1, 0) != 0) return;
                _lastAttemptUtc = DateTime.UtcNow;
            }

            _ = Task.Run(async () =>
            {
                try
                {
                    var fix = await AcquireFixAsync(logger);
                    if (fix != null)
                    {
                        lock (_lock) _latest = fix;
                        logger.LogDebug("Location fix acquired (accuracy {Accuracy:F0} m)", fix.AccuracyM);
                    }
                }
                catch (Exception ex)
                {
                    logger.LogDebug(ex, "Location refresh failed.");
                }
                finally
                {
                    Interlocked.Exchange(ref _refreshing, 0);
                }
            });
        }

        private static async Task<LocationFix?> AcquireFixAsync(ILogger logger)
        {
            var fix = await QueryGeolocatorAsync(logger);
            if (fix != null || Process.GetCurrentProcess().SessionId != 0)
            {
                return fix;
            }

            // Session 0 (Windows Service) may be refused by the per-user location privacy settings.
            // Ask a helper in the active user session instead, exchanging the result through a temp file.
            string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "iLock");
            if (!Directory.Exists(appData)) Directory.CreateDirectory(appData);
            string tempFile = Path.Combine(appData, $"location_{Guid.NewGuid():N}.json");

            try
            {
                bool launched = WindowsAccessProvider.TryLaunchInSession(
                    $"--locate \"{tempFile}\"",
                    "default",
                    logger,
                    (int)FixTimeout.TotalMilliseconds + 5000,
                    out _
                );

                if (launched && File.Exists(tempFile))
                {
                    return JsonSerializer.Deserialize<LocationFix>(await File.ReadAllTextAsync(tempFile));
                }
            }
            finally
            {
                try { if (File.Exists(tempFile)) File.Delete(tempFile); } catch { }
            }

            return null;
        }

        public static async Task<LocationFix?> QueryGeolocatorAsync(ILogger? logger)
        {
            try
            {
                var access = await Geolocator.RequestAccessAsync().AsTask().WaitAsync(FixTimeout);
                string status = access.ToString();
                if (status != _lastAccessStatus)
                {
                    _lastAccessStatus = status;
                    logger?.LogInformation("Windows Location access status: {Status} (session {Session})", status, Process.GetCurrentProcess().SessionId);
                }
                if (access != GeolocationAccessStatus.Allowed)
                {
                    return null;
                }

                var locator = new Geolocator { DesiredAccuracyInMeters = 50 };
                var maxAge = IsLive ? TimeSpan.FromSeconds(5) : TimeSpan.FromMinutes(1);
                var pos = await locator.GetGeopositionAsync(maxAge, FixTimeout);
                var c = pos.Coordinate;

                // Pre-round so the signed fixed-decimal strings match the server exactly
                // (6 decimals ~ 0.1 m; "+ 0.0" normalizes -0 so it never renders as "-0.000000")
                return new LocationFix
                {
                    Latitude = Math.Round(c.Point.Position.Latitude, 6) + 0.0,
                    Longitude = Math.Round(c.Point.Position.Longitude, 6) + 0.0,
                    AccuracyM = Math.Round(c.Accuracy),
                    FixedAtMs = c.Timestamp.ToUnixTimeMilliseconds()
                };
            }
            catch (Exception ex)
            {
                logger?.LogDebug(ex, "Windows Location query failed.");
                return null;
            }
        }

        /// <summary>
        /// CLI helper: `--locate [outFile]`. Writes the fix as JSON to outFile (session helper mode)
        /// or prints it to the console (manual diagnostics). Exit code 0 = fix acquired.
        /// </summary>
        public static async Task<int> RunHelperAsync(string? outFile)
        {
            var fix = await QueryGeolocatorAsync(null);
            if (fix == null)
            {
                Console.WriteLine($"No location fix. Access status: {_lastAccessStatus ?? "unknown"}. Check Settings > Privacy & security > Location.");
                return 1;
            }

            string json = JsonSerializer.Serialize(fix);
            if (string.IsNullOrEmpty(outFile))
            {
                Console.WriteLine(json);
            }
            else
            {
                await File.WriteAllTextAsync(outFile, json);
            }
            return 0;
        }
    }
}
