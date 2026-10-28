@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0SYNC_CODE_TO_GITHUB.ps1"
if errorlevel 1 (echo. & echo Sync failed. See error above.)
pause
