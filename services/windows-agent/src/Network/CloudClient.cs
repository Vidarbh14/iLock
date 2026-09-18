using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ILock.WindowsAgent.Commands;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Network
{
    public class CloudClient
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<CloudClient> _logger;

        public CloudClient(HttpClient httpClient, ILogger<CloudClient> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            _httpClient.Timeout = TimeSpan.FromSeconds(15);
        }

        public async Task<RegisterDeviceResponse?> RegisterDeviceAsync(
            string backendUrl,
            RegisterDeviceRequest request,
            CancellationToken ct = default)
        {
            string url = $"{backendUrl.TrimEnd('/')}/api/devices/register";
            _logger.LogInformation("Sending pairing registration to {Url} with code {Code}...", url, request.PairingCode);

            try
            {
                var response = await _httpClient.PostAsJsonAsync(url, request, ct);
                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadFromJsonAsync<RegisterDeviceResponse>(cancellationToken: ct);
                }

                string body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Registration failed with status {Code}: {Body}", response.StatusCode, body);
                return new RegisterDeviceResponse { Success = false, Message = $"Server returned {response.StatusCode}: {body}" };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to connect to backend during device registration.");
                return new RegisterDeviceResponse { Success = false, Message = ex.Message };
            }
        }

        public async Task<HeartbeatResponse?> SendHeartbeatAsync(
            string backendUrl,
            HeartbeatPayload payload,
            string? authToken,
            CancellationToken ct = default)
        {
            string url = $"{backendUrl.TrimEnd('/')}/api/agent/heartbeat";

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = JsonContent.Create(payload)
                };

                if (!string.IsNullOrEmpty(authToken))
                {
                    request.Headers.Add("X-Device-Token", authToken);
                }

                var response = await _httpClient.SendAsync(request, ct);
                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadFromJsonAsync<HeartbeatResponse>(cancellationToken: ct);
                }

                _logger.LogWarning("Heartbeat rejected with status {Status}", response.StatusCode);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Heartbeat connection error (transient network unavailability).");
                return null;
            }
        }

        public async Task<bool> SendCommandResultAsync(
            string backendUrl,
            CommandResultPayload resultPayload,
            string? authToken,
            CancellationToken ct = default)
        {
            string url = $"{backendUrl.TrimEnd('/')}/api/agent/command-result";

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = JsonContent.Create(resultPayload)
                };

                if (!string.IsNullOrEmpty(authToken))
                {
                    request.Headers.Add("X-Device-Token", authToken);
                }

                var response = await _httpClient.SendAsync(request, ct);
                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Command result for {CommandId} ({Status}) acknowledged by cloud (HTTP {Code}).", resultPayload.CommandId, resultPayload.Status, (int)response.StatusCode);
                    return true;
                }

                string errorBody = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Command result for {CommandId} rejected by cloud (HTTP {Code}): {Body}", resultPayload.CommandId, (int)response.StatusCode, errorBody);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to report command result for {CommandId} to cloud.", resultPayload.CommandId);
                return false;
            }
        }
    }
}
