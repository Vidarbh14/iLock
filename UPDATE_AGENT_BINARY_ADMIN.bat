@echo off
:: ==============================================================================
:: iLock Windows Service Binary Updater - 1-Click Administrator Launcher
:: Stops the service, copies newly compiled publish-v2 binary to publish, and restarts
:: ==============================================================================
echo ==========================================================
echo        iLock Remote Security Agent - Binary Updater
echo ==========================================================
echo.

net session >nul 2>&1
if %errorLevel% == 0 (
    echo [1/3] Stopping iLockAgent service...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Stop-Service iLockAgent -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 1"

    echo [2/3] Updating binary from publish-v2...
    copy /Y "%~dp0services\windows-agent\src\bin\Release\net8.0\win-x64\publish-v2\ILock.WindowsAgent.exe" "%~dp0services\windows-agent\src\bin\Release\net8.0\win-x64\publish\ILock.WindowsAgent.exe"

    echo [3/3] Starting updated iLockAgent service...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Service iLockAgent; Start-Sleep -Seconds 2; Get-Service iLockAgent"
    echo.
    echo iLock Windows Agent successfully updated and running!
    pause
) else (
    echo Requesting Administrator privileges to update the Windows Service binary...
    powershell.exe -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
)
