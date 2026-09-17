# iLock Windows Agent & Service Architecture

## 1. Executive Summary & Philosophy

The **iLock Windows Agent** is a native .NET 8 Worker Service designed to run autonomously in the background on Windows 10 and 11 workstations. It bridges the PC with the iLock cloud backend without exposing inbound network ports, without storing user passwords, and without circumventing Windows security packages.

---

## 2. Background Service Lifecycle

```
       [SYSTEM BOOT]
             │
             ▼
        [START SERVICE]
             │
             ▼
     [LOAD LOCAL CONFIG]
   (C:\ProgramData\iLock\agent_config.json)
             │
             ▼
   [LOAD DEVICE IDENTITY]
  (4096-bit RSA Private Key decrypted via DPAPI)
             │
             ▼
    [CONNECT TO INTERNET]
   (Outbound HTTPS / TLS 1.3)
             │
             ▼
   [AUTHENTICATE WITH CLOUD]
  (Signed Challenge / X-Device-Token)
             │
             ▼
       [SEND HEARTBEAT] ◄────────────────────────────────┐
  (Signed status, CPU, Memory, Battery, Locked state)     │
             │                                            │
             ▼                                            │
   [RECEIVE CLOUD COMMANDS]                               │
             │                                            │
   ┌─────────┴─────────┐                                  │
   │ Any Commands?     │───(No)───────────────────────────┤
   └─────────┬─────────┘                                  │
            (Yes)                                         │
             ▼                                            │
   [VERIFY COMMAND FRESHNESS]                             │
  (Check nonce deduplication cache & 120s drift window)   │
             │                                            │
             ▼                                            │
   [DISPATCH TO IWindowsAccessProvider]                   │
   - CREATE_ACCESS_SESSION                                │
   - REVOKE_ACCESS_SESSION                                │
   - LOCK_REQUEST                                         │
   - DEVICE_PING / GET_STATUS                             │
             │                                            │
             ▼                                            │
   [REPORT SIGNED RECEIPT]                                │
   (POST /api/agent/command-result)                       │
             │                                            │
             └────────────────────────────────────────────┘
```

---

## 3. The `IWindowsAccessProvider` Abstraction

To ensure security guarantees and testing flexibility, cloud authorization is strictly decoupled from operating system access primitives via `IWindowsAccessProvider`:

```csharp
public interface IWindowsAccessProvider
{
    Task<bool> RequestAuthorizedAccessAsync(Guid sessionId, DateTime expiresAtUtc, CancellationToken ct = default);
    Task<bool> RevokeAuthorizedAccessAsync(Guid sessionId, string reason, CancellationToken ct = default);
    AccessState GetAccessState();
    AccessSessionInfo? GetCurrentSession();
    Task<bool> LockAsync(CancellationToken ct = default);
    Task<(bool isLocked, string? activeUser)> GetStatusAsync(CancellationToken ct = default);
}
```

### 3.1. DemoAccessProvider (Sandbox Mode)
Used during development and college demonstration:
- Simulates session activation, live countdowns, and workstation locking.
- Does not modify OS registry, user accounts, or credentials.
- Validates the entire phone $\to$ cloud $\to$ agent pipeline safely.

### 3.2. WindowsAccessProvider (Production Windows Integration)
- Invokes native `user32.dll` `LockWorkStation()` Win32 API.
- Implements the contract for Windows Credential Provider (CP) COM components.
- In production, a companion Credential Provider communicates with the service over a secure Named Pipe (secured with Windows Security Descriptors `DACL`) to unlock or present a temporary logon tile.

---

## 4. Cryptographic Storage & DPAPI

The agent generates a 4096-bit RSA key pair during its first execution. The private key is serialized to PKCS#8 format and encrypted using the **Windows Data Protection API**:
```csharp
byte[] encrypted = ProtectedData.Protect(pkcs8Bytes, null, DataProtectionScope.CurrentUser);
```
- The encryption key is derived directly from the Windows OS user or machine security context.
- The raw private key is never written to disk in plaintext.

---

## 5. Resilient Networking & Exponential Backoff

If the workstation is disconnected from Wi-Fi or behind a restrictive network:
- The Agent catches network exceptions gracefully without crashing.
- After consecutive missed heartbeats, it shifts into exponential backoff:
  $$T_{\text{wait}} = \min(60, 2^{\text{failures}}) + \text{jitter}$$
- When Internet is restored, it re-synchronizes state and flushes stale sessions automatically.
