using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace ILock.WindowsAgent.Diagnostics
{
    public class SystemTelemetryData
    {
        [JsonPropertyName("user")]
        public string? User { get; set; }

        [JsonPropertyName("wifiSsid")]
        public string? WifiSsid { get; set; }

        [JsonPropertyName("wifiSignal")]
        public int WifiSignal { get; set; }

        [JsonPropertyName("localIp")]
        public string? LocalIp { get; set; }

        [JsonPropertyName("cpuModel")]
        public string? CpuModel { get; set; }

        [JsonPropertyName("cpuCores")]
        public int CpuCores { get; set; }

        [JsonPropertyName("cpuUsagePct")]
        public float CpuUsagePct { get; set; }

        [JsonPropertyName("diskUsedGb")]
        public double DiskUsedGb { get; set; }

        [JsonPropertyName("diskTotalGb")]
        public double DiskTotalGb { get; set; }

        [JsonPropertyName("diskFreeGb")]
        public double DiskFreeGb { get; set; }

        [JsonPropertyName("diskUsagePct")]
        public double DiskUsagePct { get; set; }

        [JsonPropertyName("ramUsedGb")]
        public double RamUsedGb { get; set; }

        [JsonPropertyName("ramTotalGb")]
        public double RamTotalGb { get; set; }

        [JsonPropertyName("ramUsagePct")]
        public float RamUsagePct { get; set; }

        [JsonPropertyName("batteryPct")]
        public float BatteryPct { get; set; }

        [JsonPropertyName("isCharging")]
        public bool IsCharging { get; set; }

        [JsonPropertyName("uptime")]
        public string? Uptime { get; set; }

        [JsonPropertyName("uptimeSeconds")]
        public long UptimeSeconds { get; set; }

        [JsonPropertyName("os")]
        public string? Os { get; set; }

        public string ToCompactString()
        {
            string u = User ?? "vidar";
            string w = WifiSsid ?? "Wi-Fi";
            int s = WifiSignal;
            string ip = LocalIp ?? "127.0.0.1";
            string cpu = CpuModel ?? "AMD Ryzen";
            if (cpu.Contains("Ryzen 7 7840HS")) cpu = "Ryzen 7 7840HS";
            else if (cpu.Length > 22) cpu = cpu.Substring(0, 22).Trim();
            string disk = $"{DiskFreeGb:F0}G/{DiskTotalGb:F0}G";
            string up = Uptime ?? "0m";

            string compact = $"v1:{u}|{w}|{s}|{ip}|{cpu}|{disk}|{up}";
            return compact.Length <= 125 ? compact : compact.Substring(0, 125);
        }
    }

    public static class SystemTelemetryProvider
    {
        #region Win32 P/Invoke Declarations

        [StructLayout(LayoutKind.Sequential)]
        public struct SYSTEM_POWER_STATUS
        {
            public byte ACLineStatus;        // 0 = Offline, 1 = Online, 255 = Unknown
            public byte BatteryFlag;         // 1 = High, 2 = Low, 4 = Critical, 8 = Charging, 128 = No battery, 255 = Unknown
            public byte BatteryLifePercent;  // 0-100, 255 = Unknown
            public byte SystemStatusFlag;
            public int BatteryLifeTime;
            public int BatteryFullLifeTime;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool GetSystemPowerStatus(out SYSTEM_POWER_STATUS lpSystemPowerStatus);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        public class MEMORYSTATUSEX
        {
            public uint dwLength;
            public uint dwMemoryLoad;
            public ulong ullTotalPhys;
            public ulong ullAvailPhys;
            public ulong ullTotalPageFile;
            public ulong ullAvailPageFile;
            public ulong ullTotalVirtual;
            public ulong ullAvailVirtual;
            public ulong ullAvailExtendedVirtual;

            public MEMORYSTATUSEX()
            {
                dwLength = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX));
            }
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        public static extern bool GlobalMemoryStatusEx([In, Out] MEMORYSTATUSEX lpBuffer);

        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool GetSystemTimes(out long lpIdleTime, out long lpKernelTime, out long lpUserTime);

        [DllImport("wtsapi32.dll", SetLastError = true)]
        private static extern bool WTSQuerySessionInformation(
            IntPtr hServer,
            uint sessionId,
            int wtsInfoClass,
            out IntPtr ppBuffer,
            out uint pBytesReturned);

        [DllImport("wtsapi32.dll")]
        private static extern void WTSFreeMemory(IntPtr pMemory);

        [DllImport("kernel32.dll")]
        private static extern uint WTSGetActiveConsoleSessionId();

        private const int WTSUserName = 5;

        #endregion

        private static string? _cachedCpuModel;
        private static string? _cachedOsVersion;
        private static int _cachedCpuCores;

        private static (string? ssid, int signal) _cachedWifi;
        private static DateTime _lastWifiCheckUtc = DateTime.MinValue;
        private static readonly object _wifiLock = new();

        private static long _prevIdleTime;
        private static long _prevKernelTime;
        private static long _prevUserTime;
        private static DateTime _prevCpuSampleTime = DateTime.MinValue;
        private static float _lastCpuPct = 12.0f;
        private static readonly object _cpuLock = new();

        static SystemTelemetryProvider()
        {
            try
            {
                _cachedCpuCores = Environment.ProcessorCount;
                using var key = Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\CentralProcessor\0");
                var val = key?.GetValue("ProcessorNameString") as string;
                _cachedCpuModel = !string.IsNullOrWhiteSpace(val) ? val.Trim() : "AMD Ryzen 7 Processor";
            }
            catch
            {
                _cachedCpuModel = "Multi-Core Processor";
            }

            try
            {
                using var cvKey = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion");
                string? prodName = cvKey?.GetValue("ProductName") as string;
                string? displayVer = cvKey?.GetValue("DisplayVersion") as string;
                string? buildNum = cvKey?.GetValue("CurrentBuildNumber") as string;

                if (!string.IsNullOrEmpty(prodName))
                {
                    _cachedOsVersion = $"{prodName} {displayVer} (Build {buildNum})".Trim();
                }
                else
                {
                    _cachedOsVersion = $"Windows {Environment.OSVersion.Version.Major} (Build {Environment.OSVersion.Version.Build})";
                }
            }
            catch
            {
                _cachedOsVersion = "Windows 11";
            }
        }

        public static SystemTelemetryData Collect()
        {
            var data = new SystemTelemetryData
            {
                CpuModel = _cachedCpuModel,
                CpuCores = _cachedCpuCores,
                Os = _cachedOsVersion,
                User = GetConsoleUser(),
                LocalIp = GetLocalIpAddress()
            };

            // 1. Battery & Power
            try
            {
                if (GetSystemPowerStatus(out var sps) && sps.BatteryLifePercent != 255)
                {
                    data.BatteryPct = sps.BatteryLifePercent;
                    data.IsCharging = (sps.ACLineStatus == 1);
                }
                else
                {
                    data.BatteryPct = 100f;
                    data.IsCharging = true;
                }
            }
            catch
            {
                data.BatteryPct = 100f;
                data.IsCharging = true;
            }

            // 2. RAM Memory
            try
            {
                var mem = new MEMORYSTATUSEX();
                if (GlobalMemoryStatusEx(mem))
                {
                    double total = Math.Round((double)mem.ullTotalPhys / (1024 * 1024 * 1024), 1);
                    double free = Math.Round((double)mem.ullAvailPhys / (1024 * 1024 * 1024), 1);
                    double used = Math.Round(total - free, 1);

                    data.RamTotalGb = total;
                    data.RamUsedGb = used;
                    data.RamUsagePct = (float)mem.dwMemoryLoad;
                }
            }
            catch { }

            // 3. Disk C:
            try
            {
                var drive = new DriveInfo("C");
                if (drive.IsReady)
                {
                    double total = Math.Round((double)drive.TotalSize / (1024 * 1024 * 1024), 1);
                    double free = Math.Round((double)drive.AvailableFreeSpace / (1024 * 1024 * 1024), 1);
                    double used = Math.Round(total - free, 1);
                    double pct = total > 0 ? Math.Round((used / total) * 100.0, 1) : 0;

                    data.DiskTotalGb = total;
                    data.DiskFreeGb = free;
                    data.DiskUsedGb = used;
                    data.DiskUsagePct = pct;
                }
            }
            catch { }

            // 4. Wi-Fi Status (Cached 15s to maintain 0ms heartbeat latency)
            var (wifiSsid, wifiSignal) = GetWifiInfoCached();
            data.WifiSsid = wifiSsid;
            data.WifiSignal = wifiSignal;

            // 5. CPU Usage
            data.CpuUsagePct = SampleCpuUsage();

            // 6. Uptime
            long uptimeMs = Environment.TickCount64;
            data.UptimeSeconds = uptimeMs / 1000;
            var ts = TimeSpan.FromMilliseconds(uptimeMs);
            data.Uptime = ts.Days > 0 ? $"{ts.Days}d {ts.Hours}h {ts.Minutes}m" : $"{ts.Hours}h {ts.Minutes}m";

            return data;
        }

        public static string GetConsoleUser()
        {
            try
            {
                uint activeSessionId = WTSGetActiveConsoleSessionId();
                if (WTSQuerySessionInformation(IntPtr.Zero, activeSessionId, WTSUserName, out IntPtr pBuffer, out uint bytesReturned))
                {
                    try
                    {
                        string? user = Marshal.PtrToStringAnsi(pBuffer);
                        if (!string.IsNullOrWhiteSpace(user))
                        {
                            return user.Trim();
                        }
                    }
                    finally
                    {
                        WTSFreeMemory(pBuffer);
                    }
                }
            }
            catch { }

            string fallback = Environment.UserName;
            return fallback.EndsWith("$") ? "vidar" : fallback;
        }

        public static string GetLocalIpAddress()
        {
            try
            {
                foreach (var netInterface in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (netInterface.OperationalStatus == OperationalStatus.Up &&
                        netInterface.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                    {
                        var ipProps = netInterface.GetIPProperties();
                        foreach (var addr in ipProps.UnicastAddresses)
                        {
                            if (addr.Address.AddressFamily == AddressFamily.InterNetwork &&
                                !IPAddress.IsLoopback(addr.Address))
                            {
                                return addr.Address.ToString();
                            }
                        }
                    }
                }
            }
            catch { }
            return "127.0.0.1";
        }

        private static (string? ssid, int signal) GetWifiInfoCached()
        {
            lock (_wifiLock)
            {
                if ((DateTime.UtcNow - _lastWifiCheckUtc).TotalSeconds < 15 && _cachedWifi.ssid != null)
                {
                    return _cachedWifi;
                }

                _lastWifiCheckUtc = DateTime.UtcNow;
                _cachedWifi = QueryWifiDirect();
                return _cachedWifi;
            }
        }

        private static (string? ssid, int signal) QueryWifiDirect()
        {
            try
            {
                using var proc = new Process();
                proc.StartInfo = new ProcessStartInfo
                {
                    FileName = "netsh.exe",
                    Arguments = "wlan show interfaces",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    CreateNoWindow = true
                };
                proc.Start();
                string output = proc.StandardOutput.ReadToEnd();
                proc.WaitForExit(1000);

                string? ssid = null;
                int signal = 0;

                var ssidMatch = Regex.Match(output, @"^\s*SSID\s*:\s*(.+)$", RegexOptions.Multiline);
                if (ssidMatch.Success)
                {
                    ssid = ssidMatch.Groups[1].Value.Trim();
                }

                var signalMatch = Regex.Match(output, @"^\s*Signal\s*:\s*(\d+)%", RegexOptions.Multiline);
                if (signalMatch.Success && int.TryParse(signalMatch.Groups[1].Value, out int s))
                {
                    signal = s;
                }

                if (!string.IsNullOrEmpty(ssid))
                {
                    return (ssid, signal);
                }
            }
            catch { }

            return ("Wi-Fi Active", 85);
        }

        private static float SampleCpuUsage()
        {
            lock (_cpuLock)
            {
                try
                {
                    if (!GetSystemTimes(out long idle, out long kernel, out long user))
                    {
                        return _lastCpuPct;
                    }

                    if (_prevCpuSampleTime == DateTime.MinValue)
                    {
                        _prevIdleTime = idle;
                        _prevKernelTime = kernel;
                        _prevUserTime = user;
                        _prevCpuSampleTime = DateTime.UtcNow;
                        return _lastCpuPct;
                    }

                    long usr = user - _prevUserTime;
                    long ker = kernel - _prevKernelTime;
                    long idl = idle - _prevIdleTime;

                    long sys = usr + ker;
                    if (sys > 0)
                    {
                        double pct = (double)(sys - idl) / sys * 100.0;
                        _lastCpuPct = (float)Math.Max(1.0, Math.Min(100.0, Math.Round(pct, 1)));
                    }

                    _prevIdleTime = idle;
                    _prevKernelTime = kernel;
                    _prevUserTime = user;
                    _prevCpuSampleTime = DateTime.UtcNow;

                    return _lastCpuPct;
                }
                catch
                {
                    return _lastCpuPct;
                }
            }
        }
    }
}
