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

            builder.Services.AddSingleton<SecureCredentialVault>(sp =>
            {
                var logger = sp.GetRequiredService<ILogger<SecureCredentialVault>>();
                var configManager = sp.GetRequiredService<ConfigManager>();
                return new SecureCredentialVault(logger, configManager.ConfigDirectory);
            });

            builder.Services.AddSingleton<CloudClient>();
            builder.Services.AddSingleton<NonceValidator>();

            // Determine Access Provider (Genuine Windows API vs Demo Simulator)
            bool isDemo = false;
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--demo" || args[i] == "--sandbox")
                {
                    isDemo = true;
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

            // Handle CLI Public Key Display
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--public-key" || args[i] == "-k")
                {
                    using var loggerFactory = LoggerFactory.Create(b => b.AddConsole());
                    var identityLogger = loggerFactory.CreateLogger<DeviceIdentity>();
                    var configLogger = loggerFactory.CreateLogger<ConfigManager>();
                    var configManager = new ConfigManager(configLogger);
                    var deviceIdentity = new DeviceIdentity(identityLogger, configManager.ConfigDirectory);
                    Console.WriteLine("===BEGIN_PUBLIC_KEY===");
                    Console.WriteLine(deviceIdentity.PublicKeyPem);
                    Console.WriteLine("===END_PUBLIC_KEY===");
                    return;
                }
            }

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

            // Handle CLI PIN Configuration Command
            for (int i = 0; i < args.Length; i++)
            {
                if ((args[i] == "--set-pin" || args[i] == "-p") && i + 1 < args.Length)
                {
                    string pin = args[i + 1].Trim();
                    using var loggerFactory = LoggerFactory.Create(b => b.AddConsole());
                    var vaultLogger = loggerFactory.CreateLogger<SecureCredentialVault>();
                    var configLogger = loggerFactory.CreateLogger<ConfigManager>();
                    var configManager = new ConfigManager(configLogger);
                    var vault = new SecureCredentialVault(vaultLogger, configManager.ConfigDirectory);
                    bool stored = vault.StorePin(pin);
                    if (stored)
                    {
                        Console.ForegroundColor = ConsoleColor.Green;
                        Console.WriteLine("SUCCESS: Windows login PIN securely encrypted and saved to local DPAPI vault!");
                        Console.WriteLine("Protected by Windows DPAPI. Zero credentials transmitted to cloud.");
                        Console.ResetColor();
                    }
                    else
                    {
                        Console.ForegroundColor = ConsoleColor.Red;
                        Console.WriteLine("ERROR: Failed to save PIN to vault.");
                        Console.ResetColor();
                    }
                    return;
                }
            }

            // Handle CLI Unlock Test
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--test-unlock" || args[i] == "--unlock-helper")
                {
                    using var loggerFactory = LoggerFactory.Create(b => b.AddConsole());
                    var vaultLogger = loggerFactory.CreateLogger<SecureCredentialVault>();
                    var configLogger = loggerFactory.CreateLogger<ConfigManager>();
                    var configManager = new ConfigManager(configLogger);
                    var vault = new SecureCredentialVault(vaultLogger, configManager.ConfigDirectory);
                    var pin = vault.RetrievePin();
                    if (string.IsNullOrEmpty(pin))
                    {
                        Console.ForegroundColor = ConsoleColor.Yellow;
                        Console.WriteLine("No PIN configured. Run: ILock.WindowsAgent.exe --set-pin <pin>");
                        Console.ResetColor();
                        return;
                    }
                    Console.WriteLine("Executing unlock keystrokes...");
                    WindowsAccessProvider.SimulateUnlock(pin);
                    Console.WriteLine("Done.");
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
