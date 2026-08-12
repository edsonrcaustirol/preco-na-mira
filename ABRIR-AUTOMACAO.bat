@echo off
setlocal
cd /d "%~dp0"
title Preco na Mira - Automacao de Catalogo

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

echo Abrindo o Modo Automatico do Preco na Mira...
echo Cole os links de afiliado e use IMPORTAR + PUBLICAR AUTOMATICAMENTE.
echo Mantenha esta janela aberta durante o uso.
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul & start "" "http://127.0.0.1:4314/automacao.html""
node tools\catalog-server.mjs

if errorlevel 1 (
  echo.
  echo A automacao foi encerrada com um erro. Confira a mensagem acima.
  pause
)
