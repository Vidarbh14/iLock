using System;
using System.Security.Cryptography;
using System.Text;

namespace ILock.WindowsAgent.Security
{
    /// <summary>
    /// RFC 6238 Time-Based One-Time Password (TOTP) Authenticator.
    /// Provides zero-internet offline emergency unlock verification on the Windows Agent.
    /// </summary>
    public static class TotpValidator
    {
        private const string Base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

        public static byte[] Base32Decode(string base32)
        {
            if (string.IsNullOrWhiteSpace(base32)) return Array.Empty<byte>();

            string clean = base32.ToUpperInvariant().Trim();
            int bits = 0;
            int value = 0;
            var bytes = new System.Collections.Generic.List<byte>();

            foreach (char c in clean)
            {
                int idx = Base32Alphabet.IndexOf(c);
                if (idx < 0) continue;

                value = (value << 5) | idx;
                bits += 5;

                if (bits >= 8)
                {
                    bytes.Add((byte)((value >> (bits - 8)) & 0xFF));
                    bits -= 8;
                }
            }

            return bytes.ToArray();
        }

        public static string DeriveTotpSecret(string deviceUuid, string salt = "ilock-totp-v1")
        {
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(salt));
            byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(deviceUuid));
            return Base32Encode(hash, 20);
        }

        public static string Base32Encode(byte[] data, int length = -1)
        {
            int len = length > 0 && length <= data.Length ? length : data.Length;
            int bits = 0;
            int value = 0;
            var sb = new StringBuilder();

            for (int i = 0; i < len; i++)
            {
                value = (value << 8) | data[i];
                bits += 8;

                while (bits >= 5)
                {
                    sb.Append(Base32Alphabet[(value >> (bits - 5)) & 31]);
                    bits -= 5;
                }
            }

            if (bits > 0)
            {
                sb.Append(Base32Alphabet[(value << (5 - bits)) & 31]);
            }

            return sb.ToString();
        }

        public static string GenerateTotp(string secret, long epochSeconds, int timeStepSeconds = 30)
        {
            byte[] key = Base32Decode(secret);
            long timeStep = epochSeconds / timeStepSeconds;

            byte[] timeBytes = BitConverter.GetBytes(timeStep);
            if (BitConverter.IsLittleEndian)
            {
                Array.Reverse(timeBytes);
            }

            using var hmac = new HMACSHA1(key);
            byte[] hash = hmac.ComputeHash(timeBytes);

            int offset = hash[^1] & 0x0F;
            int binary =
                ((hash[offset] & 0x7F) << 24) |
                ((hash[offset + 1] & 0xFF) << 16) |
                ((hash[offset + 2] & 0xFF) << 8) |
                (hash[offset + 3] & 0xFF);

            int otp = binary % 1_000_000;
            return otp.ToString("D6");
        }

        public static bool ValidateTotp(string code, string secret, int windowSteps = 1, int timeStepSeconds = 30)
        {
            if (string.IsNullOrWhiteSpace(code) || code.Length != 6) return false;

            long currentSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            for (int offset = -windowSteps; offset <= windowSteps; offset++)
            {
                long checkSeconds = currentSeconds + (offset * timeStepSeconds);
                string expected = GenerateTotp(secret, checkSeconds, timeStepSeconds);
                if (string.Equals(code.Trim(), expected, StringComparison.Ordinal))
                {
                    return true;
                }
            }

            return false;
        }
    }
}
