#!/bin/bash

cd "$(dirname "$0")"
LOG_DIR="$(pwd)/logs"

echo "🛑 ReLINK サーバーを停止します..."

for NAME in api ai front; do
  PID_FILE="$LOG_DIR/$NAME.pid"
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      kill "$PID" && echo "  ✅ $NAME (PID $PID) を停止しました"
    else
      echo "  ⚠️  $NAME はすでに停止しています"
    fi
    rm -f "$PID_FILE"
  fi
done

# 念のため名前でも止める
pkill -f "gradlew run"      2>/dev/null
pkill -f "match_api:app"    2>/dev/null
pkill -f "http.server 5500" 2>/dev/null

echo "✅ 停止完了"
