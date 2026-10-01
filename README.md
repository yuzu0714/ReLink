# 第 37 回全国高専プログラミングコンテスト プログラムソースリスト

課題部門：発表順番号（登録番号）　 02（10018）

タイトル：ReLINK －　　－

学生氏名：岩見　竜之介

     廣瀬　七海

     原田　柚月

     松田　侑季奈

     天野　遼

指導教員：太田　健吾

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
cd ai
uvicorn match_api:app --host 0.0.0.0 --port 8000
```

### ③ フロントエンド
vscodeの拡張機能Live Server(Five Server)を入れて、
login.htmlを右クリック。
「Open with Five Server」をクリックするとブラウザで開くことができます。

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

# ディレクトリ構成
 - frontend
    - styles
      - base.css (全ページ共通のリセット・基本スタイル)
      - components.css (ボタン・カードなど共通UIパーツのスタイル)
      - pages.css (各ページ固有のスタイル)
      - pc.css (PC表示用レスポンシブスタイル)
    - scripts
      - config.js (APIのベースURL設定)
      - auth.js (ログイン・認証処理)
      - common.js (全ページ共通の処理)
      - owner.js (飼い主画面の動作)
      - finder.js (発見者画面の動作)
      - shelter.js (保護団体画面の動作)
      - chat.js (チャット画面の動作)
      - handover.js (受け渡し画面の動作)
      - notification.js (お知らせ画面の動作)
      - notif-chat.js (通知・チャット連携の処理)
      - location-autocomplete.js (都道府県・市区町村入力補完)
      - rescue-register.js (保護登録の動作)
    - login.html (ログイン画面)
    - signup.html (新規登録画面)
    - owner.html (飼い主向けトップ画面)
    - finder.html (発見者向けトップ画面)
    - shelter.html (保護団体向けトップ画面)
    - shelter-login.html (保護団体ログイン画面)
    - shelter-list.html (保護団体一覧画面)
    - chat.html (チャット画面)
    - handover.html (受け渡し画面)
    - notify.html (お知らせ画面)
    - owner-pet.html (飼い主ペット詳細画面)
    - pet_detail.html (ペット詳細画面)
    - register.html (ペット登録画面)
  - relink-api
    - build.gradle.kts (プロジェクトのビルド設定や依存関係を定義)
    - src/main/kotlin
      - main.kt (アプリケーションのエントリーポイント)
      - Http.kt (HTTPサーバーとCORSの設定)
      - Routing.kt (APIエンドポイントのルーティング定義)
      - Database.kt (データベース接続の設定)
      - Security.kt (認証・セキュリティの設定)
      - Serialization.kt (JSONシリアライズの設定)
      - Monitoring.kt (ヘルスチェックの設定)
      - StatusPages.kt (エラーレスポンスの設定)
    - src/main/kotlin/db
      - UserTable.kt (ユーザーテーブルの定義)
      - LostPetTable.kt (迷子ペットテーブルの定義)
      - FoundPetTable.kt (発見ペットテーブルの定義)
      - RescuedPetTable.kt (保護ペットテーブルの定義)
      - MatchesTable.kt (マッチングテーブルの定義)
      - HandoverTable.kt (受け渡しテーブルの定義)
      - ChatMessageTable.kt (チャットメッセージテーブルの定義)
      - NotificationTable.kt (通知テーブルの定義)
      - PetPhotoTable.kt (ペット写真テーブルの定義)
      - ContactTable.kt (連絡先テーブルの定義)
    - src/main/kotlin/models
      - AuthModels.kt (認証関連のデータ型定義)
      - LostPetModels.kt (迷子ペット関連のデータ型定義)
      - FoundPetModels.kt (発見ペット関連のデータ型定義)
      - RescuedPetModels.kt (保護ペット関連のデータ型定義)
      - HandoverModels.kt (受け渡し関連のデータ型定義)
      - ChatModels.kt (チャット関連のデータ型定義)
      - MatchingResultModels.kt (マッチング結果のデータ型定義)
      - AiFeatureModels.kt (AI特徴抽出のデータ型定義)
      - AiSimilarityModels.kt (AI類似度判定のデータ型定義)
    - src/main/kotlin/repositories
      - UserRepository.kt (ユーザー情報のデータベース操作)
      - LostPetRepository.kt (迷子ペット情報のデータベース操作)
      - FoundPetRepository.kt (発見ペット情報のデータベース操作)
      - RescuedPetRepository.kt (保護ペット情報のデータベース操作)
      - MatchingRepository.kt (AIマッチング候補の絞り込み)
      - MatchDetailRepository.kt (マッチング詳細のデータベース操作)
      - HandoverRepository.kt (受け渡し情報のデータベース操作)
      - ChatRepository.kt (チャットメッセージのデータベース操作)
      - NotificationRepository.kt (通知情報のデータベース操作)
      - PetPhotoRepository.kt (ペット写真のデータベース操作)
    - src/main/kotlin/services
      - AiExtractionService.kt (写真からペット特徴をAI抽出)
      - AiSimilarityService.kt (AI画像類似度の判定)
      - MatchingService.kt (マッチング処理)
      - EmailService.kt (メール送信)
      - StorageService.kt (写真ストレージ管理)
      - GeocodingService.kt (位置情報処理)
  - ai
    - match_api.py (写真からペット特徴を抽出するAI判定APIサーバー)
    - common.py (AI処理の共通モジュール)
    - tag_pet.py (ペットへのタグ付け処理)
    - list_pets.py (ペット一覧取得)
    - tokushima_register.py (徳島県データの登録)
    - serve_frontend.py (開発用フロントエンドHTTPサーバー)
  - start.command (Mac用一括起動スクリプト)
  - start.bat (Windows用一括起動スクリプト)
  - README.md
