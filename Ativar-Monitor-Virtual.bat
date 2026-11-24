@echo off
title DekView - Ativar Monitor Virtual (Segunda Tela)
cd /d "%~dp0"

echo ========================================================
echo        DekView - Instalador do Monitor Virtual
echo ========================================================
echo.

:: Verifica privilégios de administrador
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [AVISO] Solicitando permissoes de Administrador para instalar o driver...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

set "VDD_DIR=%LOCALAPPDATA%\Microsoft\WinGet\Packages\VirtualDrivers.Virtual-Display-Driver_Microsoft.Winget.Source_8wekyb3d8bbwe"
set "DEVCON=%VDD_DIR%\Dependencies\devcon.exe"
set "INF=%VDD_DIR%\SignedDrivers\x86\VDD\MttVDD.inf"

if not exist "%DEVCON%" (
    echo [ERRO] Arquivos do driver nao localizados.
    pause
    exit /b
)

echo [1/2] Registrando o driver de monitor virtual no Windows...
"%DEVCON%" install "%INF%" "Root\MttVDD"

echo.
echo [2/2] Verificando monitores...
timeout /t 3 >nul

echo.
echo ========================================================
echo   Sucesso! O Monitor Virtual foi adicionado ao Windows.
echo   Agora pressione WINDOWS + P e selecione "Estender".
echo ========================================================
echo.
pause
