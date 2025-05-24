@echo off
cd /d "%~dp0"
start cmd /k "npm run dev-all"
timeout /t 5 >nul
start http://localhost:8080/
