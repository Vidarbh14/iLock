# iLock Windows Agent & Service Installer

This directory contains deployment scripts and administration guides for running the iLock Windows Agent as a native Windows Service (`iLockAgent`).

## Prerequisites
- Windows 10 (Build 19041+) or Windows 11 / Windows Server 2022.
- .NET 8.0 Runtime or SDK (x64).
- Local Administrator privileges (required only for registering system services via Windows Service Control Manager).

## Step-by-Step Installation

### 1. Build the Binary
From the repository root or agent directory:
```powershell
dotnet publish services\windows-agent\src\ILock.WindowsAgent.csproj -c Release -r win-x64 --self-contained false
```

### 2. Pair Your PC Before Service Startup
Run the agent in interactive console mode once to pair it with your account using the 8-character pairing code generated on your iLock Dashboard:
```powershell
& "services\windows-agent\src\bin\Release\net8.0\win-x64\publish\ILock.WindowsAgent.exe" --pair ABCD-EFGH
```
This generates the asymmetric RSA keypair, encrypts the private key via Windows DPAPI, registers the public key with the backend, and stores the configuration in `C:\ProgramData\iLock\agent_config.json`.

### 3. Install as an Automatic Windows Service
Launch an elevated PowerShell prompt (Run as Administrator):
```powershell
& ".\install-service.ps1"
```

### 4. Verify Service Operation
Check the service status:
```powershell
Get-Service iLockAgent
```
Or check Windows Event Logs:
```powershell
Get-WinEvent -ProviderName "iLockAgent" -MaxEvents 20
```

### 5. Uninstalling
To stop and cleanly remove the service:
```powershell
& ".\uninstall-service.ps1"
```
