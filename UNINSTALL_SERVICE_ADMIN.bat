@echo off
:: ==============================================================================
:: iLock Windows Service Uninstaller - 1-Click Administrator Launcher
:: ==============================================================================
echo ==========================================================
echo       iLock Remote Security Agent - Service Uninstaller
echo ==========================================================
echo.

net session >nul 2>&1
if %errorLevel% == 0 (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0services\windows-agent\installer\uninstall-service.ps1"
    echo.
    echo Press any key to exit...
    pause >nul
) else (
    echo Requesting Administrator privileges to uninstall the service...
    powershell.exe -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
)
