@echo off
chcp 65001 > nul
echo ReLINK を起動します...

echo バックエンドAPI（Kotlin）を起動中...
start "Kotlin Backend" cmd /k "cd /d %~dp0relink-api && gradlew.bat run"

echo AI判定サーバー（Python）を起動中...
start "Python AI Server" cmd /k "cd /d %~dp0 && uvicorn match_api:app --host 0.0.0.0 --port 8000"

echo フロントエンドサーバーを起動中...
start "Frontend" cmd /k "cd /d %~dp0 && python serve_frontend.py"

echo サーバー起動待ち（15秒）...
timeout /t 15 /nobreak > nul

echo ブラウザを開きます...
start "" "http://127.0.0.1:5500/login.html?startup=%RANDOM%"

echo 完了！ウィンドウが3つ開きます。止めるときは各ウィンドウを閉じてください。