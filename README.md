# iLock — Full-Stack Remote PC Access & Temporary Authorization System

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](#)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](#)
[![.NET](https://img.shields.io/badge/.NET-8.0-purple.svg)](#)
[![Security](https://img.shields.io/badge/Security-Zero--Password-emerald.svg)](#)

**iLock** is a production-quality, full-stack remote PC access and temporary authorization system. It enables an owner to grant secure, verifiable, time-bounded, and remotely revocable access to their Windows PC from an iPhone or any web browser anywhere in the world—**without ever transmitting, storing, or requesting the user's actual Windows password**, and without weakening or bypassing Windows OS security packages.

---

## 1. Product Concept & Primary Use Case

**Scenario**: You leave your Windows laptop at home. Your friend or family member needs temporary access to print a syllabus or play a game. 
Rather than giving out your permanent Windows account password or PIN:
1. The laptop is powered on and connected to Wi-Fi.
2. The **iLock Windows Agent / Service** starts automatically with Windows.
3. The Agent establishes a secure outbound TLS channel to the iLock Cloud Backend.
4. You open the iLock Progressive Web App (PWA) on your iPhone from cellular data or remote Wi-Fi.
5. You authenticate and select your computer.
6. You grant temporary access for a specified duration (e.g., 30 minutes).
7. A cryptographically signed, short-lived authorization token is dispatched to the PC.
8. The PC receives the authorization and provisions temporary access via `IWindowsAccessProvider`.
9. The session automatically expires at the exact second duration ends, locking the workstation.
10. You can hit **Revoke Access** at any second to instantly lock the workstation.

> **Network Agnostic**: The phone and the PC **never require the same Wi-Fi or LAN**. Outbound-only connectivity guarantees seamless operation across home routers, college campus networks, NAT, firewalls, and mobile hotspots with zero open ports or port-forwarding.

---

## 2. Target Architecture

```
                 ┌───────────────────┐
                 │     iPhone/Web    │
                 │   Next.js / PWA   │
                 └─────────┬─────────┘
                           │
                     HTTPS (TLS 1.3)
                           │
                           ▼
                 ┌───────────────────┐
                 │      Vercel       │
                 │ Next.js + API     │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │     Supabase      │
                 │ Auth + PostgreSQL │
                 │ Realtime          │
                 └─────────┬─────────┘
                           │
                 Outbound Secure Channel
                 (PC initiates outward)
                           │
                           ▼
                 ┌───────────────────┐
                 │   Windows Agent   │
                 │  Windows Service  │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ Windows Security  │
                 │  / Access Layer   │
                 └───────────────────┘
```

---

## 3. Core Security Invariants

- 🛡️ **Zero Windows Password Disclosure**: Actual Windows login passwords or PINs are never requested, stored, cached, or transmitted anywhere in the cloud or frontend.
- 🛡️ **No Insecure Bypasses**: No credential dumping, no LSASS injection, no unauthorized registry scraping. Privileged operations are mediated exclusively through legitimate Windows security primitives (`user32.dll` `LockWorkStation` and Windows Credential Provider contracts).
- 🛡️ **Asymmetric Cryptographic Identity**: Every PC generates a 4096-bit RSA keypair locally upon pairing. The private key remains exclusively on the PC, encrypted via the **Windows Data Protection API (DPAPI)**. Only the public key is registered with the cloud backend.
- 🛡️ **Replay & Time Drift Defense**: Every command and heartbeat packet embeds a single-use UUIDv4 nonce and authoritative UTC epoch timestamp. Timestamps outside a $\pm 120$-second tolerance or duplicate nonces are rejected as replay attacks.
- 🛡️ **Server-Authoritative Expiration**: Expiration is calculated and enforced on the cloud backend and reconciled on the agent during heartbeats. Manipulating the local PC clock cannot prolong access.
- 🛡️ **Row-Level Security (RLS)**: PostgreSQL tables enforce `auth.uid() = owner_id` on all operations.

---

## 4. Repository Structure

```
iLock/
├── apps/
│   └── web/                         # Next.js 14 Web Application & API Layer
│       ├── app/                     # App Router (/dashboard, /devices, /access, /sessions, etc.)
│       │   ├── api/                 # Typed REST API endpoints (Zod validated)
│       │   │   ├── access/          # Create, revoke, query active sessions
│       │   │   ├── agent/           # Heartbeat, challenge, command-result
│       │   │   ├── audit/           # Privacy-preserving audit logs
│       │   │   └── devices/         # Pairing, registration, lock, delete
│       ├── components/              # UI Component Library (mobile-first, dark theme)
│       ├── lib/                     # Supabase clients, demo store, API helpers
│       ├── public/                  # PWA Manifest, Service Worker, icons
│       └── middleware.ts            # Route protection
│
├── services/
│   └── windows-agent/               # Native Windows .NET 8 Worker Service
│       ├── src/                     # C# Service source (DPAPI, Crypto, CloudClient)
│       │   ├── Access/              # IWindowsAccessProvider (Demo & Win32 Lock)
│       │   ├── Commands/            # CommandDispatcher & payload models
│       │   ├── Config/              # Configuration manager & persistence
│       │   ├── Network/             # Resilient HTTP client with exponential backoff
│       │   └── Security/            # RSA-4096 key generator & NonceValidator
│       ├── tests/                   # xUnit C# automated test suite
│       ├── installer/               # PowerShell Windows Service installer scripts
│       └── runner/                  # Cross-platform TypeScript agent simulator
│
├── packages/
│   ├── shared/                      # TypeScript domain types, Zod schemas, FSM
│   └── security/                    # Cryptography, rate limiter, replay detector
│
├── supabase/
│   ├── migrations/                  # Complete PostgreSQL schema with RLS & triggers
│   ├── seed.sql                     # Seed data for demo and local testing
│   └── config.toml                  # Supabase local development configuration
│
├── docs/                            # Architectural documentation
│   ├── architecture.md              # System design specification
│   ├── security.md                  # Security principles & invariants
│   ├── threat-model.md              # STRIDE threat model & mitigation matrix
│   ├── api.md                       # Complete API reference
│   ├── windows-agent.md             # Agent service lifecycle & Win32 bindings
│   └── setup.md                     # Deployment & local runbook
│
├── tests/                           # Cross-platform protocol & security tests
├── .env.example                     # Environment configuration template
└── README.md
```

---

## 5. Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript (Strict Mode), Tailwind CSS, Lucide Icons, Progressive Web App (PWA) with offline shell support.
- **Backend**: Next.js App Router API handlers, Supabase Auth, PostgreSQL with Row Level Security (RLS).
- **Windows Agent**: C# / .NET 8 Worker Service, Windows Data Protection API (DPAPI), Win32 API (`user32.dll` `LockWorkStation`), `Microsoft.Extensions.Hosting.WindowsServices`.
- **Cryptography & Security**: RSA-4096 / SHA-256 asymmetric signing, PBKDF2/SHA-256 salted token hashing, constant-time comparisons, sliding-window rate limiters, replay detectors.
- **Testing**: xUnit (.NET 8), Node.js native test runner (`node:test`, `node:assert`).

---

## 6. Getting Started

### Prerequisites
- Node.js v20+ or v24+
- .NET 8.0 SDK (Installed locally or in PATH)
- Git & PowerShell

### Instant Local Run (Demo Mode)
iLock includes an out-of-the-box in-memory **Demo Sandbox Mode** that requires zero external configuration to test:

1. **Install dependencies and build packages**:
   ```powershell
   npm install
   npm run build --workspace=@ilock/shared
   npm run build --workspace=@ilock/security
   ```

2. **Run Web Application**:
   ```powershell
   npm run dev --workspace=apps/web
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.
   - Click **"Launch Instant Demo Mode (Vidarbh)"**.
   - Test granting temporary access, watching the live countdown, and triggering immediate revocation!

3. **Run Windows Agent**:
   In a second terminal window:
   ```powershell
   dotnet run --project services/windows-agent/src/ILock.WindowsAgent.csproj
   ```

---

## 7. Connecting to Production Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Execute `supabase/migrations/20260917000001_initial_schema.sql` in the Supabase SQL Editor.
3. Configure `apps/web/.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1...
   NEXT_PUBLIC_ENABLE_DEMO_MODE=false
   ```
4. Deploy the web app to **Vercel** with one click or `vercel deploy`.

---

## 8. Installing the Windows Background Service

To run iLock permanently in the background starting automatically with Windows:

1. Build the release executable:
   ```powershell
   dotnet publish services/windows-agent/src/ILock.WindowsAgent.csproj -c Release -r win-x64 --self-contained false
   ```

2. Pair the computer from an elevated PowerShell terminal:
   ```powershell
   & "services/windows-agent/src/bin/Release/net8.0/win-x64/publish/ILock.WindowsAgent.exe" --pair YOUR-CODE
   ```

3. Run the installer script as Administrator:
   ```powershell
   cd services/windows-agent/installer
   .\install-service.ps1
   ```

4. Verify service status:
   ```powershell
   Get-Service iLockAgent
   ```

---

## 9. Running Verification Tests

```powershell
# 1. C# .NET Unit & Integration Tests (xUnit)
dotnet test services/windows-agent/tests/ILock.WindowsAgent.Tests.csproj

# 2. Cryptographic Primitives & State Machine Tests
node --test tests/security-and-protocol.test.mjs

# 3. Full End-to-End Simulation Protocol Tests
node --test tests/integration-flow.test.mjs

# 4. Production Web Build Verification
npm run build --workspace=apps/web
```

---

## 10. Status & Implementation Matrix

| Subsystem / Feature | Implementation Status | Notes |
|---|---|---|
| **Next.js Web Application** | ✅ IMPLEMENTED | Fully functional, App Router, responsive mobile-first UI, dark mode. |
| **Progressive Web App (PWA)** | ✅ IMPLEMENTED | Web App Manifest, Service Worker offline shell, iOS standalone support. |
| **Supabase Database & RLS** | ✅ IMPLEMENTED | Complete PostgreSQL schema, automated triggers, strict RLS policies. |
| **Device Pairing & Enrollment** | ✅ IMPLEMENTED | 8-character single-use code, salted SHA-256 hash, 10m expiry, rate-limited. |
| **Asymmetric Device Identity** | ✅ IMPLEMENTED | RSA-4096 on PC, DPAPI encrypted storage, public key registered with cloud. |
| **Replay & Time Drift Defense** | ✅ IMPLEMENTED | Sliding-window UUIDv4 nonce deduplication cache, $\pm 120$s clock drift limit. |
| **Access State Machine** | ✅ IMPLEMENTED | Strictly governed `PENDING` $\to$ `AUTHORIZED` $\to$ `ACTIVE` $\to$ `EXPIRING` $\to$ `EXPIRED` / `REVOKED` / `FAILED`. |
| **Workstation Lock** | ✅ IMPLEMENTED | Win32 `user32.dll` `LockWorkStation()` called on revocation or expiration. |
| **Demo Sandbox Mode** | ✅ IMPLEMENTED | Safe simulation allowing complete verification without OS credential tampering. |
| **Windows Credential Provider** | 📋 ARCHITECTED | Integrated via `IWindowsAccessProvider`; production integration requires companion C++ COM Credential Provider. |
| **Passkeys / WebAuthn** | 📋 ARCHITECTED | Database schema and auth endpoints designed for direct FIDO2 / Face ID extension. |

---

## 11. Important Product Limitation

> **Important Architecture Notice**:
> Vercel is the cloud and web control layer. The Windows Agent is the on-device component that interacts with Windows.
> Vercel cannot directly manipulate a user's Windows computer without the Agent. The system requires:
> **PC powered on** + **PC connected to Internet** + **iLock Agent running** for remote authorizations and lock commands to reach the PC.
