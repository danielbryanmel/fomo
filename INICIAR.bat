@echo off
chcp 65001 >nul
title FOMO - servidor de desenvolvimento
cd /d "%~dp0"

echo.
echo  ===== FOMO =====
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instalando Node.js LTS pelo winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  set "PATH=%PATH%;%ProgramFiles%\nodejs"
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Nao foi possivel instalar o Node.js automaticamente.
  echo Instale a versao LTS em https://nodejs.org e rode este arquivo de novo.
  pause
  exit /b 1
)

set FIRST_RUN=0
if not exist node_modules set FIRST_RUN=1

echo Instalando/atualizando dependencias - na primeira vez leva alguns minutos...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo Falha no npm install. Veja a mensagem acima.
  pause
  exit /b 1
)

if "%FIRST_RUN%"=="1" (
  echo Conferindo versoes compativeis com o SDK do Expo...
  call npx expo install --fix
)

echo.
echo Abrindo o FOMO no navegador. Para ver no celular: instale o app Expo Go
echo e escaneie o QR code abaixo - celular e PC na mesma rede Wi-Fi.
echo Para encerrar: Ctrl+C
echo.
call npx expo start --web
pause
