using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Security
{
    /// <summary>
    /// Manages zero-knowledge local storage of Windows login credentials (e.g., 6-digit PIN).
    /// Credentials are encrypted with Windows DPAPI (Data Protection API) and never transmitted
    /// over the network or stored in cloud databases.
    /// </summary>
    public class SecureCredentialVault
    {
        private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("iLock::LocalSecurityVault::v1");
        private readonly string _vaultFilePath;
        private readonly ILogger<SecureCredentialVault> _logger;

        public SecureCredentialVault(ILogger<SecureCredentialVault> logger, string configDirectory)
        {
            _logger = logger;
            _vaultFilePath = Path.Combine(configDirectory, "credentials.dat");
        }

        /// <summary>
        /// Encrypts and securely saves the local workstation PIN using DPAPI.
        /// </summary>
        public bool StorePin(string pin)
        {
            if (string.IsNullOrWhiteSpace(pin))
            {
                throw new ArgumentException("PIN cannot be null or empty.", nameof(pin));
            }

            try
            {
                byte[] plaintext = Encoding.UTF8.GetBytes(pin);

                // Attempt LocalMachine scope first (enables both service and user access)
                byte[] ciphertext;
                try
                {
                    ciphertext = ProtectedData.Protect(plaintext, Entropy, DataProtectionScope.LocalMachine);
                }
                catch
                {
                    // Fallback to CurrentUser if machine-level DPAPI is restricted
                    ciphertext = ProtectedData.Protect(plaintext, Entropy, DataProtectionScope.CurrentUser);
                }

                var dir = Path.GetDirectoryName(_vaultFilePath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                File.WriteAllBytes(_vaultFilePath, ciphertext);
                _logger.LogInformation("Workstation PIN securely encrypted and saved to DPAPI vault.");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to store PIN in DPAPI vault.");
                return false;
            }
        }

        /// <summary>
        /// Reads and decrypts the workstation PIN in-memory for immediate unlock authorization.
        /// </summary>
        public string? RetrievePin()
        {
            if (!File.Exists(_vaultFilePath))
            {
                _logger.LogWarning("Credential vault does not exist at {Path}.", _vaultFilePath);
                return null;
            }

            try
            {
                byte[] ciphertext = File.ReadAllBytes(_vaultFilePath);

                // Try LocalMachine first
                try
                {
                    byte[] plaintext = ProtectedData.Unprotect(ciphertext, Entropy, DataProtectionScope.LocalMachine);
                    return Encoding.UTF8.GetString(plaintext);
                }
                catch
                {
                    // Fallback to CurrentUser
                    byte[] plaintext = ProtectedData.Unprotect(ciphertext, Entropy, DataProtectionScope.CurrentUser);
                    return Encoding.UTF8.GetString(plaintext);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to decrypt credentials from DPAPI vault.");
                return null;
            }
        }

        /// <summary>
        /// Checks if a local PIN is already configured in the vault.
        /// </summary>
        public bool HasPinConfigured()
        {
            return File.Exists(_vaultFilePath) && new FileInfo(_vaultFilePath).Length > 0;
        }

        /// <summary>
        /// Clears stored credentials.
        /// </summary>
        public void Clear()
        {
            if (File.Exists(_vaultFilePath))
            {
                File.Delete(_vaultFilePath);
                _logger.LogInformation("DPAPI credential vault cleared.");
            }
        }
    }
}
