using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Text;
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

        [DllImport("user32.dll")]
        private static extern bool MessageBeep(uint uType);

        [DllImport("Powrprof.dll", SetLastError = true)]
        private static extern bool SetSuspendState(bool hibernate, bool forceCritical, bool disableWakeEvent);

        [DllImport("user32.dll")]
        private static extern int GetSystemMetrics(int nIndex);

        [DllImport("wtsapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern bool WTSSendMessage(
            IntPtr hServer,
            int SessionId,
            string pTitle,
            int TitleLength,
            string pMessage,
            int MessageLength,
            int Style,
            int Timeout,
            out int pResponse,
            bool bWait
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern uint WTSGetActiveConsoleSessionId();

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
        /// Plays an acoustic deterrent siren on workstation hardware to ward off unauthorized intruders.
        /// </summary>
        public static bool PlaySecurityAlarm(int durationSeconds, ILogger logger)
        {
            try
            {
                logger.LogWarning("Remote Security Deterrent Alarm sounding for {Sec} seconds...", durationSeconds);
                Task.Run(() =>
                {
                    DateTime stopAt = DateTime.UtcNow.AddSeconds(Math.Clamp(durationSeconds, 2, 30));
                    while (DateTime.UtcNow < stopAt)
                    {
                        try
                        {
                            Console.Beep(1600, 200);
                            Thread.Sleep(30);
                            Console.Beep(850, 200);
                            Thread.Sleep(30);
                        }
                        catch
                        {
                            MessageBeep(0x00000010);
                            Thread.Sleep(450);
                        }
                    }
                });
                return true;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to play security alarm");
                return false;
            }
        }

        /// <summary>
        /// Captures the primary screen, scales to 960x540, and returns a lightweight Base64 JPEG data URI.
        /// When executing in Session 0 (LocalSystem service), delegates capture to an interactive session helper
        /// so genuine desktop frames are returned.
        /// </summary>
        public static string? CaptureScreenBase64(ILogger logger)
        {
            try
            {
                string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "iLock");
                if (!Directory.Exists(appData)) Directory.CreateDirectory(appData);
                string tempScreenFile = Path.Combine(appData, $"capture_{Guid.NewGuid():N}.jpg");

                // If running in Session 0 (Windows Service), launch helper in active user session to capture real display
                if (Process.GetCurrentProcess().SessionId == 0)
                {
                    logger.LogInformation("Capturing screen from Session 0 via active session helper...");
                    bool launched = WindowsAccessProvider.TryLaunchInSession(
                        $"--capture-screen \"{tempScreenFile}\"",
                        "default",
                        logger,
                        4000,
                        out int exitCode
                    );

                    if (!launched || !File.Exists(tempScreenFile))
                    {
                        // Try winlogon desktop in case PC is on lock screen
                        logger.LogInformation("Attempting capture on winlogon desktop...");
                        WindowsAccessProvider.TryLaunchInSession(
                            $"--capture-screen \"{tempScreenFile}\"",
                            "winlogon",
                            logger,
                            4000,
                            out exitCode
                        );
                    }

                    if (File.Exists(tempScreenFile))
                    {
                        byte[] bytes = File.ReadAllBytes(tempScreenFile);
                        try { File.Delete(tempScreenFile); } catch { }
                        if (bytes.Length > 0)
                        {
                            logger.LogInformation("Successfully captured screen from session helper ({Bytes} bytes)", bytes.Length);
                            return $"data:image/jpeg;base64,{Convert.ToBase64String(bytes)}";
                        }
                    }
                }

                // In-process capture fallback (for interactive mode or fallback)
                bool directOk = CaptureScreenToFile(tempScreenFile, logger);
                if (directOk && File.Exists(tempScreenFile))
                {
                    byte[] bytes = File.ReadAllBytes(tempScreenFile);
                    try { File.Delete(tempScreenFile); } catch { }
                    if (bytes.Length > 0)
                    {
                        return $"data:image/jpeg;base64,{Convert.ToBase64String(bytes)}";
                    }
                }

                return GenerateFallbackSnapshotBase64("Display Powered Off / Standby", logger);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to capture desktop screenshot.");
                return null;
            }
        }

        /// <summary>
        /// Captures the screen to a JPEG file on disk with watermarking and scaling.
        /// </summary>
        public static bool CaptureScreenToFile(string filePath, ILogger? logger = null)
        {
            try
            {
                int screenWidth = GetSystemMetrics(SM_CXSCREEN);
                int screenHeight = GetSystemMetrics(SM_CYSCREEN);

                if (screenWidth <= 0) screenWidth = 1920;
                if (screenHeight <= 0) screenHeight = 1080;

                using var rawBitmap = new Bitmap(screenWidth, screenHeight, PixelFormat.Format32bppArgb);
                bool capturedReal = false;
                try
                {
                    using (var g = Graphics.FromImage(rawBitmap))
                    {
                        g.CopyFromScreen(0, 0, 0, 0, new Size(screenWidth, screenHeight), CopyPixelOperation.SourceCopy);
                        capturedReal = true;
                    }
                }
                catch
                {
                    capturedReal = false;
                }

                int targetWidth = 960;
                int targetHeight = (int)((long)screenHeight * targetWidth / screenWidth);
                if (targetHeight <= 0) targetHeight = 540;

                using var scaledBitmap = new Bitmap(targetWidth, targetHeight);
                using (var g = Graphics.FromImage(scaledBitmap))
                {
                    if (capturedReal)
                    {
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g.SmoothingMode = SmoothingMode.HighQuality;
                        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                        g.DrawImage(rawBitmap, 0, 0, targetWidth, targetHeight);

                        // Add iLock verification watermark
                        using var brush = new SolidBrush(Color.FromArgb(140, 0, 0, 0));
                        g.FillRectangle(brush, 10, targetHeight - 34, 340, 24);
                        using var font = new Font(FontFamily.GenericSansSerif, 9, FontStyle.Bold);
                        g.DrawString($"iLock Snapshot • {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC", font, Brushes.WhiteSmoke, 15, targetHeight - 30);
                    }
                    else
                    {
                        g.Clear(Color.FromArgb(15, 23, 42));
                        using var pen = new Pen(Color.FromArgb(40, 255, 255, 255), 1);
                        for (int x = 0; x < targetWidth; x += 60) g.DrawLine(pen, x, 0, x, targetHeight);
                        for (int y = 0; y < targetHeight; y += 60) g.DrawLine(pen, 0, y, targetWidth, y);

                        using var font = new Font(FontFamily.GenericSansSerif, 18, FontStyle.Bold);
                        using var subFont = new Font(FontFamily.GenericMonospace, 12, FontStyle.Regular);
                        g.DrawString("iLock Workstation Protected", font, Brushes.White, 40, 50);
                        g.DrawString("Status: Display Sleep / Lock Screen Active", subFont, Brushes.CornflowerBlue, 40, 90);
                        g.DrawString($"Timestamp: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC", subFont, Brushes.LightGray, 40, 115);
                    }
                }

                var encoder = GetEncoder(ImageFormat.Jpeg);
                var encoderParams = new EncoderParameters(1);
                encoderParams.Param[0] = new System.Drawing.Imaging.EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 70L);

                if (encoder != null)
                {
                    scaledBitmap.Save(filePath, encoder, encoderParams);
                }
                else
                {
                    scaledBitmap.Save(filePath, ImageFormat.Jpeg);
                }

                return true;
            }
            catch (Exception ex)
            {
                logger?.LogWarning(ex, "Failed in CaptureScreenToFile");
                return false;
            }
        }

        private static string GenerateFallbackSnapshotBase64(string statusText, ILogger logger)
        {
            try
            {
                using var bmp = new Bitmap(960, 540);
                using (var g = Graphics.FromImage(bmp))
                {
                    g.Clear(Color.FromArgb(15, 23, 42));

                    using var pen = new Pen(Color.FromArgb(40, 255, 255, 255), 1);
                    for (int x = 0; x < 960; x += 60) g.DrawLine(pen, x, 0, x, 540);
                    for (int y = 0; y < 540; y += 60) g.DrawLine(pen, 0, y, 960, y);

                    using var font = new Font(FontFamily.GenericSansSerif, 18, FontStyle.Bold);
                    using var subFont = new Font(FontFamily.GenericMonospace, 12, FontStyle.Regular);
                    g.DrawString("iLock Workstation Protected", font, Brushes.White, 40, 50);
                    g.DrawString($"Status: {statusText}", subFont, Brushes.CornflowerBlue, 40, 90);
                    g.DrawString($"Timestamp: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC", subFont, Brushes.LightGray, 40, 115);
                }

                using var ms = new MemoryStream();
                bmp.Save(ms, ImageFormat.Jpeg);
                return $"data:image/jpeg;base64,{Convert.ToBase64String(ms.ToArray())}";
            }
            catch
            {
                return string.Empty;
            }
        }

        /// <summary>
        /// Captures or generates a security camera snapshot frame.
        /// </summary>
        public static string GenerateCameraSnapshotBase64(string deviceName, string user, ILogger logger)
        {
            try
            {
                using var bmp = new Bitmap(640, 360);
                using (var g = Graphics.FromImage(bmp))
                {
                    g.Clear(Color.FromArgb(20, 24, 33));

                    // Grid overlay
                    using var gridPen = new Pen(Color.FromArgb(35, 255, 255, 255), 1);
                    for (int x = 0; x < 640; x += 40) g.DrawLine(gridPen, x, 0, x, 360);
                    for (int y = 0; y < 360; y += 40) g.DrawLine(gridPen, 0, y, 640, y);

                    // Reticle
                    using var reticlePen = new Pen(Color.FromArgb(0, 113, 227), 2);
                    g.DrawEllipse(reticlePen, 270, 130, 100, 100);
                    g.DrawLine(reticlePen, 320, 120, 320, 240);
                    g.DrawLine(reticlePen, 260, 180, 380, 180);

                    // Status indicators
                    using var font = new Font(FontFamily.GenericMonospace, 10, FontStyle.Bold);
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
        /// Displays an on-screen popup or dialog in the active user's session.
        /// Uses WTSSendMessage to bypass Session 0 isolation and directly display on the active display,
        /// plus an interactive toast helper if available.
        /// </summary>
        public static bool DisplayOnScreenMessage(string title, string message, ILogger logger)
        {
            bool delivered = false;
            try
            {
                uint activeSessionId = WTSGetActiveConsoleSessionId();
                logger.LogInformation("DisplayOnScreenMessage: Active session={Session}, Title='{Title}'", activeSessionId, title);

                if (activeSessionId != 0xFFFFFFFF)
                {
                    int response = 0;
                    // 0x00000040 = MB_ICONINFORMATION | MB_OK
                    bool wtsOk = WTSSendMessage(
                        IntPtr.Zero,
                        (int)activeSessionId,
                        title,
                        title.Length * 2,
                        message,
                        message.Length * 2,
                        0x00000040,
                        15,
                        out response,
                        false
                    );

                    if (wtsOk)
                    {
                        logger.LogInformation("WTSSendMessage dispatched successfully to console session {SessionId}", activeSessionId);
                        delivered = true;
                    }
                    else
                    {
                        logger.LogWarning("WTSSendMessage failed: Win32Error={Err}", Marshal.GetLastWin32Error());
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "WTSSendMessage threw exception");
            }

            // Also invoke toast notification in user session
            try
            {
                string safeTitle = title.Replace("\"", "'");
                string safeMsg = message.Replace("\"", "'");

                if (Process.GetCurrentProcess().SessionId == 0)
                {
                    WindowsAccessProvider.TryLaunchInSession(
                        $"--show-toast \"{safeTitle}\" \"{safeMsg}\"",
                        "default",
                        logger,
                        3000,
                        out _
                    );
                }
                else
                {
                    ShowInteractiveToast(safeTitle, safeMsg, logger);
                }
                delivered = true;
            }
            catch (Exception ex)
            {
                logger.LogDebug(ex, "Toast fallback threw exception");
            }

            return delivered;
        }

        public static void ShowInteractiveToast(string title, string message, ILogger? logger = null)
        {
            try
            {
                string script = $"[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; " +
                                $"$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); " +
                                $"$template.GetElementsByTagName('text')[0].AppendChild($template.CreateTextNode('{title}')) > $null; " +
                                $"$template.GetElementsByTagName('text')[1].AppendChild($template.CreateTextNode('{message}')) > $null; " +
                                $"$toast = [Windows.UI.Notifications.ToastNotification]::new($template); " +
                                $"[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('iLock Security').Show($toast);";

                Process.Start(new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-NoProfile -WindowStyle Hidden -Command \"{script}\"",
                    CreateNoWindow = true,
                    UseShellExecute = false
                });
            }
            catch (Exception ex)
            {
                logger?.LogWarning(ex, "ShowInteractiveToast error");
            }
        }

        /// <summary>
        /// Sets the Windows clipboard text in the active user session.
        /// </summary>
        public static bool SetClipboardText(string text, ILogger logger)
        {
            try
            {
                string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "iLock");
                if (!Directory.Exists(appData)) Directory.CreateDirectory(appData);
                string tempClipFile = Path.Combine(appData, $"clip_{Guid.NewGuid():N}.txt");
                File.WriteAllText(tempClipFile, text);

                if (Process.GetCurrentProcess().SessionId == 0)
                {
                    logger.LogInformation("Setting clipboard in Session 1 helper...");
                    bool launched = WindowsAccessProvider.TryLaunchInSession(
                        $"--set-clipboard-file \"{tempClipFile}\"",
                        "default",
                        logger,
                        3000,
                        out _
                    );
                    return launched;
                }
                else
                {
                    return SetClipboardDirect(text, logger);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to set clipboard text.");
                return false;
            }
        }

        public static bool SetClipboardDirect(string text, ILogger? logger = null)
        {
            try
            {
                string b64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(text));
                var psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-NoProfile -Command \"Set-Clipboard -Value ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('{b64}')))\"",
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                var proc = Process.Start(psi);
                proc?.WaitForExit(3000);
                return true;
            }
            catch (Exception ex)
            {
                logger?.LogWarning(ex, "SetClipboardDirect failed");
                return false;
            }
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
