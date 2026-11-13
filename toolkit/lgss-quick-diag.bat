@echo off
REM ===========================================================================
REM LGSS SCUM Server Manager — Quick Windows Port & Service Probe Utility
REM Copyright (c) 2026 Legendary Gaming (4UR3X).
REM ===========================================================================
setlocal EnableExtensions EnableDelayedExpansion

set "LGSS_API_PORT=8001"
set "SCUM_GAME_PORT=7777"
set "SCUM_RCON_PORT=28015"

if not "%~1"=="" set "SCUM_RCON_PORT=%~1"

echo ============================================================
echo   LGSS SCUM Server Manager - Quick Host Connectivity Check
echo ============================================================
echo.

echo [1/3] Checking SCUMServer.exe process state...
tasklist /FI "IMAGENAME eq SCUMServer.exe" 2>NUL | find /I "SCUMServer.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo   [OK] SCUMServer.exe is currently running.
) else (
    echo   [INFO] SCUMServer.exe is not currently active.
)

echo.
echo [2/3] Checking Native Source RCON TCP listener on port %SCUM_RCON_PORT%...
netstat -ano -p TCP | findstr /R /C:":%SCUM_RCON_PORT% .*LISTENING" >NUL
if "%ERRORLEVEL%"=="0" (
    echo   [OK] TCP port %SCUM_RCON_PORT% is LISTENING.
) else (
    echo   [INFO] TCP port %SCUM_RCON_PORT% is not listening yet.
)

echo.
echo [3/3] Checking LGSS Manager local backend port %LGSS_API_PORT%...
netstat -ano -p TCP | findstr /R /C:":%LGSS_API_PORT% .*LISTENING" >NUL
if "%ERRORLEVEL%"=="0" (
    echo   [OK] LGSS Manager API port %LGSS_API_PORT% is LISTENING.
) else (
    echo   [INFO] LGSS Manager API port %LGSS_API_PORT% is closed.
)

echo.
endlocal
exit /b 0
