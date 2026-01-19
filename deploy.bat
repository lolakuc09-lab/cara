@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

for /f "delims=" %%A in ('git status --porcelain') do set CHANGES=1

if not defined CHANGES (
  echo No hay cambios para subir.
  pause
  exit /b 0
)

set MSG=%*
if "%MSG%"=="" (
  set /p MSG=Mensaje de commit: 
)
if "%MSG%"=="" set MSG=update

git add -A
git commit -m "%MSG%"
git push

echo OK: cambios subidos y Cloudflare Pages va a desplegar.
pause
