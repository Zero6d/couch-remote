# Started by the "Couch Remote" scheduled task at logon. Runs the server hidden and appends its output to logs\server.log.
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'server.log'
if ((Test-Path $log) -and (Get-Item $log).Length -gt 5MB) { Remove-Item $log -Force }
Start-Process -FilePath 'node.exe' -ArgumentList 'dist/server.js' -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError (Join-Path $logDir 'server.err.log')
