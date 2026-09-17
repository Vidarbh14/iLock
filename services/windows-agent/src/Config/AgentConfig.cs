using System;

namespace ILock.WindowsAgent.Config
{
    public class AgentConfig
    {
        public string BackendUrl { get; set; } = "http://localhost:3000";
        public string DeviceUuid { get; set; } = string.Empty;
        public string DeviceName { get; set; } = Environment.MachineName;
        public string Hostname { get; set; } = Environment.MachineName;
        public string AgentVersion { get; set; } = "1.0.0";
        public int HeartbeatIntervalSeconds { get; set; } = 30;
        public int OfflineThresholdSeconds { get; set; } = 90;
        public string? AuthToken { get; set; }
        public bool DemoMode { get; set; } = true;
    }
}
