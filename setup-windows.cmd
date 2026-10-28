@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-windows.ps1" %*
set "setup_result=%errorlevel%"
echo.
pause
exit /b %setup_result%
