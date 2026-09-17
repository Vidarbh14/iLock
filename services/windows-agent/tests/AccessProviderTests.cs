using System;
using System.Threading.Tasks;
using ILock.WindowsAgent.Access;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace ILock.WindowsAgent.Tests
{
    public class AccessProviderTests
    {
        [Fact]
        public async Task DemoAccessProvider_GrantsAndExpiresSessionCorrectly()
        {
            var logger = NullLogger<DemoAccessProvider>.Instance;
            var provider = new DemoAccessProvider(logger);

            var sessionId = Guid.NewGuid();
            var expiry = DateTime.UtcNow.AddMinutes(30);

            bool granted = await provider.RequestAuthorizedAccessAsync(sessionId, expiry);
            Assert.True(granted);
            Assert.Equal(AccessState.Active, provider.GetAccessState());

            var current = provider.GetCurrentSession();
            Assert.NotNull(current);
            Assert.Equal(sessionId, current.SessionId);
            Assert.Equal(AccessState.Active, current.State);

            // Test immediate lock
            await provider.LockAsync();
            Assert.Equal(AccessState.Locked, provider.GetAccessState());
        }

        [Fact]
        public async Task DemoAccessProvider_RevocationTransitionsToRevoked()
        {
            var logger = NullLogger<DemoAccessProvider>.Instance;
            var provider = new DemoAccessProvider(logger);

            var sessionId = Guid.NewGuid();
            var expiry = DateTime.UtcNow.AddMinutes(15);

            await provider.RequestAuthorizedAccessAsync(sessionId, expiry);
            Assert.Equal(AccessState.Active, provider.GetAccessState());

            bool revoked = await provider.RevokeAuthorizedAccessAsync(sessionId, "Owner clicked Revoke");
            Assert.True(revoked);
            Assert.Equal(AccessState.Revoked, provider.GetAccessState());
        }
    }
}
