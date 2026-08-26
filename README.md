# ReLINK 開発環境セットアップ＆操作ガイド

## 1. 事前準備

- JDK（`./gradlew run` が動く環境）
- Python 3（`pip install fastapi uvicorn python-multipart openai python-dotenv requests`）
- Supabaseプロジェクトの情報（URL・service role key・DB接続情報）
- Sakura AIのAPIトークン（`SAKURA_AI_TOKEN`）

## 2. 環境変数（.env）の設定

### `relink-api/.env`（バックエンドAPI用）
relink-api直下に.envファイルを作りましょう。中身は以下を設定してください。xxxのところは各自で調べて、わからないときは原田に聞いてください。

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxx
JWT_SECRET=
DATABASE_URL=jdbc:postgresql://aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
DATABASE_USER=postgres.xxxxx
DATABASE_PASSWORD=xxxxxxxxxx
AI_API_BASE=http://localhost:8000
```

### リポジトリ直下の `.env`（AI判定サーバー用）
リポジトリ直下に.envファイルを作って、中身は以下を設定してください。

```
SAKURA_AI_TOKEN=xxxxxxxxxx
```

## 3. サーバーの起動方法

### ① バックエンドAPI（Kotlin）
ターミナルを開いて、以下を実行してください。

```
cd relink-api
./gradlew run
```

### ② AI判定サーバー（Python）
①とは別のターミナルを起動して、以下を実行してください。

```
uvicorn match_api:app --host 0.0.0.0 --port 8000
```

### ③ フロントエンド
vscodeの拡張機能Live Server(Five Server)を入れて、
login.htmlを右クリック。
「Open with Five Server」をクリックするとブラウザで開くことができます。

（ターミナルで開く場合は以下を実行してください。
```
cd frontend
python3 -m http.server 5500
```
その後、ブラウザで `http://localhost:5500/login.html` を開いてください。）

## 4. 基本操作

### ログイン

ログイン画面：今は動作確認用のログインで、メールアドレス・パスワードのチェックはしていません。

### 飼い主として使う（迷子ペットを登録する）

1. 写真を1枚以上追加（複数枚OK、最大10枚）
2. 連絡先電話番号・紛失場所・種類/犬種・毛色を入力
   - 「🤖 写真からAIで自動入力」ボタンで、未入力の項目をAIに推定させることもできる
3. 「登録情報を登録してAIマッチングを開始」を押すと、実際にバックエンドへ登録され、そのままAIマッチング（`/matching/run`）が実行される
4. マッチング結果が一覧表示される（候補がいない場合は「候補が見つかりませんでした」と表示される。これは異常ではなく正しい動作）
5. 候補をタップすると詳細（AIのスコア・判定理由）が見られ、電話番号・メモを入力して「この子について連絡する」を押すと保護元に連絡（`/contacts`）でき、受付番号が発行される

### 発見者として使う（保護したペットを登録する）

- STEP1：写真・発見場所・発見日時・種類/犬種・毛色を入力して「登録」
  - 発見場所などが未入力だとここで止められる（STEP2に進んでから気づく、ということはない）
- STEP2：保護方法（自宅保護／保護団体・シェルターへ連絡／保健所へ引き渡す）を選んで「登録して完了」

### 保護団体として使う

「保護ペット一覧」から、現在登録されている保護ペットの一覧を確認できます。

## 5. 写真の中身を直接確認したいとき

Supabaseのダッシュボードから確認できます。

- **Storage** → `pet-photos` バケット：アップロードされた画像を一覧・プレビューできる
- **Table Editor** → `pet_photos` テーブル：`photo_url` 列のURLをコピーしてブラウザで開くと画像が表示される（バケットがPublic設定になっている前提）
