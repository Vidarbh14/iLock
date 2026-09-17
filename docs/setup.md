# iLock Local Development & Deployment Setup Guide

## 1. Prerequisites

### Software Dependencies
- **Node.js**: v20+ or v24+
- **npm**: v10+ or v11+
- **.NET SDK**: 8.0+ (Installed at `$env:LOCALAPPDATA\Microsoft\dotnet` or global PATH)
- **Git**: 2.40+
- **PowerShell**: 5.1 or 7+ (Administrator privileges needed only for Windows Service registration)

---

## 2. Quickstart: Instant Demo Mode (Zero-Config)

You can run and test the complete iLock full-stack application immediately without setting up an external database.

### Step 1: Install Dependencies & Build Packages
```powershell
npm install
npm run build --workspace=@ilock/shared
npm run build --workspace=@ilock/security
```

### Step 2: Start the Web Application
```powershell
npm run dev --workspace=apps/web
```
The web dashboard will be available at [http://localhost:3000](http://localhost:3000).
- Click **"Launch Instant Demo Mode (Vidarbh)"** to explore the dashboard.
- Pre-seeded devices ("Vidarbh's OMEN 16" and "Workstation ThinkPad X1") are immediately accessible.

### Step 3: Run the Windows Agent (.NET 8)
In a separate terminal window:
```powershell
dotnet run --project services/windows-agent/src/ILock.WindowsAgent.csproj
```
The agent starts in sandbox demo mode, initiates its RSA-4096 cryptographic identity, and connects via outbound HTTP/heartbeats to `http://localhost:3000`.

---

## 3. Production Supabase Configuration

### Step 1: Create Supabase Project
1. Visit [https://supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL**, **Anon Key**, and **Service Role Secret**.

### Step 2: Apply Database Migrations
In the Supabase SQL Editor:
1. Open and run `supabase/migrations/20260917000001_initial_schema.sql`.
2. (Optional) Run `supabase/seed.sql` to populate sample devices and profiles.

### Step 3: Configure Environment Variables
Copy `.env.example` to `apps/web/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsIn...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsIn...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_DEMO_MODE=false
```

---

## 4. Building & Installing the Windows Service

### Step 1: Build the Release Binary
```powershell
dotnet publish services/windows-agent/src/ILock.WindowsAgent.csproj -c Release -r win-x64 --self-contained false
```

### Step 2: Pair the Workstation
From the Web Dashboard, click **Add PC** to get an 8-character pairing code (e.g. `ABCD-EFGH`). Then run:
```powershell
& "services/windows-agent/src/bin/Release/net8.0/win-x64/publish/ILock.WindowsAgent.exe" --pair ABCD-EFGH
```

### Step 3: Install the Windows Service
Open an **Elevated PowerShell Prompt** (Run as Administrator):
```powershell
cd services/windows-agent/installer
.\install-service.ps1
```

Verify service is running:
```powershell
Get-Service iLockAgent
```

---

## 5. Running Automated Tests

Run the full cross-platform cryptographic, protocol, and state-machine test suite:
```powershell
# C# .NET Unit & Integration Tests
dotnet test services/windows-agent/tests/ILock.WindowsAgent.Tests.csproj

# Protocol & Cryptography Tests
node --test tests/security-and-protocol.test.mjs
node --test tests/integration-flow.test.mjs
```
