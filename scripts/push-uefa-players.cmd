@echo off
REM Wrapper for the Windows scheduled task that refreshes the Champions League
REM player pool. See scripts/push-uefa-players.mjs for why this cannot run in
REM the Supabase cron or on a GitHub-hosted runner: UEFA drops requests from
REM data centres and answers ordinary connections.
REM
REM Register or re-register it with scripts/install-uefa-task.ps1.

cd /d "%~dp0.."
node scripts\push-uefa-players.mjs >> "%~dp0..\uefa-sync.log" 2>&1
echo [%date% %time%] exit=%errorlevel% >> "%~dp0..\uefa-sync.log"
exit /b %errorlevel%
