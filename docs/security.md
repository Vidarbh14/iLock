# iLock Security Architecture & Invariants

## 1. Zero-Trust Security Invariants

### Invariant 1: Zero Windows Password Disclosure
At no point in time does iLock request, capture, log, transmit, cache, or store the user's permanent Windows account password, PIN, or Kerberos ticket. 
- The system strictly adheres to the principle of **credential separation**.
- The cloud backend is strictly an **Authorization Broker**, not a password vault.

### Invariant 2: Non-Exportable Cryptographic Identity
Every Windows machine generates an asymmetric key pair (RSA-4096 or ECDSA P-256) locally within user space:
- The **Private Key** is persisted on the local machine encrypted via the Windows Data Protection API (`ProtectedData` / DPAPI). It is NEVER transmitted across any network boundary.
- Only the **Public Key** is transmitted to the cloud backend during initial pairing.
- Heartbeats, command results, and status reports are cryptographically signed with this private key and verified by the backend using the enrolled public key.

### Invariant 3: Outbound-Only Communication
The Windows PC initiates all connections outward toward the cloud via TLS 1.3 (HTTPS / WebSocket).
- Zero inbound open ports or listening daemons on the PC.
- Immune to public IP scanning, network port probing, or NAT-traversal vulnerabilities.

---

## 2. Authorization vs. Windows Authentication Separation

iLock enforces a strict architectural boundary between **Cloud Authorization** and **Windows Access Enforcement**:

```
┌────────────────────────────────────────────────────────┐
│                   iLock Cloud Layer                    │
│  - Verifies user ownership                             │
│  - Enforces time limits (expires_at)                   │
│  - Manages session lifecycle state machine             │
└───────────────────────────┬────────────────────────────┘
                            │ Signed Outbound Command
                            ▼
┌────────────────────────────────────────────────────────┐
│                 iLock Windows Service                  │
│  - Cryptographically verifies command & freshness     │
│  - Maintains nonce replay window                       │
│  - Dispatches to IWindowsAccessProvider                │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
    [DemoAccessProvider]        [WindowsAccessProvider]
    - Simulated sessions        - Win32 LockWorkStation
    - Safe for development      - Windows Credential Provider
    - Telemetry verification    - Named pipe IPC
```

---

## 3. Pairing & Key Exchange Protocol

1. **Pairing Code Generation**:
   The owner initiates a pairing request from their mobile device. The cloud generates an 8-character code using a high-entropy CSPRNG excluding ambiguous characters (`0, O, 1, I`):
   $$\text{Code} \in \{2..9, A..Z \setminus \{I, O\}\}^8$$
2. **Ephemeral Lifecycle**:
   The pairing code is stored as a salted SHA-256 hash with an authoritative 10-minute expiration.
3. **Single-Use Invalidation**:
   The moment the Windows Agent submits the code alongside its newly generated public key, the pairing code is atomically marked as used, preventing reuse.
4. **Rate Limiting**:
   Registration requests are rate-limited to 5 per minute per IP to prevent brute-force attacks against the $32^8 \approx 1.09 \times 10^{12}$ combinations.

---

## 4. Replay Attacks & Time Synchronization Defenses

### Nonce Cache
Every command and heartbeat payload embeds a UUIDv4 cryptographic nonce and an authoritative UTC epoch timestamp:
- The Windows Agent and the Cloud API maintain sliding-window nonce deduplication caches.
- If a nonce has already been processed within the cache retention window (5–10 minutes), the packet is instantly discarded as a replay attack and logged as a `SECURITY_EVENT`.

### Clock Drift Window
Timestamps must fall within $\pm 120$ seconds of the receiver's authoritative time:
$$|\text{ServerTime} - \text{PacketTime}| \le 120 \text{ seconds}$$
Packets outside this tolerance are rejected to prevent replay of stale authorizations.

### Server-Authoritative Expiration
Even if a local user sets back their PC's system clock, the Agent's periodic heartbeat cross-validates active sessions against server-authoritative time. If the server marks a session expired, the Agent immediately locks the computer.

---

## 5. Privacy & Data Minimization

- **IP Address Anonymization**: Real client and PC IP addresses are never written to the `audit_logs` table in plaintext. They are salted and hashed with SHA-256, truncated to 16 hexadecimal characters.
- **Audit Trails**: All state transitions (`PAIRING_CREATED`, `DEVICE_REGISTERED`, `ACCESS_CREATED`, `ACCESS_REVOKED`, `ACCESS_EXPIRED`, `LOCK_REQUEST`) are recorded immutably with cryptographic attribution.
