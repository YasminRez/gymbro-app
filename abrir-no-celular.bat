@echo off
cd /d "%~dp0"
title GymBro - Expo
where node >nul 2>nul || (echo Node.js nao encontrado. Instale em https://nodejs.org e rode de novo. & pause & exit /b 1)
if not exist node_modules (
  echo Instalando os pacotes pela primeira vez, aguarde...
  call npm install --no-audit --no-fund
)
echo Iniciando o Expo. Leia o QR code com o app Expo Go.
call npx expo start
pause
