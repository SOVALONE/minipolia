@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Мініполія: http://localhost:8080  (Ctrl+C — зупинити)
start "" http://localhost:8080
python -m http.server 8080
