#Requires -RunAsAdministrator
# Removes the scheduled task and firewall rule. Leaves Wake-on-LAN and hibernate settings as they are.
$ErrorActionPreference = 'Stop'
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.CommandLine -match 'dist[\\/]server\.js' } | Stop-Process -Force
Unregister-ScheduledTask -TaskName 'Couch Remote' -Confirm:$false -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName 'Couch Remote' -ErrorAction SilentlyContinue
Write-Host 'Couch Remote task and firewall rule removed.'
