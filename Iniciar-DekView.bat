@echo off
title DekView Host Server
cd /d "%~dp0"

echo =======================================================
echo          Iniciando DekView Host Server
echo =======================================================
echo.

node server.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Nao foi possivel iniciar o servidor. Verifique se o Node.js esta instalado.
    pause
)
