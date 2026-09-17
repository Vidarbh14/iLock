# ==============================================================================
# iLock Windows Service Uninstaller Script
# ==============================================================================

#Requires -RunAsAdministrator

param(
    [string]$ServiceName = "iLockAgent"
)

Write-Host "Stopping and removing iLock Windows Service '$ServiceName'..." -ForegroundColor Yellow

$Service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($Service) {
    if ($Service.Status -eq 'Running') {
        Stop-Service -Name $ServiceName -Force
        Start-Sleep -Seconds 2
    }
    sc.exe delete $ServiceName
    Write-Host "Service '$ServiceName' removed successfully." -ForegroundColor Green
} else {
    Write-Host "Service '$ServiceName' was not found on this system." -ForegroundColor Cyan
}
