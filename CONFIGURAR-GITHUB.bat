@echo off
setlocal
cd /d "%~dp0"
title Preco na Mira - Configurar GitHub

echo PRECO NA MIRA V13.6 - CONFIGURACAO DO GITHUB
echo Repositorio: https://github.com/edsonrcaustirol/preco-na-mira
echo.

where winget >nul 2>nul
if errorlevel 1 (
  echo O instalador winget nao foi encontrado.
  echo Instale Git e GitHub CLI manualmente e execute este arquivo novamente:
  echo https://git-scm.com/download/win
  echo https://cli.github.com/
  pause
  exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
  echo Instalando Git...
  winget install --id Git.Git -e --source winget
  echo Feche esta janela e execute CONFIGURAR-GITHUB.bat novamente.
  pause
  exit /b 0
)

where gh >nul 2>nul
if errorlevel 1 (
  echo Instalando GitHub CLI...
  winget install --id GitHub.cli -e --source winget
  echo Feche esta janela e execute CONFIGURAR-GITHUB.bat novamente.
  pause
  exit /b 0
)

gh auth status >nul 2>nul
if errorlevel 1 (
  echo O navegador sera aberto para autorizar sua conta GitHub.
  gh auth login --web --git-protocol https
  if errorlevel 1 goto :erro
)

gh auth setup-git
if errorlevel 1 goto :erro

if not exist ".git" (
  git init -b main
  git remote add origin https://github.com/edsonrcaustirol/preco-na-mira.git
  git fetch origin main
  git reset --mixed origin/main
) else (
  git remote get-url origin >nul 2>nul
  if errorlevel 1 git remote add origin https://github.com/edsonrcaustirol/preco-na-mira.git
  git remote set-url origin https://github.com/edsonrcaustirol/preco-na-mira.git
)

git config user.name "Edson Reiter Concatto"
git config user.email "315643281+edsonrcaustirol@users.noreply.github.com"
git branch --set-upstream-to=origin/main main >nul 2>nul

echo.
echo GITHUB CONFIGURADO COM SUCESSO.
echo Agora abra ABRIR-CENTRAL.bat. Ao publicar produtos, a Central tambem
echo enviara as alteracoes para o site online.
echo.
git status --short
pause
exit /b 0

:erro
echo.
echo Nao foi possivel concluir a configuracao. Confira a mensagem acima.
pause
exit /b 1
