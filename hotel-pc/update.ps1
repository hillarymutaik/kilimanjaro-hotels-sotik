# Pulls the latest code from GitHub, rebuilds and restarts the server.
# Bookings and photos (in data/) are not touched. Run as Administrator:
#   powershell -ExecutionPolicy Bypass -File hotel-pc\update.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

node --env-file-if-exists=.env scripts/backup.mjs
git pull --ff-only
npm ci
npm run build
Stop-ScheduledTask -TaskName 'Kilimanjaro Hotels server'
Start-ScheduledTask -TaskName 'Kilimanjaro Hotels server'
Write-Host 'Updated and restarted.'
