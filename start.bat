@echo off
chcp 65001 > nul
echo ReLINK を起動します...

REM ★追加：今つながっているネットワークのIPv4アドレスを自動で調べる
REM 「デフォルトゲートウェイがあるアダプター」＝実際にネットにつながっているWi-Fi/テザリング、
REM だけを対象にしているので、WSLやVirtualBoxなどの仮想アダプターは除外される。
set LAN_IP=
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null } | Select-Object -First 1).IPv4Address.IPAddress"`) do set LAN_IP=%%i

echo バックエンドAPI（Kotlin）を起動中...
start "Kotlin Backend" cmd /k "cd /d %~dp0relink-api && gradlew.bat run"

echo AI判定サーバー（Python）を起動中...
start "Python AI Server" cmd /k "cd /d %~dp0ai && uvicorn match_api:app --host 0.0.0.0 --port 8001"

echo フロントエンドサーバーを起動中...
start "Frontend" cmd /k "cd /d %~dp0ai && python serve_frontend.py"

echo サーバー起動待ち（15秒）...
timeout /t 15 /nobreak > nul

echo ブラウザを開きます...
start "" "http://127.0.0.1:5500/login.html?startup=%RANDOM%"

echo.
echo 完了！ウィンドウが3つ開きます。止めるときは各ウィンドウを閉じてください。
echo このウィンドウは、上のURLを確認したら閉じてOKです。

REM ★追加：pause で、キーを押すまでこの窓を閉じないようにした（URLを見落とさないため）
pause