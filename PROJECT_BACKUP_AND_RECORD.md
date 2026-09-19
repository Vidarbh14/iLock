# iLock — Master Project Backup & Disaster Recovery Record
**Generated On:** September 19, 2026 • 21:49:30 IST  
**Git Stable Release Tag:** `v1.0.0-stable`  
**Git Backup Branch:** `backup-stable-state`  
**Git Commit Hash:** `c153832`  
**Remote Repository:** `https://github.com/Vidarbh14/iLock.git`  
**Live Production URL:** `https://ilock-web.vercel.app`

---

> [!IMPORTANT]
> **SAFETY GUARANTEE**
> This file contains all configuration records, architecture secrets, service commands, and disaster recovery procedures for the iLock project. 
> 
> A pristine snapshot of this exact working state is saved both locally and remotely in GitHub under git branch `backup-stable-state` and tag `v1.0.0-stable`. If any experiment damages the project, follow the **One-Command Instant Recovery** section below to restore everything in seconds.

---

## 1. One-Command Instant Recovery

If experiments break any code, design, or configuration, run these commands in PowerShell in this directory:

### Option A: Complete Git Rollback (Restores all files to working state)
```powershell
# Discard all uncommitted changes and revert to the verified stable snapshot
git fetch origin
git checkout main
git reset --hard v1.0.0-stable
git clean -fd
npm run build --workspace=apps/web
```

### Option B: Switch to the Safe Backup Branch
```powershell
git checkout backup-stable-state
```

### Option C: Re-Deploy Clean State to Live Production Vercel
```powershell
git checkout main
git reset --hard v1.0.0-stable
git push origin main --force
```

### Option D: Restart Local Windows Security Agent Service
Run [RESTART_SERVICE_ADMIN.bat](file:///C:/Users/vidar/OneDrive/Desktop/iLock/RESTART_SERVICE_ADMIN.bat) as Administrator, or in Administrator PowerShell:
```powershell
Restart-Service iLockAgent
Get-Service iLockAgent
```

---

## 2. Live Cloud & Production Infrastructure

### Vercel Production Web App
- **Production URL:** `https://ilock-web.vercel.app`
- **Dashboard URL:** `https://ilock-web.vercel.app/dashboard`
- **Deployment Trigger:** Automatic on push to `origin/main`
- **Current Theme:** Clean Apple Light (`#f5f5f7` canvas, `#ffffff` frosted glass cards, `#1d1d1f` dark charcoal typography, `#0071e3` Apple blue accents).

### Supabase Cloud Database & Auth
- **Project Reference:** `cbojoadbobwocjtgprcq`
- **Project Name:** `Vidarbh14's Project`
- **Organization ID:** `cbaqvmvqzbufvjnfervi`
- **Region:** AWS `ap-south-1` (Mumbai)
- **Database URL:** `https://cbojoadbobwocjtgprcq.supabase.co`

### Environment Variables (`apps/web/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://cbojoadbobwocjtgprcq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNib2pvYWRib2J3b2NqdGdwcmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MDIwNTMsImV4cCI6MjEwNTI3ODA1M30.WV4AA2hixoZDQ-5Nzv4YQHN_vazt6qJL5DwJFfrSlBg
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNib2pvYWRib2J3b2NqdGdwcmNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTcwMjA1MywiZXhwIjoyMTA1Mjc4MDUzfQ.H1qOfHhsIv9019TjKcSW2BHFmlwAhBl2K24zxejya_Q
NEXT_PUBLIC_APP_URL=https://ilock-web.vercel.app
NEXT_PUBLIC_ENABLE_DEMO_MODE=true
DEVICE_OFFLINE_THRESHOLD_SECONDS=90
HEARTBEAT_INTERVAL_SECONDS=30
RATE_LIMIT_PAIRING_REQUESTS_PER_MINUTE=5
RATE_LIMIT_COMMANDS_PER_MINUTE=20
```

---

## 3. Windows Security Agent Service (Local Machine)

### Windows Service Details
- **Service Name:** `iLockAgent`
- **Display Name:** `iLock Remote Security Agent`
- **Log On As:** `LocalSystem`
- **Startup Type:** `Automatic` (starts silently upon computer boot before user logon)
- **Binary Executable Path:**
  `C:\Users\vidar\OneDrive\Desktop\iLock\services\windows-agent\src\bin\Release\net8.0\win-x64\publish\ILock.WindowsAgent.exe`
- **Current Status:** `Running` (1-second heartbeat polling cycle)

### Machine Pairing & Device Records (`C:\ProgramData\iLock\agent_config.json`)
```json
{
  "BackendUrl": "https://ilock-web.vercel.app",
  "DeviceUuid": "a3059898-aacf-4538-80eb-08caf1375cba",
  "DeviceName": "VIDHU",
  "Hostname": "VIDHU",
  "AgentVersion": "1.0.0",
  "HeartbeatIntervalSeconds": 1,
  "OfflineThresholdSeconds": 30,
  "AuthToken": "0a92ace9f5f3b9e0560564a447cdf4481e089d0acd1b18cad8f3480e7bb10417",
  "DemoMode": false
}
```

### Local Storage & Cryptographic Keys
- `C:\ProgramData\iLock\agent_config.json` — Device UUID, backend URL, device authentication token.
- `C:\ProgramData\iLock\credentials.dat` — Windows DPAPI-encrypted user login credentials for automated biometric unlock.
- `C:\ProgramData\iLock\device_identity.dat` — 4096-bit RSA asymmetric keypair. Private key is never exported.
- `C:\ProgramData\iLock\unlock_helper.log` — Execution log of background biometric unlock triggers.

### Windows Service Helper Scripts
- **Install Service:** [INSTALL_SERVICE_ADMIN.bat](file:///C:/Users/vidar/OneDrive/Desktop/iLock/INSTALL_SERVICE_ADMIN.bat)
- **Restart Service:** [RESTART_SERVICE_ADMIN.bat](file:///C:/Users/vidar/OneDrive/Desktop/iLock/RESTART_SERVICE_ADMIN.bat)
- **Uninstall Service:** [UNINSTALL_SERVICE_ADMIN.bat](file:///C:/Users/vidar/OneDrive/Desktop/iLock/UNINSTALL_SERVICE_ADMIN.bat)

---

## 4. Database Schema Summary

The cloud database runs PostgreSQL with Row Level Security (RLS) on Supabase.
Primary tables and schema definition can be viewed at [supabase/migrations/20260917000001_initial_schema.sql](file:///C:/Users/vidar/OneDrive/Desktop/iLock/supabase/migrations/20260917000001_initial_schema.sql):

1. **`devices`**:
   - `id` (UUID, PK), `user_id` (UUID), `device_name` (TEXT), `hostname` (TEXT), `device_uuid` (TEXT, UNIQUE), `public_key` (TEXT), `public_key_algorithm` (TEXT), `auth_token_hash` (TEXT), `status` (TEXT: `online` / `offline` / `connecting`), `last_seen` (TIMESTAMPTZ), `agent_version` (TEXT).
2. **`device_status`**:
   - `device_id` (UUID, FK), `workstation_locked` (BOOLEAN), `raw_telemetry` (JSONB: battery, CPU, RAM, disk, Wi-Fi SSID, Wi-Fi signal, IP, console user), `updated_at` (TIMESTAMPTZ).
3. **`access_sessions`**:
   - `id` (UUID, PK), `device_id` (UUID, FK), `duration_minutes` (INT), `status` (TEXT: `ACTIVE`, `EXPIRING`, `EXPIRED`, `REVOKED`), `expires_at` (TIMESTAMPTZ), `metadata` (JSONB).
4. **`command_queue`**:
   - `id` (UUID, PK), `device_id` (UUID, FK), `command_type` (TEXT: `LOCK`, `UNLOCK`), `payload` (JSONB), `status` (TEXT: `PENDING`, `DISPATCHED`, `COMPLETED`, `FAILED`), `created_at` (TIMESTAMPTZ).
5. **`audit_logs`**:
   - `id` (UUID, PK), `event_type` (TEXT), `device_id` (UUID), `reason` (TEXT), `success` (BOOLEAN), `ip_hash` (TEXT), `timestamp` (TIMESTAMPTZ).

---

## 5. Repository Architecture & Codebase Map

```
iLock/
├── apps/
│   └── web/                               # Next.js 14 Web Application (Clean Apple Light Theme)
│       ├── app/
│       │   ├── access/page.tsx            # Grant temporary access authorization workflow
│       │   ├── dashboard/page.tsx         # Live Command Center, active session monitors
│       │   ├── devices/page.tsx           # Device catalog and search filters
│       │   ├── devices/[id]/page.tsx      # Live hardware telemetry (CPU, RAM, Disk, Wi-Fi, Battery)
│       │   ├── login/page.tsx             # User authentication with Instant Demo Mode
│       │   ├── security/page.tsx          # Cryptographic audit trails & security architecture
│       │   ├── sessions/page.tsx          # Real-time session timer & emergency revocation
│       │   ├── settings/page.tsx          # Account profile, sandbox switch, passkey configuration
│       │   ├── globals.css                # Frosted glass (.glass-card, .glass-modal, apple-input)
│       │   ├── layout.tsx                 # Root layout with Apple Light theme meta colors
│       │   └── ...
│       ├── components/
│       │   ├── BiometricUnlockModal.tsx   # WebAuthn Face ID / Fingerprint unlock prompt
│       │   ├── ConfirmRevokeModal.tsx     # Emergency kill-switch modal
│       │   ├── DeviceCard.tsx             # Hardware widget with quick Lock/Unlock/Grant actions
│       │   ├── DeviceStatusBadge.tsx      # Online/Offline/Locked/Active badge indicators
│       │   ├── GrantAccessModal.tsx       # Quick duration presets (15m, 30m, 1h, 2h)
│       │   ├── Navbar.tsx                 # Desktop frosted glass header
│       │   ├── BottomNav.tsx              # Mobile bottom navigation bar
│       │   ├── PairDeviceModal.tsx        # One-time cryptographic pairing code generator
│       │   └── SessionCountdown.tsx       # Real-time animated progress bar countdown
│       └── tailwind.config.ts             # Clean Apple Light color definitions
├── services/
│   └── windows-agent/                     # .NET 8 C# Windows Background Service
│       └── src/
│           ├── Program.cs                 # Host builder & Windows Service daemon entry point
│           ├── WindowsAgentService.cs     # 1-second polling heartbeat & command dispatcher
│           ├── SystemControl/             # Win32 LockWorkStation & Credential Provider unlock
│           ├── Telemetry/                 # WMI queries for CPU, RAM, SSD, Wi-Fi, battery metrics
│           └── Crypto/                    # 4096-bit RSA signature generation & verification
├── packages/
│   └── shared/                            # TypeScript interfaces shared between frontend & backend
├── supabase/
│   └── migrations/                        # SQL database schema and security policies
└── scripts/                               # Deployment & build automation scripts
```

---

## 6. How to Re-Build the Entire Solution

### Rebuild Web Frontend
```powershell
npm run build --workspace=apps/web
```

### Recompile Windows Agent (.NET 8 C#)
```powershell
dotnet publish services/windows-agent/src/ILock.WindowsAgent.csproj -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -o services/windows-agent/src/bin/Release/net8.0/win-x64/publish
```

---

## 7. Experiment Safety Guidelines

1. **Working on Web/Design Experiments?**
   - You can edit any file in `apps/web/`.
   - If anything breaks, run `git checkout -- apps/web` to immediately revert to the pristine Apple Light theme.
2. **Working on Agent Experiments?**
   - Stop the service first: `net stop iLockAgent`
   - Test your changes manually with `ILock.WindowsAgent.exe --console`
   - If anything breaks, restore the published binary and restart: `net start iLockAgent`
3. **Want to start a new experiment on a clean branch?**
   - Run `git checkout -b my-new-experiment`
   - Test whatever you want safely without touching `main` or `backup-stable-state`.
   - Switch back anytime with `git checkout main`.

---
*Snapshot verified and certified working on September 19, 2026.*
