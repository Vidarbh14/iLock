# iLock Comprehensive Threat Model & Security Analysis

## 1. Threat Modeling Methodology

iLock applies the **STRIDE** methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) across all three trust zones:
1. **Remote Control Boundary** (Owner's iPhone / Web Browser / PWA)
2. **Cloud Boundary** (Next.js Application, API Layer, Supabase PostgreSQL, Supabase Realtime)
3. **Endpoint Boundary** (Windows Agent Service, DPAPI Local Key Storage, Win32 / Credential Provider)

---

## 2. Threat Vector Matrix & Mitigations

| # | Threat Vector | Risk Severity | Target Asset | Architectural Defense / Mitigation |
|---|---|---|---|---|
| 1 | **Stolen / Compromised Phone** | High | Access Session Creation | Sessions are time-bounded (default 15–30m). WebAuthn biometric re-prompting (Face ID / Touch ID) required for sensitive grants. Remote lock and revocation can be triggered from any other browser via Supabase Auth session revocation. |
| 2 | **Stolen / Intercepted Pairing Code** | Medium | Device Enrollment | Pairing codes expire authoritatively in 10 minutes. Strictly single-use: invalidated the millisecond enrollment succeeds. Never exposed in plaintext logs. High entropy ($32^8 \approx 10^{12}$). |
| 3 | **Brute-Force Pairing Code Guessing** | High | Device Registration API | Sliding-window IP rate limiting (maximum 5 attempts per minute). IP address hashing and automatic temporary IP blacklisting upon successive failed attempts. |
| 4 | **Replay Attacks (MITM Packet Replay)** | High | Command Execution / Access Grants | Every packet contains a UUIDv4 nonce and authoritative UTC epoch timestamp. Sliding-window deduplication cache on both cloud and agent. Clock skew tolerance is strictly $\le 120$ seconds. |
| 5 | **Local Clock Manipulation on PC** | Medium | Session Expiration Bypass | Expiration is validated authoritatively against server time returned on periodic 30-second heartbeats. Local clock tampering cannot prolong access; stale sessions lock the workstation. |
| 6 | **Impersonated / Fake Device** | Critical | Cloud Command Delivery | Every PC enrolls an asymmetric RSA-4096 / ECDSA public key. Heartbeats and command confirmations must be signed by the matching private key. Device IDs are never trusted on their own. |
| 7 | **Compromised Backend / DB Leak** | Critical | Windows Credentials | **Zero Windows passwords stored.** Even if the entire cloud database is leaked, zero Windows passwords, PINs, or private keys exist in the database. Only public keys and hashed pairing tokens are stored. |
| 8 | **Malicious / Compromised PC Agent** | High | User Account Takeover | The Agent runs with least-privilege service credentials. Privileged operations are mediated through legitimate Windows APIs (`LockWorkStation`, Credential Provider IPC) rather than arbitrary code execution. |
| 9 | **Cross-Site Request Forgery (CSRF)** | Medium | Access Creation & Revocation | Next.js route handlers validate `SameSite=Lax` or `Strict` cookie policies, reject cross-origin preflights, and require explicit Authorization headers. |
| 10 | **Cross-Site Scripting (XSS)** | High | Session Hijacking | Modern Next.js React JSX automatic escaping, strict Content Security Policy (CSP), `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY` headers. |
| 11 | **SQL Injection (SQLi)** | Critical | Database State | All database queries use parameterized prepared statements via Supabase/PostgREST. Zero raw string interpolation in SQL queries. |
| 12 | **Insecure Direct Object References (IDOR)** | Critical | Device & Session Control | Strict PostgreSQL Row Level Security (RLS) enforced at the database engine level. `auth.uid() = owner_id` guarantees users can only access their own devices. |
| 13 | **Stale / Zombie Authorizations** | Medium | Physical PC Access | Automated background reconciler (`expire_stale_access_sessions()`) transitions `ACTIVE` sessions to `EXPIRED`. Windows Agent verifies expiry locally every loop. |
| 14 | **Network Interruption / Offline PC** | Low | Access State Inconsistency | PC marked offline after 90 seconds without a heartbeat. Commands queued for offline machines expire after 60 seconds to prevent sudden unexpected unlocking when internet reconnects. |
| 15 | **Denial of Service (DoS) Flood** | Medium | Heartbeat API | Rate-limited at 60 heartbeats / minute / device. Exponential backoff and jitter implemented in agent communication layer. |
| 16 | **Private Key Extraction from PC Disk** | High | Device Identity | Stored encrypted using Windows Data Protection API (DPAPI) with `DataProtectionScope.CurrentUser` or `LocalMachine`. |

---

## 3. Residual Risk & Assumptions

- **Physical Host Integrity**: If an attacker has full physical access, BitLocker disk encryption is presumed enabled. iLock does not replace disk encryption or firmware security.
- **TLS Trust Chain**: All communications assume genuine TLS 1.3 certificates verified against standard OS root CA trust stores.
