@echo off
cd /d "%~dp0"
echo Instalando os pacotes do GymBro (pode levar alguns minutos)...
where node >nul 2>nul || (echo Node.js nao encontrado. Instale em https://nodejs.org e rode de novo. & pause & exit /b 1)
node -v
call npm install --no-audit --no-fund
echo.
echo Pronto! Para abrir no celular: npx expo start
pause
