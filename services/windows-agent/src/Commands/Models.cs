using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace ILock.WindowsAgent.Commands
{
    public class RegisterDeviceRequest
    {
        [JsonPropertyName("pairingCode")]
        public string PairingCode { get; set; } = string.Empty;

        [JsonPropertyName("deviceUuid")]
        public string DeviceUuid { get; set; } = string.Empty;

        [JsonPropertyName("hostname")]
        public string Hostname { get; set; } = string.Empty;

        [JsonPropertyName("osVersion")]
        public string OsVersion { get; set; } = string.Empty;

        [JsonPropertyName("agentVersion")]
        public string AgentVersion { get; set; } = string.Empty;

        [JsonPropertyName("publicKey")]
        public string PublicKey { get; set; } = string.Empty;

        [JsonPropertyName("publicKeyAlgorithm")]
        public string PublicKeyAlgorithm { get; set; } = "RSA-4096";
    }

    public class RegisterDeviceResponse
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("deviceId")]
        public string DeviceId { get; set; } = string.Empty;

        [JsonPropertyName("authToken")]
        public string AuthToken { get; set; } = string.Empty;

        [JsonPropertyName("message")]
        public string? Message { get; set; }
    }

    public class HeartbeatPayload
    {
        [JsonPropertyName("deviceUuid")]
        public string DeviceUuid { get; set; } = string.Empty;

        [JsonPropertyName("timestamp")]
        public long Timestamp { get; set; }

        [JsonPropertyName("nonce")]
        public string Nonce { get; set; } = string.Empty;

        [JsonPropertyName("signature")]
        public string Signature { get; set; } = string.Empty;

        [JsonPropertyName("cpuUsagePct")]
        public float? CpuUsagePct { get; set; }

        [JsonPropertyName("memoryUsagePct")]
        public float? MemoryUsagePct { get; set; }

        [JsonPropertyName("batteryPct")]
        public float? BatteryPct { get; set; }

        [JsonPropertyName("isCharging")]
        public bool? IsCharging { get; set; }

        [JsonPropertyName("activeUser")]
        public string? ActiveUser { get; set; }

        [JsonPropertyName("workstationLocked")]
        public bool WorkstationLocked { get; set; }
    }

    public class HeartbeatResponse
    {
        [JsonPropertyName("acknowledged")]
        public bool Acknowledged { get; set; }

        [JsonPropertyName("serverTimeUtc")]
        public string ServerTimeUtc { get; set; } = string.Empty;

        [JsonPropertyName("pendingCommands")]
        public List<AgentCommand>? PendingCommands { get; set; }
    }

    public class AgentCommand
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("commandType")]
        public string CommandType { get; set; } = string.Empty;

        [JsonPropertyName("sessionId")]
        public string? SessionId { get; set; }

        [JsonPropertyName("nonce")]
        public string Nonce { get; set; } = string.Empty;

        [JsonPropertyName("expiresAt")]
        public string ExpiresAt { get; set; } = string.Empty;

        [JsonPropertyName("payload")]
        public Dictionary<string, object>? Payload { get; set; }

        [JsonPropertyName("signature")]
        public string? Signature { get; set; }
    }

    public class CommandResultPayload
    {
        [JsonPropertyName("commandId")]
        public string CommandId { get; set; } = string.Empty;

        [JsonPropertyName("sessionId")]
        public string? SessionId { get; set; }

        [JsonPropertyName("status")]
        public string Status { get; set; } = "SUCCESS"; // SUCCESS, FAILED, REJECTED

        [JsonPropertyName("resultStatus")]
        public string? ResultStatus { get; set; }

        [JsonPropertyName("error")]
        public string? Error { get; set; }

        [JsonPropertyName("nonce")]
        public string Nonce { get; set; } = string.Empty;

        [JsonPropertyName("timestamp")]
        public long Timestamp { get; set; }

        [JsonPropertyName("signature")]
        public string Signature { get; set; } = string.Empty;
    }
}
