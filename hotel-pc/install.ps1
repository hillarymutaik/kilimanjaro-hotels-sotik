# One-time setup on the hotel PC. Run in PowerShell as Administrator:
#   powershell -ExecutionPolicy Bypass -File hotel-pc\install.ps1 -TunnelToken <token>
# Leave out -TunnelToken to set up only the local server (http://localhost:3001).
param([string]$TunnelToken = '')

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole('Administrators')) {
  throw 'Run this in PowerShell as Administrator.'
}

# 1. Node.js 22.13 or newer
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  Write-Host 'Installing Node.js LTS...'
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  $node = (Get-Command node).Source
}
$v = [version]((& $node -v).TrimStart('v'))
if ($v -lt [version]'22.13.0') { throw "Node.js $v is too old. Install 22.13 or newer from nodejs.org." }

# 2. Settings file (.env) with the admin login
if (-not (Test-Path .env)) {
  $pw = Read-Host 'Choose an admin password (at least 12 characters)'
  if ($pw.Length -lt 12) { throw 'Password too short.' }
  @"
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$pw
DATA_DIR=./data
PORT=3001
NODE_ENV=production
"@ | Set-Content -Encoding utf8 .env
  Write-Host 'Created .env'
}

# 3. Build the website and admin panel
npm ci
npm run build

# 4. Start the server at boot (even before anyone logs in), restarting it if it stops
$serverArgs = '--env-file-if-exists=.env server/index.js'
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
Register-ScheduledTask -TaskName 'Kilimanjaro Hotels server' -Force -Principal $principal -Settings $settings `
  -Trigger (New-ScheduledTaskTrigger -AtStartup) `
  -Action (New-ScheduledTaskAction -Execute $node -Argument $serverArgs -WorkingDirectory $root) | Out-Null

# 5. Daily backup at 02:00 into the backups folder next to data
Register-ScheduledTask -TaskName 'Kilimanjaro Hotels backup' -Force -Principal $principal -Settings $settings `
  -Trigger (New-ScheduledTaskTrigger -Daily -At 2am) `
  -Action (New-ScheduledTaskAction -Execute $node -Argument '--env-file-if-exists=.env scripts/backup.mjs' -WorkingDirectory $root) | Out-Null

Stop-ScheduledTask -TaskName 'Kilimanjaro Hotels server' -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName 'Kilimanjaro Hotels server'
Start-Sleep -Seconds 3
try {
  Invoke-WebRequest -UseBasicParsing http://localhost:3001/api/site | Out-Null
  Write-Host 'Server running: http://localhost:3001  (admin: http://localhost:3001/admin/)'
} catch {
  Write-Warning 'Server did not answer yet. Check Task Scheduler > "Kilimanjaro Hotels server".'
}

# 6. Cloudflare Tunnel, installed as a Windows service that starts at boot
if ($TunnelToken) {
  if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  }
  cloudflared service uninstall 2>$null
  cloudflared service install $TunnelToken
  Write-Host 'Cloudflare Tunnel installed. The site is now reachable at the hostname you set in Cloudflare.'
}

Write-Host 'Done. Also set Windows so this PC never sleeps: Settings > System > Power > Sleep: Never.'
