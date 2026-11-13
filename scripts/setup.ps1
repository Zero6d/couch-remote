#Requires -RunAsAdministrator
<#
.SYNOPSIS
  One-time setup of Couch Remote on the gaming PC. Run from an elevated PowerShell:
    powershell -ExecutionPolicy Bypass -File scripts\setup.ps1

  What it does:
    1. Installs Node.js LTS with winget if node is missing.
    2. npm install + build.
    3. Enables Wake-on-LAN (magic packet) on every wired adapter that is up.
    4. Turns hibernate off (-KeepHibernate to skip). This also disables Fast Startup,
       which is what lets Wake-on-LAN work after a full shutdown. Sleep is unaffected.
    5. Opens TCP 7777 on the Private firewall profile and marks the current network Private.
    6. Registers a scheduled task that starts the server hidden at every logon, then starts it now.
    7. Prints the pairing QR code.
#>
param(
  [switch]$KeepHibernate,
  [switch]$SkipNetworkPrivate,
  [int]$Port = 7777
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$taskName = 'Couch Remote'

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }

Step 'Node.js'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'node not found, installing Node.js LTS via winget...'
  winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
$nodeVersion = (& node -v)
Write-Host "node $nodeVersion"
$major = [int]($nodeVersion.TrimStart('v').Split('.')[0])
if ($major -lt 20) { throw "Node 20 or newer is required, found $nodeVersion" }

Step 'Install and build'
Push-Location $root
try {
  & npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }
} finally { Pop-Location }

Step 'Wake-on-LAN'
$adapters = Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' -and $_.PhysicalMediaType -match '802.3' }
if (-not $adapters) { Write-Warning 'No wired adapter is up. Wake-on-LAN needs Ethernet; Wi-Fi adapters rarely support it.' }
foreach ($a in $adapters) {
  Write-Host "$($a.Name) ($($a.InterfaceDescription)) MAC $($a.MacAddress)"
  try {
    Set-NetAdapterPowerManagement -Name $a.Name -WakeOnMagicPacket Enabled -ErrorAction Stop
    Write-Host '  power management: wake on magic packet enabled'
  } catch { Write-Warning "  power management: $($_.Exception.Message)" }

  # Vendor-specific switches (Realtek "Shutdown Wake-On-Lan", Intel "Wake on Magic Packet", ...).
  $props = Get-NetAdapterAdvancedProperty -Name $a.Name | Where-Object {
    $_.DisplayName -match 'Wake on Magic Packet|Shutdown Wake|Wake on Magic Packet from power off|WOL'
  }
  foreach ($p in $props) {
    $on = @($p.ValidDisplayValues) | Where-Object { $_ -match '^(Enabled|On|Yes)$' } | Select-Object -First 1
    if (-not $on) { Write-Host "  skip '$($p.DisplayName)': no Enabled value among $($p.ValidDisplayValues -join ', ')"; continue }
    if ($p.DisplayValue -eq $on) { Write-Host "  '$($p.DisplayName)' already $on"; continue }
    Set-NetAdapterAdvancedProperty -Name $a.Name -DisplayName $p.DisplayName -DisplayValue $on
    Write-Host "  '$($p.DisplayName)': $($p.DisplayValue) -> $on"
  }
}

Step 'Power settings'
if ($KeepHibernate) {
  Write-Host 'hibernate left as is (-KeepHibernate). Wake-on-LAN after a full shutdown may not work while Fast Startup is on.'
} else {
  powercfg /hibernate off
  Write-Host 'hibernate and Fast Startup turned off (sleep still works; the Sleep button always suspends to RAM)'
}

Step 'Firewall'
Remove-NetFirewallRule -DisplayName $taskName -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName $taskName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private | Out-Null
Write-Host "inbound TCP $Port allowed on the Private profile"
if (-not $SkipNetworkPrivate) {
  foreach ($profile in Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Public' }) {
    Set-NetConnectionProfile -InterfaceIndex $profile.InterfaceIndex -NetworkCategory Private
    Write-Host "network '$($profile.Name)' changed from Public to Private so the phone can reach this PC"
  }
}

Step 'Scheduled task (starts the server hidden at logon)'
$psExe = (Get-Command powershell.exe).Source
$action = New-ScheduledTaskAction -Execute $psExe -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root\scripts\start.ps1`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'dist[\\/]server\.js' } | Stop-Process -Force
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3
$state = (Get-ScheduledTask -TaskName $taskName).State
Write-Host "task '$taskName' registered, state: $state. Log: $root\logs\server.log"

Step 'Pair your phone'
Push-Location $root
try { & npm run --silent pair } finally { Pop-Location }
Write-Host "Wake-on-LAN MAC for Moonlight / a WoL app: $(($adapters | Select-Object -First 1).MacAddress)"
Write-Host 'Done. Give this PC a fixed IP in your router (DHCP reservation) so the phone link never changes.'
