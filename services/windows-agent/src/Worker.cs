using System;
using System.Diagnostics;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ILock.WindowsAgent.Access;
using ILock.WindowsAgent.Commands;
using ILock.WindowsAgent.Config;
using ILock.WindowsAgent.Diagnostics;
using ILock.WindowsAgent.Network;
using ILock.WindowsAgent.Security;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent
{
    public class Worker : BackgroundService
    {
        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern uint SetThreadExecutionState(uint esFlags);

        private const uint ES_CONTINUOUS = 0x80000000;
        private const uint ES_SYSTEM_REQUIRED = 0x00000001;
        private const uint ES_AWAYMODE_REQUIRED = 0x00000040;

        private readonly ILogger<Worker> _logger;
        private readonly ConfigManager _configManager;
        private readonly DeviceIdentity _deviceIdentity;
        private readonly CloudClient _cloudClient;
        private readonly CommandDispatcher _commandDispatcher;
        private readonly IWindowsAccessProvider _accessProvider;
        private AgentConfig _config;

        private readonly SemaphoreSlim _wakeSignal = new(0, 1);
        private int _consecutiveFailures = 0;

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

            // Hook network events to instantly wake polling when Wi-Fi connects or IP changes
            try
            {
                NetworkChange.NetworkAvailabilityChanged += OnNetworkAvailabilityChanged;
                NetworkChange.NetworkAddressChanged += OnNetworkAddressChanged;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not register NetworkChange event handlers.");
            }
        }

        private void OnNetworkAvailabilityChanged(object? sender, NetworkAvailabilityEventArgs e)
        {
            _logger.LogInformation("Network availability changed: IsAvailable={IsAvailable}. Triggering immediate connection...", e.IsAvailable);
            if (e.IsAvailable)
            {
                _consecutiveFailures = 0;
                TriggerWake();
            }
        }

        private void OnNetworkAddressChanged(object? sender, EventArgs e)
        {
            _logger.LogInformation("Network address changed (IP assigned/renewed). Triggering immediate cloud reconnect...");
            _consecutiveFailures = 0;
            TriggerWake();
        }

        private void TriggerWake()
        {
            if (_wakeSignal.CurrentCount == 0)
            {
                try
                {
                    _wakeSignal.Release();
                }
                catch (SemaphoreFullException) { }
            }
        }

        public override Task StartAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("==================================================================");
            _logger.LogInformation("   iLock Windows Agent & Service starting up                      ");
            _logger.LogInformation("   Device UUID: {Uuid}", _config.DeviceUuid);
            _logger.LogInformation("   Hostname:    {Host}", _config.Hostname);
            _logger.LogInformation("   Mode:        {Mode}", _config.DemoMode ? "DEMO/SANDBOX" : "PRODUCTION");
            _logger.LogInformation("==================================================================");

            try
            {
                // Prevent system sleep and keep network active while agent is running
                SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED);
                _logger.LogInformation("System sleep prevention and continuous network state active.");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not set thread execution state.");
            }

            return base.StartAsync(cancellationToken);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var random = new Random();

            while (!stoppingToken.IsCancellationRequested)
            {
                bool processedCommand = false;
                bool isLocked = false;
                try
                {
                    // 1. Check local session expiration
                    var activeSession = _accessProvider.GetCurrentSession();
                    if (activeSession != null && activeSession.State == AccessState.Expired)
                    {
                        _logger.LogInformation("Active session expired. Workstation locked.");
                    }

                    // 2. Query Workstation Lock Status
                    string activeUserRaw;
                    (isLocked, activeUserRaw) = await _accessProvider.GetStatusAsync(stoppingToken);

                    // 3. Collect High-Precision Telemetry (CPU, RAM, Disk, Wi-Fi, Battery, User)
                    var teleData = SystemTelemetryProvider.Collect();
                    string telemetryCompact = teleData.ToCompactString();

                    // 4. Prepare Cryptographically Signed Heartbeat Payload
                    long timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    string nonce = Guid.NewGuid().ToString("N");

                    string payloadToSign = $"{_config.DeviceUuid}:{timestamp}:{nonce}:{isLocked}";
                    string signature = _deviceIdentity.SignData(payloadToSign);

                    var heartbeat = new HeartbeatPayload
                    {
                        DeviceUuid = _config.DeviceUuid,
                        Timestamp = timestamp,
                        Nonce = nonce,
                        Signature = signature,
                        WorkstationLocked = isLocked,
                        ActiveUser = telemetryCompact,
                        CpuUsagePct = teleData.CpuUsagePct,
                        MemoryUsagePct = teleData.RamUsagePct,
                        BatteryPct = teleData.BatteryPct,
                        IsCharging = teleData.IsCharging
                    };

                    // 5. Send Heartbeat to Cloud
                    var response = await _cloudClient.SendHeartbeatAsync(
                        _config.BackendUrl,
                        heartbeat,
                        _config.AuthToken,
                        stoppingToken
                    );

                    if (response != null && response.Acknowledged)
                    {
                        if (_consecutiveFailures > 0)
                        {
                            _logger.LogInformation("Re-established secure connection with iLock Cloud!");
                        }
                        _consecutiveFailures = 0;

                        // 6. Process Any Pending Commands
                        if (response.PendingCommands != null && response.PendingCommands.Count > 0)
                        {
                            processedCommand = true;
                            _logger.LogInformation("Received {Count} pending cloud command(s).", response.PendingCommands.Count);
                            foreach (var command in response.PendingCommands)
                            {
                                await _commandDispatcher.ProcessCommandAsync(command, _config, stoppingToken);
                            }
                        }
                    }
                    else
                    {
                        _consecutiveFailures++;
                        _logger.LogWarning("Heartbeat unacknowledged. Consecutive failures: {Count}", _consecutiveFailures);
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _consecutiveFailures++;
                    _logger.LogWarning("Network or telemetry exception during heartbeat cycle: {Message}", ex.Message);
                }

                // If a command was processed, immediately run next cycle to report result and check queue
                if (processedCommand)
                {
                    await Task.Delay(200, stoppingToken);
                    continue;
                }

                // 7. Adaptive Polling & Fast Reconnect Delay:
                // When locked, NEVER back off for 60 seconds (user may be standing in front of PC waiting for unlock)
                // When locked with failures, retry rapidly every 1.5 - 2.5 seconds.
                // When locked and healthy, poll at 400ms for instantaneous phone response.
                if (_consecutiveFailures > 0 && isLocked)
                {
                    int fastRetryMs = Math.Min(2500, 800 + (_consecutiveFailures * 300));
                    await WaitWithInterruptAsync(fastRetryMs, stoppingToken);
                }
                else if (_consecutiveFailures > 3)
                {
                    int backoff = Math.Min(30, (int)Math.Pow(2, Math.Min(_consecutiveFailures, 5)));
                    int jitter = random.Next(1, 4);
                    await WaitWithInterruptAsync((backoff + jitter) * 1000, stoppingToken);
                }
                else if (isLocked)
                {
                    // Fast responsive polling while locked (<400ms latency)
                    await WaitWithInterruptAsync(400, stoppingToken);
                }
                else
                {
                    int baseIntervalSeconds = Math.Max(1, _config.HeartbeatIntervalSeconds);
                    await WaitWithInterruptAsync(baseIntervalSeconds * 1000, stoppingToken);
                }
            }
        }

        private async Task WaitWithInterruptAsync(int milliseconds, CancellationToken stoppingToken)
        {
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            try
            {
                var delayTask = Task.Delay(milliseconds, linkedCts.Token);
                var wakeTask = _wakeSignal.WaitAsync(linkedCts.Token);

                var completed = await Task.WhenAny(delayTask, wakeTask);
                if (completed == wakeTask)
                {
                    linkedCts.Cancel();
                    _logger.LogInformation("Immediate loop wake triggered by network availability event.");
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Normal shutdown
            }
            catch
            {
                // Ignored transient wait exception
            }
        }

        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("iLock Windows Agent shutting down gracefully.");
            try
            {
                NetworkChange.NetworkAvailabilityChanged -= OnNetworkAvailabilityChanged;
                NetworkChange.NetworkAddressChanged -= OnNetworkAddressChanged;
            }
            catch { }
            await base.StopAsync(cancellationToken);
        }
    }
}
