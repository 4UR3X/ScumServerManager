<#
.SYNOPSIS
    LGSS SCUM Server Manager — Windows Host & Firewall Readiness Diagnostic Utility
    Copyright (c) 2026 Legendary Gaming (4UR3X).
.DESCRIPTION
    Verifies UDP game/query ports, Native Source RCON TCP port reachability,
    VC++ x64 runtime presence, and LGSS Remote API health on Windows Server / 10 / 11.
#>
param(
    [string]$ApiUrl = "http://127.0.0.1:8001/api/health",
    [int]$GamePort = 7777,
    [int]$QueryPort = 27015,
    [int]$RconPort = 28015
)

$ErrorActionPreference = "SilentlyContinue"
Write-Host "=== LGSS SCUM Dedicated Server Host Diagnostic ===" -ForegroundColor Cyan

# 1. Check Visual C++ 2015-2022 x64 Runtime
$vcReg = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\VisualStudio.0\VC\Runtimesd"
if ($vcReg -and $vcReg.Installed -eq 1) {
    Write-Host ("[OK] VC++ x64 Runtime Installed: v{0}.{1}.{2}" -f $vcReg.Major, $vcReg.Minor, $vcReg.Bld) -ForegroundColor Green
} else {
    Write-Host "[WARN] VC++ 2015-2022 x64 Runtime not detected (LGSS Installer provisions this automatically)." -ForegroundColor Yellow
}

# 2. Check Local LGSS Manager Service Health
try {
    $health = Invoke-RestMethod -Uri $ApiUrl -TimeoutSec 3
    if ($health.status -eq "ok") {
        Write-Host ("[OK] LGSS Manager API Online — Version v{0}" -f $health.version) -ForegroundColor Green
    }
} catch {
    Write-Host ("[INFO] LGSS Manager API not currently listening at {0}" -f $ApiUrl) -ForegroundColor DarkGray
}

# 3. Inspect TCP RCON Listener & UDP Game Ports
$tcpConn = Get-NetTCPConnection -LocalPort $RconPort -State Listen
if ($tcpConn) {
    $proc = Get-Process -Id $tcpConn[0].OwningProcess
    Write-Host ("[OK] Native Source RCON TCP/{0} Active (PID {1} - {2})" -f $RconPort, $proc.Id, $proc.ProcessName) -ForegroundColor Green
} else {
    Write-Host ("[INFO] RCON TCP/{0} is idle (starts automatically with SCUMServer.exe)." -f $RconPort) -ForegroundColor DarkGray
}

foreach ($udpPort in @($GamePort, ($GamePort + 1), $QueryPort)) {
    $udp = Get-NetUDPEndpoint -LocalPort $udpPort
    if ($udp) {
        Write-Host ("[OK] UDP/{0} Bound" -f $udpPort) -ForegroundColor Green
    } else {
        Write-Host ("[INFO] UDP/{0} Available" -f $udpPort) -ForegroundColor DarkGray
    }
}

# 4. Windows Defender Firewall Rule Verification
$fwRules = Get-NetFirewallRule | Where-Object { $_.DisplayName -match "SCUM|LGSS" -and $_.Enabled -eq "True" }
Write-Host ("Active SCUM/LGSS Windows Firewall Rules: {0}" -f @($fwRules).Count) -ForegroundColor Cyan
