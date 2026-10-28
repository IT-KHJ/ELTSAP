@echo off
rem SAP mirror sync runner for Windows Task Scheduler (independent of the existing sync tasks)
rem Usage: run-scheduled.cmd <hourly|daily|weekly|recon>
rem Logs: %LOCALAPPDATA%\eltsap-sap-mirror\<mode>.log  (run history is also stored in Supabase sap_mirror_runs)
rem Exit codes: 0 ok, 1 failed, 2 SAP unavailable (DBSafer session expired etc. - next run catches up), 3 another run in progress, 4 stopped on SAP load (query >30s / no response)
setlocal
if "%~1"=="" (
  echo Usage: run-scheduled.cmd ^<hourly^|daily^|weekly^|recon^>
  exit /b 1
)
cd /d "%~dp0..\.."
set "LOGDIR=%LOCALAPPDATA%\eltsap-sap-mirror"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
echo ===== %DATE% %TIME% %~1 >> "%LOGDIR%\%~1.log"
call npx --yes tsx scripts/sap-mirror/sync.ts %~1 >> "%LOGDIR%\%~1.log" 2>&1
exit /b %ERRORLEVEL%
