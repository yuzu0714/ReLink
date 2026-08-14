# ReLINK

災害時ペット保護・マッチングシステム「ReLINK」のリポジトリです。

マイクロチップの有無に依存せず、AIによる画像照合を用いて、災害時にはぐれたペットと飼い主の再会を支援することを目的としています。

## システム構成

本システムは以下の3要素で構成されています。

- **webAPIサーバー**:Kotlin(Ktor)で実装。ペット情報の登録・照合結果の取得・認証・通知処理などを担当。
- **AIサーバー**:Python製。ペット画像の解析・個体照合を担当。
- **データベース**:Supabase(PostgreSQL)。個体識別番号・位置情報・飼い主情報・登録用写真などを管理。

外部連携として、位置情報・距離計算にGoogle Maps APIを使用しています。

## 開発環境

| 項目 | 内容 |
|---|---|
| JDK | 25(LTS) |
| ビルドツール | Gradle(Kotlin DSL) |
| Webフレームワーク | Ktor |
| DB | Supabase(PostgreSQL) |
| ORM | Exposed |
| エディタ | Visual Studio Code |

### VS Code 拡張機能(必須)

- Kotlin by JetBrains
- Extension Pack for Java(デバッグに必要)
- Gradle for Java(ビルド実行に必要)

## セットアップ手順

新しく開発に参加する場合は、以下の手順で環境を整えてください。

### 1. ローカル環境の準備

1. JDK 25をインストールする
2. VS Codeに上記3つの拡張機能をインストールする

### 2. リポジトリの取得

GitHubリポジトリへのアクセス権を管理者に依頼し、招待を受けたら以下でクローンする。

```bash
git clone <リポジトリURL>
cd relink-api
```

### 3. Supabaseへのアクセス権を取得する

**重要:** データベース(Supabase)へのアクセス権は、リポジトリとは別に管理者からの招待が必要です。必ず開発開始前に、Supabase組織(Nao-5115's Org)への招待をチームの管理者に依頼してください。

### 4. 環境変数の設定

プロジェクトルート(`gradlew.bat`と同じ階層)に`.env`ファイルを作成し、以下の内容を記載する。値は管理者から個別に(チャットへの直接貼り付けは避け、安全な方法で)受け取ること。

```
DATABASE_URL=jdbc:postgresql://<ホスト>:5432/postgres
DATABASE_USER=postgres
DATABASE_PASSWORD=<データベースパスワード>
```

`.env`は`.gitignore`に含まれておりGit管理対象外です。リポジトリには含まれないため、必ず個別に取得してください。

### 5. 依存関係の確認

`build.gradle.kts`に以下が含まれていることを確認する(既存プロジェクトでは設定済み)。

```kotlin
implementation("org.jetbrains.exposed:exposed-core:0.55.0")
implementation("org.jetbrains.exposed:exposed-dao:0.55.0")
implementation("org.jetbrains.exposed:exposed-jdbc:0.55.0")
implementation("org.postgresql:postgresql:42.7.4")
implementation("io.github.cdimascio:dotenv-kotlin:6.4.1")
```

### 6. 起動確認

```powershell
# Windows
.\gradlew.bat run

# Mac/Linux
./gradlew run
```

起動後、ブラウザで以下にアクセスし、データベース接続を確認する。

```
http://localhost:8080/db-test
```

「DB接続成功!現在時刻: ...」と表示されれば、環境構築は完了です。

## プロジェクト構成

```
relink-api/
├── src/main/kotlin/com/
│   ├── Main.kt              # エントリーポイント
│   ├── HTTP.kt              # CORS等HTTP関連設定
│   ├── Monitoring.kt        # Call Logging / Call ID
│   ├── Routing.kt           # ルーティング定義
│   ├── Security.kt          # 認証・JWT設定
│   ├── Serialization.kt     # JSONシリアライズ設定
│   ├── StatusPages.kt       # エラーハンドリング設定
│   └── Database.kt          # DB接続設定
├── src/main/resources/
│   └── application.yaml     # サーバー設定(モジュール読み込み含む)
├── build.gradle.kts
└── .env                     # 環境変数(Git管理外)
```

本プロジェクトは`application.yaml`内の`modules`リストに、各機能ファイルの設定関数(`configureXxx`)を列挙する構成を採用しています。新しい機能ファイルを追加した場合は、`application.yaml`への追記を忘れないようにしてください。

## データベース構成

現在、以下の3テーブルで構成されています(詳細はSupabaseのSchema Visualizerを参照)。

- `lostpet_register`:飼い主による迷子ペット登録
- `foundpet_register`:発見者による発見ペット登録
- `rescuedpet_register`:保護団体による保護ペット管理

いずれもRow Level Security(RLS)を有効化しており、Kotlinサーバーは`service_role`キーによる直接接続でアクセスします。SupabaseのData API(自動生成REST API)は使用しない方針です。

## 開発体制

- Web APIサーバー・データベース・外部API連携:バックエンド担当
- AIサーバー(画像照合):AI担当

AIサーバーとの連携仕様(エンドポイント・リクエスト/レスポンス形式)は別途チーム内で合意の上、随時本READMEまたは別ドキュメントに追記予定です。






This project was created using the [Ktor Project Generator](https://start.ktor.io).

Here are some useful links to get you started:
 * [Ktor Documentation](https://ktor.io/docs/home.html)
 * [Ktor GitHub page](https://github.com/ktorio/ktor)
 * [Ktor Slack chat](https://app.slack.com/client/T09229ZC6/C0A974TJ9). [Request an invite](https://surveys.jetbrains.com/s3/kotlin-slack-sign-up).


## Features
Here's a list of features included in this project:

| Name | Description |
|------|-------------|
| [Call Logging](https://start.ktor.io/p/io.ktor/server-call-logging) | Logs client requests |
| [Call ID](https://start.ktor.io/p/io.ktor/server-callid) | Allows to identify a request/call. |
| [Status Pages](https://start.ktor.io/p/io.ktor/server-status-pages) | Provides exception handling for routes |
| [Authentication](https://start.ktor.io/p/io.ktor/server-auth) | Provides extension point for handling the Authorization header |
| [Authentication JWT](https://start.ktor.io/p/io.ktor/server-auth-jwt) | Handles JSON Web Token (JWT) bearer authentication scheme |
| [CORS](https://start.ktor.io/p/io.ktor/server-cors) | Enables Cross-Origin Resource Sharing (CORS) |
| [Content Negotiation](https://start.ktor.io/p/io.ktor/server-content-negotiation) | Provides automatic content conversion according to Content-Type and Accept headers |
| [kotlinx.serialization](https://start.ktor.io/p/io.ktor/server-kotlinx-serialization) | Handles JSON serialization using kotlinx.serialization library |


## Building & Running
To build or run the project, use one of the following tasks:


| Task | Description |
|------|-------------|
| `./gradlew test`    | Run the tests     |
| `./gradlew build`   | Build the project |
| `./gradlew run`     | Run the server    |

If the server starts successfully, you'll see the following output:
```
2024-12-04 14:32:45.584 [main] INFO  Application - Application started in 0.303 seconds.
2024-12-04 14:32:45.682 [main] INFO  Application - Responding at http://0.0.0.0:8080
```
