# 第 37 回全国高専プログラミングコンテスト プログラムソースリスト

課題部門：発表順番号（登録番号）　 02（10018）

タイトル：ReLINK －災害時ペット保護・マッチングシステム－

学生氏名：岩見　竜之介

     廣瀬　七海

     原田　柚月

     松田　侑季奈

     天野　遼

指導教員：太田　健吾

# ディレクトリ構成
ReLink/
├── README.md
├── start.command （Mac用一括起動スクリプト）
├── start.bat （Windows用一括起動スクリプト）
│
├── frontend/
│   ├── assets/
│   │   ├── Icon.png
│   │   ├── finder.png
│   │   ├── owner.png
│   │   └── register.png
│   ├── logo.png
│   ├── styles/
│   │   ├── base.css （全ページ共通のリセット・基本スタイル）
│   │   ├── components.css （ボタン・カードなど共通UIパーツのスタイル）
│   │   ├── pages.css （各ページ固有のスタイル）
│   │   └── pc.css （PC表示用レスポンシブスタイル）
│   ├── scripts/
│   │   ├── config.js （APIのベースURL設定）
│   │   ├── auth.js （ログイン・認証処理）
│   │   ├── common.js （全ページ共通の処理）
│   │   ├── owner.js （飼い主画面の動作）
│   │   ├── finder.js （発見者画面の動作）
│   │   ├── shelter.js （保護団体画面の動作）
│   │   ├── chat.js （チャット画面の動作）
│   │   ├── chat-monitor.js （チャット監視画面の動作）
│   │   ├── handover.js （受け渡し画面の動作）
│   │   ├── notification.js （お知らせ画面の動作）
│   │   ├── notif-chat.js （通知・チャット連携の処理）
│   │   ├── location-autocomplete.js （都道府県・市区町村入力補完）
│   │   └── rescue-register.js （保護登録の動作）
│   ├── login.html （ログイン画面）
│   ├── signup.html （新規登録画面）
│   ├── owner.html （飼い主向けトップ画面）
│   ├── owner-pet.html （飼い主ペット詳細画面）
│   ├── owner-register.html （飼い主登録画面）
│   ├── finder.html （発見者向けトップ画面）
│   ├── shelter.html （保護団体向けトップ画面）
│   ├── shelter-login.html （保護団体ログイン画面）
│   ├── shelter-list.html （保護団体一覧画面）
│   ├── shelter-lost-list.html （保護団体・迷子ペット一覧画面）
│   ├── shelter-lost-detail.html （保護団体・迷子ペット詳細画面）
│   ├── chat.html （チャット画面）
│   ├── chat-monitor.html （チャット監視画面）
│   ├── handover.html （受け渡し画面）
│   ├── notify.html （お知らせ画面）
│   ├── pet_detail.html （ペット詳細画面）
│   └── register.html （ペット登録画面）
│
├── relink-api/
│   ├── build.gradle.kts （プロジェクトのビルド設定や依存関係を定義）
│   └── src/main/
│       ├── kotlin/
│       │   ├── main.kt （アプリケーションのエントリーポイント）
│       │   ├── Http.kt （HTTPサーバーとCORSの設定）
│       │   ├── Routing.kt （APIエンドポイントのルーティング定義）
│       │   ├── Database.kt （データベース接続の設定）
│       │   ├── Security.kt （認証・セキュリティの設定）
│       │   ├── Serialization.kt （JSONシリアライズの設定）
│       │   ├── Monitoring.kt （ヘルスチェックの設定）
│       │   ├── StatusPages.kt （エラーレスポンスの設定）
│       │   ├── db/
│       │   │   ├── UserTable.kt （ユーザーテーブルの定義）
│       │   │   ├── LostPetTable.kt （迷子ペットテーブルの定義）
│       │   │   ├── FoundPetTable.kt （発見ペットテーブルの定義）
│       │   │   ├── RescuedPetTable.kt （保護ペットテーブルの定義）
│       │   │   ├── MatchesTable.kt （マッチングテーブルの定義）
│       │   │   ├── HandoverTable.kt （受け渡しテーブルの定義）
│       │   │   ├── ChatMessageTable.kt （チャットメッセージテーブルの定義）
│       │   │   ├── NotificationTable.kt （通知テーブルの定義）
│       │   │   ├── PetPhotoTable.kt （ペット写真テーブルの定義）
│       │   │   └── ContactTable.kt （連絡先テーブルの定義）
│       │   ├── models/
│       │   │   ├── AuthModels.kt （認証関連のデータ型定義）
│       │   │   ├── LostPetModels.kt （迷子ペット関連のデータ型定義）
│       │   │   ├── LostPetMatchModels.kt （迷子ペットマッチ関連のデータ型定義）
│       │   │   ├── FoundPetModels.kt （発見ペット関連のデータ型定義）
│       │   │   ├── RescuedPetModels.kt （保護ペット関連のデータ型定義）
│       │   │   ├── HandoverModels.kt （受け渡し関連のデータ型定義）
│       │   │   ├── ChatModels.kt （チャット関連のデータ型定義）
│       │   │   ├── ContactModels.kt （連絡先関連のデータ型定義）
│       │   │   ├── MatchingResultModels.kt （マッチング結果のデータ型定義）
│       │   │   ├── AiFeatureModels.kt （AI特徴抽出のデータ型定義）
│       │   │   ├── AiSimilarityModels.kt （AI類似度判定のデータ型定義）
│       │   │   ├── PetPhotoModels.kt （ペット写真のデータ型定義）
│       │   │   ├── ShelterPetListModels.kt （保護団体ペット一覧のデータ型定義）
│       │   │   ├── ErrorResponse.kt （エラーレスポンスのデータ型定義）
│       │   │   ├── HealthResponse.kt （ヘルスチェックレスポンスのデータ型定義）
│       │   │   └── PhotoUploadResponse.kt （写真アップロードレスポンスのデータ型定義）
│       │   ├── repositories/
│       │   │   ├── UserRepository.kt （ユーザー情報のデータベース操作）
│       │   │   ├── LostPetRepository.kt （迷子ペット情報のデータベース操作）
│       │   │   ├── LostPetMatchRepository.kt （迷子ペットマッチ情報のデータベース操作）
│       │   │   ├── FoundPetRepository.kt （発見ペット情報のデータベース操作）
│       │   │   ├── RescuedPetRepository.kt （保護ペット情報のデータベース操作）
│       │   │   ├── MatchingRepository.kt （AIマッチング候補の絞り込み）
│       │   │   ├── MatchDetailRepository.kt （マッチング詳細のデータベース操作）
│       │   │   ├── HandoverRepository.kt （受け渡し情報のデータベース操作）
│       │   │   ├── ChatRepository.kt （チャットメッセージのデータベース操作）
│       │   │   ├── NotificationRepository.kt （通知情報のデータベース操作）
│       │   │   ├── PetPhotoRepository.kt （ペット写真のデータベース操作）
│       │   │   ├── ContactRepository.kt （連絡先情報のデータベース操作）
│       │   │   └── ShelterPetListRepository.kt （保護団体ペット一覧のデータベース操作）
│       │   └── services/
│       │       ├── AiExtractionService.kt （写真からペット特徴をAI抽出）
│       │       ├── AiSimilarityService.kt （AI画像類似度の判定）
│       │       ├── MatchingService.kt （マッチング処理）
│       │       ├── EmailService.kt （メール送信）
│       │       ├── StorageService.kt （写真ストレージ管理）
│       │       └── GeocodingService.kt （位置情報処理）
│       └── resources/
│           ├── application.yaml
│           └── logback.xml
│
└── ai/
    ├── common.py （AI処理の共通モジュール・SigLIP2による類似度判定）
    ├── match_api.py （写真からペット特徴を抽出するAI判定APIサーバー）
    ├── tag_pet.py （ペットへのタグ付け処理）
    ├── list_pets.py （ペット一覧取得）
    ├── serve_frontend.py （開発用フロントエンドHTTPサーバー）
    └── debug/
        ├── debug_download_1.py
        └── debug_download_2.py
