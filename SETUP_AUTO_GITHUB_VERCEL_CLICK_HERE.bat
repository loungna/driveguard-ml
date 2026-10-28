@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0SETUP_AUTO_GITHUB_VERCEL.ps1"
if errorlevel 1 (echo. & echo Setup failed. See error above.)
pause
