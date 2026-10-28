@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0DEPLOY_REACT_PRODUCTION.ps1"
echo.
echo Check deployment messages above and verify API health.
pause
