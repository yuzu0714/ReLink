#!/bin/bash

SESSION="relink"

# 既存セッションがあれば削除
tmux kill-session -t $SESSION 2>/dev/null

# tmuxセッション作成
tmux new-session -d -s $SESSION -n "backend"

# ① バックエンドAPI
tmux send-keys -t $SESSION:0 "cd $(pwd)/relink-api && ./gradlew run" Enter

# ② AI判定サーバー
tmux new-window -t $SESSION -n "ai"
tmux send-keys -t $SESSION:1 "cd $(pwd) && uvicorn match_api:app --host 0.0.0.0 --port 8000" Enter

# ③ フロントエンド
tmux new-window -t $SESSION -n "frontend"
tmux send-keys -t $SESSION:2 "cd $(pwd)/frontend && python3 -m http.server 5500" Enter

echo "✅ 全サーバーを起動しました！"
echo ""
echo "ログを見るには: tmux attach -t relink"
echo "  ウィンドウ切り替え: Ctrl+b → 0(backend) / 1(ai) / 2(frontend)"
echo "  デタッチ(抜ける): Ctrl+b → d"
echo "停止するには: tmux kill-session -t relink"
