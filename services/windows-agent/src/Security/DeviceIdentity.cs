using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Security
{
    public class DeviceIdentity
    {
        private readonly ILogger<DeviceIdentity> _logger;
        private readonly string _keyStoragePath;
        private RSA? _rsaKey;

        public DeviceIdentity(ILogger<DeviceIdentity> logger, string configDirectory)
        {
            _logger = logger;
            _keyStoragePath = Path.Combine(configDirectory, "device_identity.dat");
            InitializeKey();
        }

        public string PublicKeyPem { get; private set; } = string.Empty;

        private void InitializeKey()
        {
            try
            {
                if (File.Exists(_keyStoragePath))
                {
                    byte[] encryptedData = File.ReadAllBytes(_keyStoragePath);
                    byte[] rawPkcs8 = UnprotectData(encryptedData);

                    _rsaKey = RSA.Create();
                    _rsaKey.ImportPkcs8PrivateKey(rawPkcs8, out _);
                    PublicKeyPem = _rsaKey.ExportSubjectPublicKeyInfoPem();
                    _logger.LogInformation("Loaded existing device asymmetric cryptographic identity.");
                    return;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to load existing device key. Generating new keypair.");
            }

            // Generate new 4096-bit RSA key pair
            _logger.LogInformation("Generating new 4096-bit RSA device keypair...");
            _rsaKey = RSA.Create(4096);
            byte[] pkcs8Bytes = _rsaKey.ExportPkcs8PrivateKey();
            byte[] encrypted = ProtectData(pkcs8Bytes);

            File.WriteAllBytes(_keyStoragePath, encrypted);
            PublicKeyPem = _rsaKey.ExportSubjectPublicKeyInfoPem();
            _logger.LogInformation("New device keypair generated and securely persisted.");
        }

        private byte[] ProtectData(byte[] data)
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                // Encrypt via Windows DPAPI bound to the Local Machine (enabling both Service and User access)
                try
                {
                    return ProtectedData.Protect(data, null, DataProtectionScope.LocalMachine);
                }
                catch
                {
                    return ProtectedData.Protect(data, null, DataProtectionScope.CurrentUser);
                }
            }
            // Fallback for non-Windows test environments
            return data;
        }

        private byte[] UnprotectData(byte[] encryptedData)
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                try
                {
                    return ProtectedData.Unprotect(encryptedData, null, DataProtectionScope.LocalMachine);
                }
                catch
                {
                    return ProtectedData.Unprotect(encryptedData, null, DataProtectionScope.CurrentUser);
                }
            }
            return encryptedData;
        }

        public string SignData(string data)
        {
            if (_rsaKey == null)
            {
                throw new InvalidOperationException("Device identity RSA key is not initialized.");
            }

            byte[] bytes = Encoding.UTF8.GetBytes(data);
            byte[] signatureBytes = _rsaKey.SignData(bytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            return Convert.ToBase64String(signatureBytes);
        }

        public bool VerifySignature(string data, string signatureBase64, string publicKeyPem)
        {
            try
            {
                using var rsa = RSA.Create();
                rsa.ImportFromPem(publicKeyPem);
                byte[] bytes = Encoding.UTF8.GetBytes(data);
                byte[] sigBytes = Convert.FromBase64String(signatureBase64);
                return rsa.VerifyData(bytes, sigBytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            }
            catch
            {
                return false;
            }
        }
    }
}
