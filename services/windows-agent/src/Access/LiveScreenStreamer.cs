using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Access
{
    [SupportedOSPlatform("windows")]
    public class LiveScreenStreamer
    {
        public static LiveScreenStreamer Instance { get; } = new LiveScreenStreamer();

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

        [DllImport("user32.dll")]
        private static extern int GetSystemMetrics(int nIndex);

        [DllImport("user32.dll")]
        private static extern bool GetCursorPos(out POINT lpPoint);

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;
        }

        private const int SM_CXSCREEN = 0;
        private const int SM_CYSCREEN = 1;

        private readonly object _lock = new();
        private CancellationTokenSource? _streamCts;
        private DateTime _lastPingUtc = DateTime.UtcNow;
        private string? _currentSessionId;
        private bool _isStreaming = false;

        public bool IsStreaming
        {
            get { lock (_lock) return _isStreaming; }
        }

        public void Start(
            string deviceUuid,
            string backendUrl,
            string authToken,
            string streamSessionId,
            int targetFps = 4,
            string quality = "balanced",
            ILogger? logger = null)
        {
            lock (_lock)
            {
                if (_isStreaming)
                {
                    logger?.LogInformation("Live screen stream already active for session {Session}. Refreshing keep-alive.", _currentSessionId);
                    _lastPingUtc = DateTime.UtcNow;
                    return;
                }

                _isStreaming = true;
                _currentSessionId = streamSessionId;
                _lastPingUtc = DateTime.UtcNow;
                _streamCts = new CancellationTokenSource();

                logger?.LogInformation("Starting on-demand live screen sharing: Device={Uuid}, Session={Session}, Quality={Quality}, FPS={Fps}",
                    deviceUuid, streamSessionId, quality, targetFps);

                string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "iLock");
                if (!Directory.Exists(appData)) Directory.CreateDirectory(appData);
                string flagPath = Path.Combine(appData, "stream_active.flag");
                File.WriteAllText(flagPath, $"{streamSessionId}|{DateTime.UtcNow:O}");

                if (Process.GetCurrentProcess().SessionId == 0)
                {
                    // Running as SYSTEM Service in Session 0:
                    // Delegate capture loop to stream helper in the active user console session
                    logger?.LogInformation("Launching live screen stream helper in active console session...");
                    Task.Run(() =>
                    {
                        string exePath = Process.GetCurrentProcess().MainModule?.FileName ?? "ILock.WindowsAgent.exe";
                        string args = $"--stream-helper \"{deviceUuid}\" \"{backendUrl}\" \"{authToken}\" \"{streamSessionId}\"";
                        WindowsAccessProvider.TryLaunchInSession(args, "default", logger ?? LoggerFactory.Create(b => b.AddConsole()).CreateLogger("Stream"), 600000, out _);
                        lock (_lock)
                        {
                            _isStreaming = false;
                        }
                    });
                }
                else
                {
                    // Interactive mode (direct execution)
                    var token = _streamCts.Token;
                    Task.Run(() => RunStreamLoop(deviceUuid, backendUrl, authToken, streamSessionId, targetFps, quality, logger, token));
                }
            }
        }

        public void KeepAlive()
        {
            lock (_lock)
            {
                _lastPingUtc = DateTime.UtcNow;
                string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "iLock");
                string pingFlag = Path.Combine(appData, "stream_ping.flag");
                try
                {
                    File.WriteAllText(pingFlag, DateTime.UtcNow.ToString("O"));
                }
                catch { }
            }
        }

        public void Stop(ILogger? logger = null)
        {
            lock (_lock)
            {
                if (!_isStreaming) return;

                logger?.LogInformation("Stopping on-demand live screen stream. Battery-saver activated.");
                _isStreaming = false;
                _currentSessionId = null;

                try
                {
                    _streamCts?.Cancel();
                    _streamCts?.Dispose();
                    _streamCts = null;
                }
                catch { }

                try
                {
                    string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "iLock");
                    string flagPath = Path.Combine(appData, "stream_active.flag");
                    if (File.Exists(flagPath)) File.Delete(flagPath);
                }
                catch { }
            }
        }

        /// <summary>
        /// Captures and streams frames at the specified FPS directly to the cloud backend.
        /// Automatically terminates if no viewer keep-alive is received within 25 seconds.
        /// </summary>
        public static void RunStreamLoop(
            string deviceUuid,
            string backendUrl,
            string authToken,
            string streamSessionId,
            int targetFps = 4,
            string quality = "balanced",
            ILogger? logger = null,
            CancellationToken ct = default)
        {
            string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "iLock");
            string flagPath = Path.Combine(appData, "stream_active.flag");
            string pingPath = Path.Combine(appData, "stream_ping.flag");

            using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            if (!string.IsNullOrEmpty(authToken))
            {
                httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", authToken);
            }

            int targetWidth = 960;
            int targetHeight = 540;
            long jpegQuality = 55L;

            if (quality == "performance")
            {
                targetWidth = 640;
                targetHeight = 360;
                jpegQuality = 45L;
            }
            else if (quality == "high")
            {
                targetWidth = 1280;
                targetHeight = 720;
                jpegQuality = 70L;
            }

            int intervalMs = Math.Max(100, 1000 / Math.Clamp(targetFps, 1, 15));
            DateTime lastPingReceivedUtc = DateTime.UtcNow;
            DateTime streamStartTimeUtc = DateTime.UtcNow;
            var maxDuration = TimeSpan.FromMinutes(10); // Absolute safety limit
            var stopwatch = new Stopwatch();

            logger?.LogInformation("RunStreamLoop running: Resolution={W}x{H}, TargetInterval={Ms}ms", targetWidth, targetHeight, intervalMs);

            while (!ct.IsCancellationRequested)
            {
                // Check stop flag
                if (!File.Exists(flagPath))
                {
                    logger?.LogInformation("Stream active flag removed. Stream loop exiting.");
                    break;
                }

                // Check ping file for updates from the service
                if (File.Exists(pingPath))
                {
                    try
                    {
                        var lastWrite = File.GetLastWriteTimeUtc(pingPath);
                        if (lastWrite > lastPingReceivedUtc)
                        {
                            lastPingReceivedUtc = lastWrite;
                        }
                    }
                    catch { }
                }

                // BATTERY-SAVER WATCHDOG:
                // If 25 seconds elapse without a viewer ping from the phone, shut down automatically!
                if (DateTime.UtcNow - lastPingReceivedUtc > TimeSpan.FromSeconds(25))
                {
                    logger?.LogWarning("[BATTERY-SAVER] No viewer ping received in 25s. Workstation stream auto-stopping to preserve battery.");
                    try { File.Delete(flagPath); } catch { }
                    break;
                }

                // Max duration safety guard
                if (DateTime.UtcNow - streamStartTimeUtc > maxDuration)
                {
                    logger?.LogInformation("Max stream session duration reached. Auto-stopping.");
                    try { File.Delete(flagPath); } catch { }
                    break;
                }

                stopwatch.Restart();

                try
                {
                    // 1. Get active foreground window title
                    string activeWindow = "Windows Desktop";
                    IntPtr fgHwnd = GetForegroundWindow();
                    if (fgHwnd != IntPtr.Zero)
                    {
                        var sb = new StringBuilder(256);
                        if (GetWindowText(fgHwnd, sb, sb.Capacity) > 0)
                        {
                            activeWindow = sb.ToString().Trim();
                        }
                    }

                    // 2. Get mouse position
                    GetCursorPos(out POINT cursorPt);

                    // 3. Capture screen frame
                    int screenWidth = GetSystemMetrics(SM_CXSCREEN);
                    int screenHeight = GetSystemMetrics(SM_CYSCREEN);
                    if (screenWidth <= 0) screenWidth = 1920;
                    if (screenHeight <= 0) screenHeight = 1080;

                    using var rawBitmap = new Bitmap(screenWidth, screenHeight, PixelFormat.Format32bppArgb);
                    using (var g = Graphics.FromImage(rawBitmap))
                    {
                        g.CopyFromScreen(0, 0, 0, 0, new Size(screenWidth, screenHeight), CopyPixelOperation.SourceCopy);

                        // Draw mouse cursor position indicator
                        using var cursorBrush = new SolidBrush(Color.FromArgb(180, 0, 229, 255));
                        using var cursorPen = new Pen(Color.White, 2);
                        g.FillEllipse(cursorBrush, cursorPt.X - 6, cursorPt.Y - 6, 12, 12);
                        g.DrawEllipse(cursorPen, cursorPt.X - 6, cursorPt.Y - 6, 12, 12);
                    }

                    // 4. Scale to balanced stream resolution
                    int scaledHeight = (int)((long)screenHeight * targetWidth / screenWidth);
                    if (scaledHeight <= 0) scaledHeight = targetHeight;

                    using var scaledBitmap = new Bitmap(targetWidth, scaledHeight);
                    using (var g = Graphics.FromImage(scaledBitmap))
                    {
                        g.InterpolationMode = InterpolationMode.Bilinear;
                        g.SmoothingMode = SmoothingMode.HighSpeed;
                        g.PixelOffsetMode = PixelOffsetMode.HighSpeed;
                        g.DrawImage(rawBitmap, 0, 0, targetWidth, scaledHeight);
                    }

                    // 5. Compress to lightweight JPEG memory stream
                    using var ms = new MemoryStream();
                    var encoder = GetEncoder(ImageFormat.Jpeg);
                    var encoderParams = new EncoderParameters(1);
                    encoderParams.Param[0] = new System.Drawing.Imaging.EncoderParameter(System.Drawing.Imaging.Encoder.Quality, jpegQuality);

                    if (encoder != null)
                    {
                        scaledBitmap.Save(ms, encoder, encoderParams);
                    }
                    else
                    {
                        scaledBitmap.Save(ms, ImageFormat.Jpeg);
                    }

                    string frameBase64 = $"data:image/jpeg;base64,{Convert.ToBase64String(ms.ToArray())}";

                    // 6. Transmit frame payload to cloud endpoint
                    var payload = new
                    {
                        frameBase64,
                        timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                        fps = targetFps,
                        activeWindow,
                        mouseX = cursorPt.X,
                        mouseY = cursorPt.Y,
                        streamSessionId,
                    };

                    string json = JsonSerializer.Serialize(payload);
                    using var content = new StringContent(json, Encoding.UTF8, "application/json");

                    string endpoint = $"{backendUrl.TrimEnd('/')}/api/devices/{deviceUuid}/stream/frame";
                    var response = httpClient.PostAsync(endpoint, content).GetAwaiter().GetResult();
                }
                catch (Exception ex)
                {
                    logger?.LogDebug("Frame stream exception: {Message}", ex.Message);
                }

                stopwatch.Stop();
                int elapsed = (int)stopwatch.ElapsedMilliseconds;
                int sleepMs = Math.Max(30, intervalMs - elapsed);
                Thread.Sleep(sleepMs);
            }

            try
            {
                if (File.Exists(flagPath)) File.Delete(flagPath);
                if (File.Exists(pingPath)) File.Delete(pingPath);
            }
            catch { }
            logger?.LogInformation("Live screen stream loop finished cleanly. Workstation idle.");
        }

        private static ImageCodecInfo? GetEncoder(ImageFormat format)
        {
            var codecs = ImageCodecInfo.GetImageEncoders();
            foreach (var codec in codecs)
            {
                if (codec.FormatID == format.Guid)
                {
                    return codec;
                }
            }
            return null;
        }
    }
}
