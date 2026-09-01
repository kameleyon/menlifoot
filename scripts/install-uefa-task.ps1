# Register the daily Champions League player sync as a Windows scheduled task.
#
# The Supabase cron cannot do this and neither can GitHub Actions: UEFA answers
# a browser and an ordinary connection, and drops requests from data centres.
# Both were tried - the edge function fails at the connection layer for every
# season id, and a GitHub-hosted runner hung for 81 seconds and was killed. So
# the request runs from a machine UEFA will talk to, and the edge function
# still does all the mapping and merging.
#
# Run once, from an elevated PowerShell:
#     powershell -ExecutionPolicy Bypass -File scripts\install-uefa-task.ps1
#
# Re-running it replaces the existing task rather than adding a second one.

$ErrorActionPreference = 'Stop'

$taskName = 'MenlifootUefaFantasySync'
$repoRoot = Split-Path -Parent $PSScriptRoot
$wrapper  = Join-Path $repoRoot 'scripts\push-uefa-players.cmd'

if (-not (Test-Path $wrapper)) {
  throw "Wrapper not found at $wrapper"
}

# 06:05 local. UEFA settles points and reprices after the evening's matchday,
# so this lands well after the last whistle and before anyone picks a team.
$trigger = New-ScheduledTaskTrigger -Daily -At 6:05am

$action = New-ScheduledTaskAction -Execute $wrapper

# Runs whether or not anyone is logged in, and does not need mains power - this
# is a server, and a sync that waits for a desktop session never happens.
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

Register-ScheduledTask `
  -TaskName $taskName `
  -Trigger $trigger `
  -Action $action `
  -Settings $settings `
  -Description 'Pulls the UEFA Fantasy player feed and pushes it to ucl-sync-players.' `
  -RunLevel Highest `
  -Force | Out-Null

Write-Host "Registered '$taskName' for 06:05 daily."
Write-Host "Run it now with:  Start-ScheduledTask -TaskName $taskName"
Write-Host "Check the log at: $(Join-Path $repoRoot 'uefa-sync.log')"
