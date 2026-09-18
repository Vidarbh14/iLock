# ==============================================================================
# iLock Windows Service Installer Script
# Installs iLockAgent as an automatic Windows Service
# ==============================================================================

#Requires -RunAsAdministrator

param(
    [string]$ServiceName = "iLockAgent",
    [string]$DisplayName = "iLock Remote Security Agent",
    [string]$Description = "Manages remote authorized temporary access sessions for iLock without exposing Windows credentials.",
    [string]$BinPath = "$PSScriptRoot\..\src\bin\Release\net8.0\win-x64\publish\ILock.WindowsAgent.exe"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         iLock Windows Service Installer                  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Verify executable existence
if (-not (Test-Path $BinPath)) {
    # Check debug binary if publish binary isn't built yet
    $DebugBin = "$PSScriptRoot\..\src\bin\Debug\net8.0\ILock.WindowsAgent.exe"
    if (Test-Path $DebugBin) {
        $BinPath = (Resolve-Path $DebugBin).Path
        Write-Host "Notice: Using Debug build at $BinPath" -ForegroundColor Yellow
    } else {
        Write-Error "Executable not found at $BinPath. Please run 'dotnet publish -c Release -r win-x64' first."
        exit 1
    }
} else {
    $BinPath = (Resolve-Path $BinPath).Path
}

# Kill any running user-mode agent processes first
Get-Process *ILock.WindowsAgent* -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Remove any old user-level startup shortcut to prevent duplicate polling
$StartupShortcut = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\iLockAgent.lnk"
if (Test-Path $StartupShortcut) {
    Write-Host "Removing user-mode startup shortcut at '$StartupShortcut'..." -ForegroundColor Yellow
    Remove-Item -Path $StartupShortcut -Force -ErrorAction SilentlyContinue
}

# Stop and remove existing service if present
$ExistingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($ExistingService) {
    Write-Host "Stopping existing service '$ServiceName'..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "Removing existing service..." -ForegroundColor Yellow
    sc.exe delete $ServiceName
    Start-Sleep -Seconds 2
}

# Create Windows Service
Write-Host "Creating Windows Service '$ServiceName' under LocalSystem..." -ForegroundColor Green
New-Service -Name $ServiceName `
            -BinaryPathName "`"$BinPath`"" `
            -DisplayName $DisplayName `
            -Description $Description `
            -StartupType Automatic

# Configure failure recovery actions (Restart service after 1 minute)
sc.exe failure $ServiceName reset= 86400 actions= restart/60000/restart/60000/restart/60000

# Start Service
Write-Host "Starting '$ServiceName'..." -ForegroundColor Green
Start-Service -Name $ServiceName
Start-Sleep -Seconds 2

$Status = (Get-Service -Name $ServiceName).Status
Write-Host "Service '$ServiceName' is now: $Status" -ForegroundColor Cyan
Write-Host "Installation completed successfully! The agent now runs with SYSTEM privileges capable of unlocking the Windows lock screen." -ForegroundColor Green
