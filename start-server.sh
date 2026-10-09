#!/bin/bash

# このスクリプトが置かれているディレクトリをリポジトリルートとして使う
cd "$(dirname "$0")"
REPO_ROOT="$(pwd)"

echo "🚀 ReLINK サーバーを起動します..."

# ── ログファイルの場所 ──────────────────────────────
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

# ── 既存プロセスの停止（再起動時用）──────────────────
echo "🛑 既存プロセスを確認・停止中..."
pkill -f "gradlew run"       2>/dev/null
pkill -f "match_api:app"     2>/dev/null
pkill -f "http.server 5500"  2>/dev/null
sleep 2

# ── ① バックエンドAPI（Kotlin / Ktor） ── ポート8080 ──
echo "📦 バックエンドAPI（Kotlin）を起動中... → ログ: logs/api.log"
nohup bash -c "cd '$REPO_ROOT/relink-api' && ./gradlew run" \
  > "$LOG_DIR/api.log" 2>&1 &
API_PID=$!

# ── ② AI判定サーバー（Python / uvicorn） ── ポート8001 ──
echo "🤖 AI判定サーバー（Python）を起動中... → ログ: logs/ai.log"
nohup bash -c "cd '$REPO_ROOT/ai' && uvicorn match_api:app --host 0.0.0.0 --port 8001" \
  > "$LOG_DIR/ai.log" 2>&1 &
AI_PID=$!

# ── ③ フロントエンド用HTTPサーバー ── ポート5500 ──
echo "🌐 フロントエンドサーバーを起動中... → ログ: logs/front.log"
nohup python3 -m http.server 5500 --directory "$REPO_ROOT/frontend" \
  > "$LOG_DIR/front.log" 2>&1 &
FRONT_PID=$!

# PIDを保存（stop-server.sh で使う）
echo "$API_PID"   > "$LOG_DIR/api.pid"
echo "$AI_PID"    > "$LOG_DIR/ai.pid"
echo "$FRONT_PID" > "$LOG_DIR/front.pid"

echo ""
echo "⏳ 起動待ち（15秒）..."
sleep 15

# ── 起動確認 ─────────────────────────────────────────
echo ""
echo "============================================"
echo "  起動状態の確認"
echo "============================================"
ss -tlnp | grep -E '8080|8001|5500' || netstat -tlnp 2>/dev/null | grep -E '8080|8001|5500'

echo ""
echo "============================================"
echo "  📡 アクセスURL"
echo "  フロントエンド : http://$(hostname -I | awk '{print $1}'):5500/login.html"
echo "  バックエンドAPI: http://$(hostname -I | awk '{print $1}'):8080"
echo "  AI サーバー   : http://$(hostname -I | awk '{print $1}'):8001"
echo "============================================"
echo ""
echo "✅ 起動完了！ ログは logs/ フォルダで確認できます。"
echo "   止めるときは ./stop-server.sh を実行してください。"
