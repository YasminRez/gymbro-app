@echo off
cd /d "%~dp0"
title GymBro - Expo (tunel)
where node >nul 2>nul || (echo Node.js nao encontrado. Instale em https://nodejs.org e rode de novo. & pause & exit /b 1)
if not exist node_modules\@expo\ngrok (
  echo Instalando os pacotes, aguarde...
  call npm install --no-audit --no-fund
)
echo Iniciando o Expo em modo tunel: funciona mesmo com o celular em outra rede.
echo Leia o QR code com o app Expo Go.
call npx expo start --tunnel
pause
