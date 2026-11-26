@echo off
rem Inicia o servidor de desenvolvimento do Canon Codex e abre o navegador.
rem Fechar esta janela encerra o servidor.
setlocal
cd /d "%~dp0"
title Canon Codex
set "URL=http://localhost:3000"

rem Servidor ja rodando? So abre o navegador.
powershell -NoProfile -Command "$c = New-Object Net.Sockets.TcpClient; try { if ($c.ConnectAsync('localhost', 3000).Wait(500)) { exit 0 } else { exit 1 } } catch { exit 1 } finally { $c.Close() }"
if %errorlevel%==0 (
  echo O servidor ja esta rodando. Abrindo %URL% ...
  start "" "%URL%"
  exit /b 0
)

rem Garante Node e pnpm (Corepack em %APPDATA%\npm) no PATH mesmo se a janela herdou um PATH antigo.
set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%PATH%"
set "COREPACK_ENABLE_DOWNLOAD_PROMPT=0"
set "PNPM=pnpm"
where pnpm >nul 2>nul || (
  echo pnpm nao encontrado. Instale o Node.js e o pnpm conforme o README.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias...
  call "%PNPM%" install --frozen-lockfile || (pause & exit /b 1)
)

rem Em segundo plano: espera a porta 3000 responder e abre o navegador.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for ($i = 0; $i -lt 120; $i++) { $c = New-Object Net.Sockets.TcpClient; try { if ($c.ConnectAsync('localhost', 3000).Wait(500)) { Start-Process '%URL%'; break } } catch {} finally { $c.Close() }; Start-Sleep -Milliseconds 500 }"

echo Iniciando o servidor em %URL% (feche esta janela para encerrar)...
call "%PNPM%" dev --port 3000
pause
