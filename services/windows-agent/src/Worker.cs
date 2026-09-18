using System;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using ILock.WindowsAgent.Access;
using ILock.WindowsAgent.Commands;
using ILock.WindowsAgent.Config;
using ILock.WindowsAgent.Network;
using ILock.WindowsAgent.Security;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent
{
    public class Worker : BackgroundService
    {
        private readonly ILogger<Worker> _logger;
        private readonly ConfigManager _configManager;
        private readonly DeviceIdentity _deviceIdentity;
        private readonly CloudClient _cloudClient;
        private readonly CommandDispatcher _commandDispatcher;
        private readonly IWindowsAccessProvider _accessProvider;
        private AgentConfig _config;

        public Worker(
            ILogger<Worker> logger,
            ConfigManager configManager,
            DeviceIdentity deviceIdentity,
            CloudClient cloudClient,
            CommandDispatcher commandDispatcher,
            IWindowsAccessProvider accessProvider)
        {
            _logger = logger;
            _configManager = configManager;
            _deviceIdentity = deviceIdentity;
            _cloudClient = cloudClient;
            _commandDispatcher = commandDispatcher;
            _accessProvider = accessProvider;
            _config = _configManager.LoadConfig();
        }

        public override Task StartAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("==================================================================");
            _logger.LogInformation("   iLock Windows Agent & Service starting up                      ");
            _logger.LogInformation("   Device UUID: {Uuid}", _config.DeviceUuid);
            _logger.LogInformation("   Hostname:    {Host}", _config.Hostname);
            _logger.LogInformation("   Mode:        {Mode}", _config.DemoMode ? "DEMO/SANDBOX" : "PRODUCTION");
            _logger.LogInformation("==================================================================");
            return base.StartAsync(cancellationToken);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            int consecutiveFailures = 0;
            var random = new Random();

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // 1. Check local session expiration
                    var activeSession = _accessProvider.GetCurrentSession();
                    if (activeSession != null && activeSession.State == AccessState.Expired)
                    {
                        _logger.LogInformation("Active session expired. Workstation locked.");
                    }

                    // 2. Prepare Signed Heartbeat Payload
                    long timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    string nonce = Guid.NewGuid().ToString("N");
                    var (isLocked, activeUser) = await _accessProvider.GetStatusAsync(stoppingToken);

                    string payloadToSign = $"{_config.DeviceUuid}:{timestamp}:{nonce}:{isLocked}";
                    string signature = _deviceIdentity.SignData(payloadToSign);

                    var heartbeat = new HeartbeatPayload
                    {
                        DeviceUuid = _config.DeviceUuid,
                        Timestamp = timestamp,
                        Nonce = nonce,
                        Signature = signature,
                        WorkstationLocked = isLocked,
                        ActiveUser = activeUser,
                        CpuUsagePct = (float)Math.Round(GetCpuUsageMock(), 1),
                        MemoryUsagePct = (float)Math.Round(GetMemoryUsagePct(), 1),
                        BatteryPct = 100f,
                        IsCharging = true
                    };

                    // 3. Send Heartbeat to Cloud
                    var response = await _cloudClient.SendHeartbeatAsync(
                        _config.BackendUrl,
                        heartbeat,
                        _config.AuthToken,
                        stoppingToken
                    );

                    if (response != null && response.Acknowledged)
                    {
                        if (consecutiveFailures > 0)
                        {
                            _logger.LogInformation("Re-established secure connection with iLock Cloud!");
                        }
                        consecutiveFailures = 0;

                        // 4. Process Any Pending Commands
                        if (response.PendingCommands != null && response.PendingCommands.Count > 0)
                        {
                            _logger.LogInformation("Received {Count} pending cloud command(s).", response.PendingCommands.Count);
                            foreach (var command in response.PendingCommands)
                            {
                                await _commandDispatcher.ProcessCommandAsync(command, _config, stoppingToken);
                            }
                        }
                    }
                    else
                    {
                        consecutiveFailures++;
                        _logger.LogWarning("Heartbeat unacknowledged. Consecutive failures: {Count}", consecutiveFailures);
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    consecutiveFailures++;
                    _logger.LogWarning("Network or telemetry exception during heartbeat cycle: {Message}", ex.Message);
                }

                // 5. Backoff calculation with jitter
                int baseIntervalSeconds = _config.HeartbeatIntervalSeconds;
                if (consecutiveFailures > 3)
                {
                    // Exponential backoff up to 60 seconds with jitter
                    int backoff = Math.Min(60, (int)Math.Pow(2, Math.Min(consecutiveFailures, 6)));
                    int jitter = random.Next(1, 5);
                    baseIntervalSeconds = backoff + jitter;
                }

                await Task.Delay(TimeSpan.FromSeconds(baseIntervalSeconds), stoppingToken);
            }
        }

        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("iLock Windows Agent shutting down gracefully.");
            try
            {
                var activeSession = _accessProvider.GetCurrentSession();
                if (activeSession != null && activeSession.State == AccessState.Active)
                {
                    _logger.LogInformation("Active session detected on shutdown. Locking workstation...");
                    await _accessProvider.LockAsync(cancellationToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error while checking session state on shutdown.");
            }

            await base.StopAsync(cancellationToken);
        }

        private static float GetCpuUsageMock()
        {
            return (float)(5.0 + (new Random().NextDouble() * 15.0));
        }

        private static float GetMemoryUsagePct()
        {
            var proc = Process.GetCurrentProcess();
            return (float)Math.Round((proc.WorkingSet64 / (1024.0 * 1024.0 * 1024.0 * 16.0)) * 100.0, 1);
        }
    }
}
