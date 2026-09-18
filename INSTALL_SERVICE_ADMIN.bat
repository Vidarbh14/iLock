@echo off
:: ==============================================================================
:: iLock Windows Service Installer - 1-Click Administrator Launcher
:: Automatically requests UAC elevation to install the background service
:: ==============================================================================
echo ==========================================================
echo        iLock Remote Security Agent - Service Installer
echo ==========================================================
echo.

:: Check for Administrative privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Administrative privileges confirmed. Installing Windows Service...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0services\windows-agent\installer\install-service.ps1"
    echo.
    echo Press any key to exit...
    pause >nul
) else (
    echo Requesting Administrator privileges to install the Windows Service...
    powershell.exe -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
)
