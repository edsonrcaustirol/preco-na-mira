@echo off
setlocal
cd /d "%~dp0"
title Preco na Mira - Central de Catalogo V13.6

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo O Node.js nao foi encontrado neste computador.
  echo Abra o arquivo INSTRUCOES-CENTRAL.txt para instalar uma vez.
  echo.
  start "" "INSTRUCOES-CENTRAL.txt"
  pause
  exit /b 1
)

echo Abrindo a Central de Catalogo...
echo Mantenha esta janela aberta enquanto estiver alimentando o site.
echo.
node tools\catalog-server.mjs --open

if errorlevel 1 (
  echo.
  echo A central foi encerrada com um erro. Confira a mensagem acima.
  pause
)
