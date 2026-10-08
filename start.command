#!/bin/bash

# このスクリプトが置かれているディレクトリをリポジトリルートとして使う
cd "$(dirname "$0")"

echo "🚀 ReLINK を起動します..."

# ★追加：今つながっているネットワークのIPv4アドレスを自動で調べる
# 1. route -n get default で「インターネットにつながっているインターフェース名」を取る
#    (Wi-Fiなら en0、テザリングやUSB接続なら別の名前になる。決め打ちしないのがポイント)
# 2. ipconfig getifaddr でそのインターフェースのIPアドレスを取る
# ネットワークにつながっていない時は、どちらも空文字になる(エラーは捨てる)
DEFAULT_IF=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')
LAN_IP=""
if [ -n "$DEFAULT_IF" ]; then
  LAN_IP=$(ipconfig getifaddr "$DEFAULT_IF" 2>/dev/null)
fi

# ① バックエンドAPI（Kotlin）をバックグラウンドで起動
echo "📦 バックエンドAPI（Kotlin）を起動中..."
osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"'/relink-api && ./gradlew run"'

# ② AI判定サーバー（Python）をバックグラウンドで起動
# ※ポートは start.bat と同じ番号に揃えること(.env の AI_API_BASE とも一致させる)
echo "🤖 AI判定サーバー（Python）を起動中..."
osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"'/ai && uvicorn match_api:app --host 0.0.0.0 --port 8001"'

# ③ フロントエンド用HTTPサーバーをバックグラウンドで起動
# (python3 -m http.server は標準で全てのネットワークから受け付けるので、スマホからも届く)
echo "🌐 フロントエンドサーバーを起動中..."
osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"'/frontend && python3 -m http.server 5500"'

# サーバーが起動するまで少し待つ
echo "⏳ サーバー起動待ち（10秒）..."
sleep 10

# ★追加：スマホで開くURLを画面に表示する(IPが取れなかった時は案内だけ出す)
echo ""
if [ -n "$LAN_IP" ]; then
  echo "============================================"
  echo "  📱 スマホで開くURL（同じWi-Fi／テザリングに接続してね）"
  echo "  http://$LAN_IP:5500/login.html"
  echo "============================================"
else
  echo "⚠️ ネットワークに接続されていないため、IPアドレスを取得できませんでした。"
fi
echo ""

# ブラウザで開く
echo "🌍 ブラウザを開きます..."
open http://localhost:5500/login.html

echo "✅ 完了！ターミナルウィンドウが3つ開いて、ブラウザが起動します。"
echo "   止めるときは各ターミナルで Ctrl+C を押してください。"