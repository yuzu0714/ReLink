# ReLINK バックエンド開発環境セッティング手順

このドキュメントは、ReLINKのバックエンド(Kotlin webAPIサーバー)開発に新しく参加するメンバー向けの環境構築手順です。上から順に進めれば、ローカル環境でサーバーを起動し、データベースへの接続確認まで完了します。

---

## 1. JDKのインストール

- バージョンは **JDK 25(LTS)** を使用する。
- JDK 21は1つ前のLTS、JDK 26はLTSではない短命リリースのため、新規に環境構築する場合はJDK 25を選ぶこと。
- 通常のインストーラ形式(.msi/.pkg)でよい。複数バージョンの共存が必要な場合のみ、圧縮アーカイブ形式やSDKMAN等のバージョン管理ツールを検討する。

## 2. VS Codeの拡張機能インストール

以下3つを最低限インストールする。

| 拡張機能 | 役割 |
|---|---|
| Kotlin by JetBrains | コード補完・診断など、Kotlinのコア機能 |
| Extension Pack for Java | デバッガー(ブレークポイント等)。KotlinはJVM言語のためJavaのデバッガーがそのまま使える |
| Gradle for Java | Gradleタスク(ビルド・実行)をVS Code上から実行する |

補足として、`.env`ファイルのシンタックスハイライト用にDotENV、Supabase(PostgreSQL)へVS Code上から接続したい場合はSQLTools系拡張機能を追加してもよい(任意)。

## 3. プロジェクトの取得

### 新規メンバーの場合

1. GitHubリポジトリ「ReLINK」(大元のリポジトリ、バックエンド以外のファイルも含む)へのアクセス権を管理者に依頼し、招待を受ける。
2. 以下でクローンする。

```bash
git clone <ReLINKリポジトリのURL>
cd ReLINK/relink-api
```

Kotlinプロジェクト(`relink-api`)は、大元の「ReLINK」リポジトリのサブフォルダとして管理されている。以降の手順(依存関係の確認・`.env`の設置・起動確認など)は、すべて`ReLINK/relink-api`フォルダ内で行う。

### プロジェクトを新規生成する場合(参考)(今回は使わない)

[start.ktor.io](https://start.ktor.io) で生成する場合は、以下の設定で作成する。

| 項目 | 設定値 |
|---|---|
| Build system | **Gradle Kotlin DSL**(「Amper」等の別ビルドシステムを誤って選ばないよう注意) |
| Engine | Netty |
| Configuration | **YAML**(再コンパイル不要で設定変更でき、運用時に有利) |

選択するプラグイン:

- Content Negotiation
- kotlinx.serialization Json
- CORS
- Authentication / Authentication JWT
- Status Pages
- Call Logging
- Call ID

※ Routing機能はKtorのコアに標準搭載されているため、プラグインとして選択する必要はない。検索すると出てくる「Resources」(型安全ルーティング)や「kotlinx.rpc」(RPC方式の通信ライブラリ)は本プロジェクトの構成とは異なるため選択しないこと。

## 4. Supabase(データベース)へのアクセス権取得

**重要:** データベースへのアクセス権は、GitHubリポジトリとは別に、Supabase組織への招待が必要です。

1. 管理者に依頼し、Supabase組織(Nao-5115's Org)のメンバーとして招待を受ける。
2. 招待を受けたら、自分のアカウントで「ReLINK」プロジェクトにアクセスできることを確認する。

## 5. 環境変数(.env)の設定

プロジェクトルート(`gradlew.bat`と同じ階層)に`.env`ファイルを作成する。

```
DATABASE_URL=jdbc:postgresql://<ホスト>:5432/postgres
DATABASE_USER=postgres
DATABASE_PASSWORD=<データベースパスワード>
```

接続情報の取得場所は以下の通り。

- 接続文字列・ホスト名:Supabase管理画面右上の「Connect」ボタン →「直接」タブ
- データベースパスワード:プロジェクト作成時に設定したもの。不明な場合は同画面の「データベースパスワードをリセットします」から再設定可能

`.env`は`.gitignore`により管理対象外となっているため、Gitには含まれない。値は管理者から個別に、チャット等への直接貼り付けを避けた安全な方法で受け取ること。

## 6. Gradle依存関係の確認

`build.gradle.kts`の`dependencies { }`内に、以下が含まれていることを確認する(新規参加者は基本的に追加不要、リポジトリに含まれているはず)。

```kotlin
implementation("org.jetbrains.exposed:exposed-core:0.55.0")
implementation("org.jetbrains.exposed:exposed-dao:0.55.0")
implementation("org.jetbrains.exposed:exposed-jdbc:0.55.0")
implementation("org.postgresql:postgresql:42.7.4")
implementation("io.github.cdimascio:dotenv-kotlin:6.4.1")
```

## 7. 起動確認

ターミナルでプロジェクトルートに移動し、以下を実行する。

```powershell
# Windows(PowerShell)
.\gradlew.bat run

# Mac/Linux
./gradlew run
```

起動後、ブラウザで以下にアクセスする。

```
http://localhost:8080/db-test
```

「DB接続成功!現在時刻: ...」と表示されれば、環境構築は完了。

---

## つまずきやすいポイント(トラブルシューティング)

| 症状 | 原因・対処 |
|---|---|
| `gradlew.bat` is not recognized | PowerShellでは同一フォルダ内のファイル実行時に `.\` を先頭に付ける必要がある。`.\gradlew.bat run` とする |
| `kotlin.bat` しか見当たらない、`gradlew.bat` が無い | プロジェクト生成時のBuild systemが「Gradle」以外(Amper等)になっている可能性が高い。start.ktor.ioでBuild systemを明示的に「Gradle Kotlin DSL」に指定して再生成する |
| `build.gradle.kts`で `Expecting an element` エラー | Kotlinスクリプト内のコメントは `#` ではなく `//` を使う必要がある |
| `Suspension fun` コンパイルエラー | `transaction { }`ブロック内でKtorのsuspend関数(`call.respondText`等)を直接呼んでいる。`transaction { }`は結果を返す処理のみに留め、レスポンス送信はブロックの外で行う |
| `Application.kt` が見当たらない | プラグインを複数選択した場合、機能ごとに`HTTP.kt`・`Routing.kt`等へ分割生成される。起動処理は`Main.kt`、モジュール読み込み一覧は`src/main/resources/application.yaml`内の`modules`に記載されている |
| 新しい設定ファイル(例:`Database.kt`)を追加したのに反映されない | `application.yaml`の`modules`リストに、`com.<ファイル名>Kt.<関数名>`の形式で追記が必要 |

---

## 参考:現在のプロジェクト構成

```
ReLINK/                        # 大元のリポジトリ
├── README.md
├── .gitignore
├── relink-demo.html
└── relink-api/                 # ← Kotlin webAPIサーバー(本手順の対象)
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