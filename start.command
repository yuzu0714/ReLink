#!/bin/bash

# このスクリプトが置かれているディレクトリをリポジトリルートとして使う
cd "$(dirname "$0")"

echo "🚀 ReLINK を起動します..."

# ① バックエンドAPI（Kotlin）をバックグラウンドで起動
echo "📦 バックエンドAPI（Kotlin）を起動中..."
osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"'/relink-api && ./gradlew run"'

# ② AI判定サーバー（Python）をバックグラウンドで起動
echo "🤖 AI判定サーバー（Python）を起動中..."
osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"' && uvicorn match_api:app --host 0.0.0.0 --port 8000"'

# ③ フロントエンド用HTTPサーバーをバックグラウンドで起動
echo "🌐 フロントエンドサーバーを起動中..."
osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"'/frontend && python3 -m http.server 5500"'

# サーバーが起動するまで少し待つ
echo "⏳ サーバー起動待ち（10秒）..."
sleep 10

# ブラウザで開く
echo "🌍 ブラウザを開きます..."
open http://localhost:5500/login.html

echo "✅ 完了！ターミナルウィンドウが3つ開いて、ブラウザが起動します。"
echo "   止めるときは各ターミナルで Ctrl+C を押してください。"