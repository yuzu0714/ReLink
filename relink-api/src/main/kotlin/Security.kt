package com // ← これが一番上に必要!(Routing.ktと同じパッケージにするため)

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import io.github.cdimascio.dotenv.dotenv   // ← 追加!.envを読み込むライブラリ
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import java.util.*
import com.services.StorageService
import com.services.AiSimilarityService // ★新規追加：AI類似度判定サービスをimport

// --- 設定値 ---
val securityDotenv = dotenv()
val jwtSecret = securityDotenv["JWT_SECRET"] ?: error("JWT_SECRET が設定されていません")
const val jwtIssuer = "relink-api"        // トークンの発行者名(誰が発行したか識別する用)
const val jwtAudience = "relink-users"    // トークンの利用対象者(誰向けか識別する用)
const val jwtRealm = "ReLINK API"         // 認証失敗時にレスポンスヘッダーへ含まれる領域名

// ↓↓↓ 追加:画像アップロード(Supabase Storage)用のサービスをここで初期化
// dotenvの読み込みは上の securityDotenv をそのまま再利用する
// (dotenv()を複数箇所で呼ぶと二重初期化になるため、既存のものに相乗り)
val storageService = StorageService(
    supabaseUrl = securityDotenv["SUPABASE_URL"] ?: error("SUPABASE_URL が設定されていません"),
    serviceRoleKey = securityDotenv["SUPABASE_SERVICE_ROLE_KEY"] ?: error("SUPABASE_SERVICE_ROLE_KEY が設定されていません")
)

// ★新規追加：類似度判定(match_api.py の /compare-photos)へ写真URLを送るためのサービス
// AI_API_BASEは.envで上書きできるが、必須ではない(未設定ならローカルのuvicornデフォルトを使う)。
// ローカルで `uvicorn match_api:app --host 0.0.0.0 --port 8000` を起動しておく必要がある。
// (aiExtractionServiceがまだこのファイルに存在しないため、AI_API_BASEの読み込みはここで単独に行っている)
val aiSimilarityService = AiSimilarityService(
    aiApiBase = securityDotenv["AI_API_BASE"] ?: "http://localhost:8000"
)


// --- トークン発行関数 ---
// ログイン成功時にこれを呼んで、role付きのトークンを作る
// 災害時の再ログインしづらさを考慮して、有効期限は長め(7日間)に設定
fun generateToken(userId: String, role: String): String {
    return JWT.create()
        .withIssuer(jwtIssuer)
        .withAudience(jwtAudience)
        .withClaim("userId", userId)   // ペイロードにuserIdを埋め込む
        .withClaim("role", role)       // ペイロードにroleを埋め込む(owner/finder/shelter)
        .withExpiresAt(Date(System.currentTimeMillis() + 7L * 24 * 60 * 60 * 1000)) // 7日後に失効
        .sign(Algorithm.HMAC256(jwtSecret)) // secretで署名(ここが改ざんチェックのハンコ部分)
}

// --- 検証設定 ---
// リクエストのたびに「関所」として働く部分
fun Application.configureSecurity() {
    authentication {
        // "auth-jwt" という名前でプロバイダを登録
        // → Routing側の authenticate("auth-jwt") { ... } がこの名前を探しに来る
        jwt("auth-jwt") {
            realm = jwtRealm
            verifier(
                JWT.require(Algorithm.HMAC256(jwtSecret))
                    .withIssuer(jwtIssuer)
                    .withAudience(jwtAudience)
                    .build()
            )
            // 署名・有効期限のチェックが通った後、中身が妥当かの最終チェック
            validate { credential ->
                val userId = credential.payload.getClaim("userId").asString()
                if (userId != null) {
                    // JWTPrincipalとして後続のルートでアクセスできるようにする
                    JWTPrincipal(credential.payload)
                } else {
                    null // nullを返すと認証失敗扱いになる → StatusPagesの401フォーマットが発動
                }
            }
        }
    }
}