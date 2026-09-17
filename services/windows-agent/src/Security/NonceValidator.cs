using System;
using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Security
{
    public class NonceValidator
    {
        private readonly ILogger<NonceValidator> _logger;
        private readonly ConcurrentDictionary<string, DateTime> _seenNonces = new();
        private readonly TimeSpan _retentionWindow = TimeSpan.FromMinutes(10);
        private readonly TimeSpan _maxClockSkew = TimeSpan.FromSeconds(120);

        public NonceValidator(ILogger<NonceValidator> logger)
        {
            _logger = logger;
        }

        public bool Validate(string nonce, DateTime commandTimeUtc, out string? error)
        {
            if (string.IsNullOrWhiteSpace(nonce))
            {
                error = "Nonce is missing or empty.";
                return false;
            }

            var now = DateTime.UtcNow;
            var skew = (now - commandTimeUtc).Duration();
            if (skew > _maxClockSkew)
            {
                error = $"Command timestamp skew ({skew.TotalSeconds:F1}s) exceeds maximum tolerance ({_maxClockSkew.TotalSeconds}s).";
                _logger.LogWarning(error);
                return false;
            }

            if (!_seenNonces.TryAdd(nonce, now))
            {
                error = $"Replay protection triggered: Nonce '{nonce}' was already executed.";
                _logger.LogWarning(error);
                return false;
            }

            // Periodically purge old nonces
            if (_seenNonces.Count > 1000)
            {
                PurgeOldNonces();
            }

            error = null;
            return true;
        }

        private void PurgeOldNonces()
        {
            var cutoff = DateTime.UtcNow - _retentionWindow;
            foreach (var kvp in _seenNonces)
            {
                if (kvp.Value < cutoff)
                {
                    _seenNonces.TryRemove(kvp.Key, out _);
                }
            }
        }
    }
}
