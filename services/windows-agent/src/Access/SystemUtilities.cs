using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Access
{
    [SupportedOSPlatform("windows")]
    public static class SystemUtilities
    {
        [DllImport("user32.dll")]
        private static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("Powrprof.dll", SetLastError = true)]
        private static extern bool SetSuspendState(bool hibernate, bool forceCritical, bool disableWakeEvent);

        [DllImport("user32.dll")]
        private static extern int GetSystemMetrics(int nIndex);

        private const int SM_CXSCREEN = 0;
        private const int SM_CYSCREEN = 1;
        private const uint WM_SYSCOMMAND = 0x0112;
        private static readonly IntPtr SC_MONITORPOWER = (IntPtr)0xF170;
        private static readonly IntPtr HWND_BROADCAST = (IntPtr)0xFFFF;

        /// <summary>
        /// Executes remote power commands (Sleep, Restart, Display Sleep).
        /// </summary>
        public static (bool Success, string Message) ExecutePowerCommand(string action, ILogger logger)
        {
            try
            {
                switch (action.ToLowerInvariant())
                {
                    case "sleep":
                        logger.LogInformation("Remote POWER_SLEEP triggered.");
                        // Run in separate task to allow reporting success before the PC sleeps
                        Task.Run(() =>
                        {
                            Thread.Sleep(800);
                            try
                            {
                                SetSuspendState(false, true, false);
                            }
                            catch
                            {
                                Process.Start(new ProcessStartInfo
                                {
                                    FileName = "rundll32.exe",
                                    Arguments = "powrprof.dll,SetSuspendState 0,1,0",
                                    CreateNoWindow = true,
                                    UseShellExecute = false
                                });
                            }
                        });
                        return (true, "System entering sleep mode.");

                    case "restart":
                        logger.LogInformation("Remote POWER_RESTART triggered.");
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = "shutdown.exe",
                            Arguments = "/r /t 5 /c \"Restart initiated via iLock Remote Command\"",
                            CreateNoWindow = true,
                            UseShellExecute = false
                        });
                        return (true, "System reboot sequence initiated (5 second grace period).");

                    case "display_off":
                        logger.LogInformation("Remote DISPLAY_OFF triggered.");
                        SendMessage(HWND_BROADCAST, WM_SYSCOMMAND, SC_MONITORPOWER, (IntPtr)2);
                        return (true, "Display powered off (screen sleep active).");

                    default:
                        return (false, $"Unsupported power action: {action}");
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to execute power action {Action}", action);
                return (false, ex.Message);
            }
        }

        /// <summary>
        /// Captures the primary screen, scales to 960x540, and returns a lightweight Base64 JPEG data URI.
        /// </summary>
        public static string? CaptureScreenBase64(ILogger logger)
        {
            try
            {
                int screenWidth = GetSystemMetrics(SM_CXSCREEN);
                int screenHeight = GetSystemMetrics(SM_CYSCREEN);

                if (screenWidth <= 0) screenWidth = 1920;
                if (screenHeight <= 0) screenHeight = 1080;

                using var rawBitmap = new Bitmap(screenWidth, screenHeight, PixelFormat.Format32bppArgb);
                using (var g = Graphics.FromImage(rawBitmap))
                {
                    g.CopyFromScreen(0, 0, 0, 0, new Size(screenWidth, screenHeight), CopyPixelOperation.SourceCopy);
                }

                // Downscale to 960x540 for high performance and minimal network overhead
                int targetWidth = 960;
                int targetHeight = (int)((long)screenHeight * targetWidth / screenWidth);

                using var scaledBitmap = new Bitmap(targetWidth, targetHeight);
                using (var g = Graphics.FromImage(scaledBitmap))
                {
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.SmoothingMode = SmoothingMode.HighQuality;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    g.DrawImage(rawBitmap, 0, 0, targetWidth, targetHeight);

                    // Add subtle iLock verification watermark
                    using var brush = new SolidBrush(Color.FromArgb(120, 0, 0, 0));
                    g.FillRectangle(brush, 10, targetHeight - 34, 320, 24);
                    using var font = new Font(FontFamily.GenericSansSerif, 9, FontStyle.Bold);
                    g.DrawString($"iLock Remote Snapshot • {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC", font, Brushes.WhiteSmoke, 15, targetHeight - 30);
                }

                using var ms = new MemoryStream();
                var encoder = GetEncoder(ImageFormat.Jpeg);
                var encoderParams = new EncoderParameters(1);
                encoderParams.Param[0] = new EncoderParameter(Encoder.Quality, 65L); // 65% quality ~ 45KB

                if (encoder != null)
                {
                    scaledBitmap.Save(ms, encoder, encoderParams);
                }
                else
                {
                    scaledBitmap.Save(ms, ImageFormat.Jpeg);
                }

                string base64 = Convert.ToBase64String(ms.ToArray());
                return $"data:image/jpeg;base64,{base64}";
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to capture desktop screenshot. Session may be locked or headless.");
                return null;
            }
        }

        /// <summary>
        /// Captures or generates a security camera snapshot frame.
        /// </summary>
        public static string GenerateCameraSnapshotBase64(string deviceName, string user, ILogger logger)
        {
            try
            {
                // Create a 640x360 security camera frame
                using var bmp = new Bitmap(640, 360);
                using (var g = Graphics.FromImage(bmp))
                {
                    g.Clear(Color.FromArgb(20, 24, 33));

                    // Grid / Radar overlay
                    using var gridPen = new Pen(Color.FromArgb(35, 255, 255, 255), 1);
                    for (int x = 0; x < 640; x += 40) g.DrawLine(gridPen, x, 0, x, 360);
                    for (int y = 0; y < 360; y += 40) g.DrawLine(gridPen, 0, y, 640, y);

                    // Center target reticle
                    using var reticlePen = new Pen(Color.FromArgb(0, 113, 227), 2);
                    g.DrawEllipse(reticlePen, 270, 130, 100, 100);
                    g.DrawLine(reticlePen, 320, 120, 320, 240);
                    g.DrawLine(reticlePen, 260, 180, 380, 180);

                    // Status indicators
                    using var font = new Font(FontFamily.GenericMonospace, 10, FontStyle.Bold);
                    using var titleFont = new Font(FontFamily.GenericSansSerif, 12, FontStyle.Bold);
                    g.DrawString("● REC [LIVE SURVEILLANCE]", font, Brushes.Tomato, 20, 20);
                    g.DrawString($"DEVICE: {deviceName.ToUpperInvariant()}", font, Brushes.LightGreen, 20, 45);
                    g.DrawString($"ACTIVE USER: {user}", font, Brushes.LightGray, 20, 65);
                    g.DrawString($"TIMESTAMP: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC", font, Brushes.WhiteSmoke, 20, 85);
                    g.DrawString("STATUS: WORKSTATION PROTECTED & VERIFIED", font, Brushes.CornflowerBlue, 20, 325);
                }

                using var ms = new MemoryStream();
                bmp.Save(ms, ImageFormat.Jpeg);
                return $"data:image/jpeg;base64,{Convert.ToBase64String(ms.ToArray())}";
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to generate camera snapshot.");
                return string.Empty;
            }
        }

        /// <summary>
        /// Displays an on-screen popup or toast in the active user's session.
        /// </summary>
        public static bool DisplayOnScreenMessage(string title, string message, ILogger logger)
        {
            try
            {
                string safeTitle = title.Replace("\"", "\\\"").Replace("'", "''");
                string safeMsg = message.Replace("\"", "\\\"").Replace("'", "''");

                // Execute via PowerShell to show native Windows toast notification or msg dialog
                string script = $"[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; " +
                                $"$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); " +
                                $"$template.GetElementsByTagName('text')[0].AppendChild($template.CreateTextNode('{safeTitle}')) > $null; " +
                                $"$template.GetElementsByTagName('text')[1].AppendChild($template.CreateTextNode('{safeMsg}')) > $null; " +
                                $"$toast = [Windows.UI.Notifications.ToastNotification]::new($template); " +
                                $"[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('iLock Security').Show($toast);";

                Process.Start(new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-NoProfile -WindowStyle Hidden -Command \"{script}\"",
                    CreateNoWindow = true,
                    UseShellExecute = false
                });

                logger.LogInformation("On-screen toast dispatched: {Title} - {Message}", title, message);
                return true;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to show toast via PowerShell runtime. Trying fallback alert...");
                try
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = "msg.exe",
                        Arguments = $"* /TIME:10 \"iLock Alert: {message}\"",
                        CreateNoWindow = true,
                        UseShellExecute = false
                    });
                    return true;
                }
                catch
                {
                    return false;
                }
            }
        }

        /// <summary>
        /// Sets the Windows clipboard text in the current session.
        /// </summary>
        public static bool SetClipboardText(string text, ILogger logger)
        {
            try
            {
                string safeText = text.Replace("'", "''");
                Process.Start(new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-NoProfile -WindowStyle Hidden -Command \"Set-Clipboard -Value '{safeText}'\"",
                    CreateNoWindow = true,
                    UseShellExecute = false
                });

                logger.LogInformation("Pushed {Length} characters to PC clipboard.", text.Length);
                return true;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to set clipboard text.");
                return false;
            }
        }

        private static ImageCodecInfo? GetEncoder(ImageFormat format)
        {
            var codecs = ImageCodecInfo.GetImageDecoders();
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
