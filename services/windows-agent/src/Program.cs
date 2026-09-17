using System;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using ILock.WindowsAgent.Access;
using ILock.WindowsAgent.Commands;
using ILock.WindowsAgent.Config;
using ILock.WindowsAgent.Network;
using ILock.WindowsAgent.Security;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            Console.WriteLine("=================================================");
            Console.WriteLine("       iLock Windows Security Agent v1.0.0       ");
            Console.WriteLine("=================================================");

            var builder = Host.CreateApplicationBuilder(args);

            // Configure as Windows Service when running under SCM, or Console in dev
            builder.Services.AddWindowsService(options =>
            {
                options.ServiceName = "iLockAgent";
            });

            // Register Core Infrastructure
            builder.Services.AddSingleton<HttpClient>();
            builder.Services.AddSingleton<ConfigManager>();

            builder.Services.AddSingleton<DeviceIdentity>(sp =>
            {
                var logger = sp.GetRequiredService<ILogger<DeviceIdentity>>();
                var configManager = sp.GetRequiredService<ConfigManager>();
                return new DeviceIdentity(logger, configManager.ConfigDirectory);
            });

            builder.Services.AddSingleton<CloudClient>();
            builder.Services.AddSingleton<NonceValidator>();

            // Determine Access Provider (Demo/Sandbox vs Production Windows API)
            bool isDemo = true;
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--prod" || args[i] == "--production")
                {
                    isDemo = false;
                }
            }

            if (isDemo)
            {
                builder.Services.AddSingleton<IWindowsAccessProvider, DemoAccessProvider>();
            }
            else
            {
                builder.Services.AddSingleton<IWindowsAccessProvider, WindowsAccessProvider>();
            }

            builder.Services.AddSingleton<CommandDispatcher>();

            // Handle CLI Pairing/Registration Command
            for (int i = 0; i < args.Length; i++)
            {
                if ((args[i] == "--pair" || args[i] == "--register") && i + 1 < args.Length)
                {
                    string pairingCode = args[i + 1].Trim().ToUpper();
                    await ExecutePairingCommandAsync(pairingCode, isDemo);
                    return;
                }
            }

            // Register Background Worker Service
            builder.Services.AddHostedService<Worker>();

            var host = builder.Build();
            await host.RunAsync();
        }

        private static async Task ExecutePairingCommandAsync(string pairingCode, bool isDemo)
        {
            using var loggerFactory = LoggerFactory.Create(b => b.AddConsole());
            var configLogger = loggerFactory.CreateLogger<ConfigManager>();
            var identityLogger = loggerFactory.CreateLogger<DeviceIdentity>();
            var clientLogger = loggerFactory.CreateLogger<CloudClient>();

            var configManager = new ConfigManager(configLogger);
            var config = configManager.LoadConfig();
            config.DemoMode = isDemo;

            var deviceIdentity = new DeviceIdentity(identityLogger, configManager.ConfigDirectory);
            var httpClient = new HttpClient();
            var cloudClient = new CloudClient(httpClient, clientLogger);

            Console.WriteLine($"Initiating pairing with code: {pairingCode}");
            Console.WriteLine($"Device UUID: {config.DeviceUuid}");
            Console.WriteLine($"Connecting to: {config.BackendUrl}");

            var regRequest = new RegisterDeviceRequest
            {
                PairingCode = pairingCode,
                DeviceUuid = config.DeviceUuid,
                Hostname = config.Hostname,
                OsVersion = Environment.OSVersion.ToString(),
                AgentVersion = config.AgentVersion,
                PublicKey = deviceIdentity.PublicKeyPem,
                PublicKeyAlgorithm = "RSA-4096"
            };

            var result = await cloudClient.RegisterDeviceAsync(config.BackendUrl, regRequest);
            if (result != null && result.Success)
            {
                config.AuthToken = result.AuthToken;
                configManager.SaveConfig(config);
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("SUCCESS: PC successfully paired with iLock Cloud!");
                Console.ResetColor();
            }
            else
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"FAILED: Pairing failed. {result?.Message ?? "Unknown error"}");
                Console.ResetColor();
            }
        }
    }
}
