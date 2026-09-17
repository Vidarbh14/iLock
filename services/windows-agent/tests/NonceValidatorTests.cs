using System;
using ILock.WindowsAgent.Security;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace ILock.WindowsAgent.Tests
{
    public class NonceValidatorTests
    {
        [Fact]
        public void NonceValidator_AcceptsFreshUniqueNonce()
        {
            var validator = new NonceValidator(NullLogger<NonceValidator>.Instance);
            string nonce = Guid.NewGuid().ToString("N");
            DateTime now = DateTime.UtcNow;

            bool valid = validator.Validate(nonce, now, out string? error);
            Assert.True(valid);
            Assert.Null(error);
        }

        [Fact]
        public void NonceValidator_RejectsDuplicateNonce()
        {
            var validator = new NonceValidator(NullLogger<NonceValidator>.Instance);
            string nonce = "repeat-nonce-12345";
            DateTime now = DateTime.UtcNow;

            bool first = validator.Validate(nonce, now, out _);
            Assert.True(first);

            bool second = validator.Validate(nonce, now, out string? error);
            Assert.False(second);
            Assert.Contains("Replay protection triggered", error);
        }

        [Fact]
        public void NonceValidator_RejectsSkewedTimestamp()
        {
            var validator = new NonceValidator(NullLogger<NonceValidator>.Instance);
            string nonce = Guid.NewGuid().ToString("N");
            DateTime skewedTime = DateTime.UtcNow.AddMinutes(-5); // 5 minutes in the past

            bool valid = validator.Validate(nonce, skewedTime, out string? error);
            Assert.False(valid);
            Assert.Contains("skew", error);
        }
    }
}
