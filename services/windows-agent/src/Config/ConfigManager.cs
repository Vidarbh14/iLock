using System;
using System.IO;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Config
{
    public class ConfigManager
    {
        private readonly ILogger<ConfigManager> _logger;
        private readonly string _configDirectory;
        private readonly string _configFilePath;

        public ConfigManager(ILogger<ConfigManager> logger)
        {
            _logger = logger;
            
            // Prefer ProgramData for system services, fallback to LocalApplicationData
            string baseFolder = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
            if (string.IsNullOrEmpty(baseFolder) || !Directory.Exists(baseFolder))
            {
                baseFolder = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            }

            _configDirectory = Path.Combine(baseFolder, "iLock");
            _configFilePath = Path.Combine(_configDirectory, "agent_config.json");
        }

        public string ConfigDirectory => _configDirectory;

        public AgentConfig LoadConfig()
        {
            try
            {
                if (!Directory.Exists(_configDirectory))
                {
                    Directory.CreateDirectory(_configDirectory);
                }

                if (File.Exists(_configFilePath))
                {
                    string json = File.ReadAllText(_configFilePath);
                    var config = JsonSerializer.Deserialize<AgentConfig>(json);
                    if (config != null)
                    {
                        return config;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to read configuration file from {Path}. Using default config.", _configFilePath);
            }

            var defaultConfig = new AgentConfig
            {
                DeviceUuid = Guid.NewGuid().ToString(),
                Hostname = Environment.MachineName,
                DeviceName = Environment.MachineName
            };
            SaveConfig(defaultConfig);
            return defaultConfig;
        }

        public void SaveConfig(AgentConfig config)
        {
            try
            {
                if (!Directory.Exists(_configDirectory))
                {
                    Directory.CreateDirectory(_configDirectory);
                }

                string json = JsonSerializer.Serialize(config, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_configFilePath, json);
                _logger.LogInformation("Agent configuration saved to {Path}", _configFilePath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save configuration to {Path}", _configFilePath);
            }
        }
    }
}
