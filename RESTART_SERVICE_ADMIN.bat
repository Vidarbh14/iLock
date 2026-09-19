@echo off
:: ==============================================================================
:: iLock Windows Service Restarter - 1-Click Administrator Launcher
:: ==============================================================================
echo ==========================================================
echo        iLock Remote Security Agent - Service Restarter
echo ==========================================================
echo.

net session >nul 2>&1
if %errorLevel% == 0 (
    echo Administrative privileges confirmed. Restarting iLockAgent...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Restart-Service iLockAgent -Force; Start-Sleep -Seconds 2; Get-Service iLockAgent"
    echo.
    echo Service successfully restarted.
    pause
) else (
    echo Requesting Administrator privileges to restart the Windows Service...
    powershell.exe -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
)
