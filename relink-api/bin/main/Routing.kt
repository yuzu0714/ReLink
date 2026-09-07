package com

import com.models.HealthResponse
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.request.*
import io.ktor.http.content.*
import io.ktor.utils.io.*
import io.ktor.utils.io.core.*
import com.models.PhotoUploadResponse
import com.models.RegisterRequest
import com.models.LoginRequest
import com.models.AuthResponse
import com.repositories.UserRepository
import com.services.StorageService
import com.exceptions.ForbiddenException

// 追加:ペット登録API本体で使うDTOとリポジトリ
import com.models.LostPetRegisterRequest
import com.models.LostPetRegisterResponse
import com.repositories.LostPetRepository

// Part 2で追加:発見API(finder向け)・保護API(shelter向け)
import com.models.FoundPetRegisterRequest
import com.models.FoundPetRegisterResponse
import com.repositories.FoundPetRepository
import com.models.RescuedPetRegisterRequest
import com.models.RescuedPetRegisterResponse
import com.repositories.RescuedPetRepository

// ★修正：ContactRequest / ContactRepository の import が漏れていたため追加
import com.models.ContactRequest
import com.repositories.ContactRepository
import com.models.toResponse

// 委任タスク: 保護ペット一覧取得API(GET /shelter/pets、shelter向け)
import com.models.ShelterPetListResponse
import com.repositories.ShelterPetListRepository

// ★新規追加：Day3のマッチング絞り込み機能の動作確認用
import com.repositories.MatchingRepository

// ↓↓↓ 既存のimportに追加 ↓↓↓
import com.services.MatchingService
import com.models.MatchingRunResponse

// ↓↓↓ 既存のimportに追加 ↓↓↓
import com.models.ContactStatusUpdateRequest

// ↓↓↓ 既存のimportに追加 ↓↓↓
import com.models.MatchResultItem

// ★新規追加：通知API
import com.repositories.NotificationRepository
import kotlinx.serialization.Serializable

fun Application.configureRouting() {
    routing {
        get("/health") {
            call.respond(HttpStatusCode.OK, HealthResponse(status = "ok", service = "relink-api"))
        }
        // 本物のユーザー認証(パスワード照合など)はこれ以降に追加する。
        // 今は「roleを渡したらトークンが返ってくる」動作確認用の仮ルート
        // 新規ユーザー登録
        post("/auth/register") {
            val request = call.receive<RegisterRequest>()
            val userId = UserRepository.register(request).toString()
            val token = generateToken(userId = userId, role = request.role)
            call.respond(HttpStatusCode.Created, AuthResponse(token = token, userId = userId, role = request.role))
        }

        // ログイン
        post("/auth/login") {
            val request = call.receive<LoginRequest>()
            val result = UserRepository.login(request.email, request.password)
                ?: throw IllegalArgumentException("メールアドレスまたはパスワードが正しくありません")
            val (userId, role) = result
            val token = generateToken(userId = userId, role = role)
            call.respond(HttpStatusCode.OK, AuthResponse(token = token, userId = userId, role = role))
        }

        post("/auth/test-login") {
            val role = call.request.queryParameters["role"] ?: "owner"
            val token = generateToken(userId = "test-user-1", role = role)
            call.respond(mapOf("token" to token))
        }

        // 認証保護されたルートの例(トークンが必須になる)
        authenticate("auth-jwt") {
            post("/pets/photos") {
                val multipart = call.receiveMultipart()
                var fileBytes: ByteArray? = null
                var fileName = ""
                var contentType = "image/jpeg"

                multipart.forEachPart { part ->
                    if (part is PartData.FileItem) {
                        // 元のファイル名にスペース・日本語・括弧などが入っていると、
                        // StorageService側でURLに未エンコードのまま組み込まれてしまい、
                        // Supabase Storageへのアップロードが400 Bad Requestになることがあるため、
                        // URLに安全な文字(英数字・.・_・-)だけに置き換えてから使う
                        val safeOriginalName = (part.originalFileName ?: "photo.jpg")
                            .replace(Regex("[^A-Za-z0-9._-]"), "_")
                        fileName = "${java.util.UUID.randomUUID()}_$safeOriginalName"
                        contentType = part.contentType?.toString() ?: contentType
                        fileBytes = part.provider().readRemaining().readBytes()
                    }
                    part.dispose()
                }

                if (fileBytes == null) {
                    throw IllegalArgumentException("画像ファイルが見つかりません")
                }

                val photoUrl = storageService.uploadImage(fileName, fileBytes!!, contentType)
                call.respond(HttpStatusCode.Created, PhotoUploadResponse(photoUrl))
            }
            
                        // 追加:登録フォームで未入力の項目(犬種・そのほか欄など)を、写真からAIで自動入力するための下準備。
            post("/pets/extract-features") {
                val multipart = call.receiveMultipart()
                val photos = mutableListOf<Pair<String, ByteArray>>()

                multipart.forEachPart { part ->
                    if (part is PartData.FileItem) {
                        val safeOriginalName = (part.originalFileName ?: "photo.jpg")
                            .replace(Regex("[^A-Za-z0-9._-]"), "_")
                        val bytes = part.provider().readRemaining().readBytes()
                        photos.add(safeOriginalName to bytes)
                    }
                    part.dispose()
                }

                if (photos.isEmpty()) {
                    throw IllegalArgumentException("画像ファイルが見つかりません")
                }

                val raw = aiExtractionService.extractFeatures(photos)
                call.respond(HttpStatusCode.OK, raw.toResponse())
            }

            post("/pets/lost") {
                val principal = call.principal<JWTPrincipal>()
                val role = principal?.payload?.getClaim("role")?.asString()

                if (role != "owner") {
                    throw ForbiddenException("この操作にはowner権限が必要です")
                }

                val userId = principal?.payload?.getClaim("userId")?.asString()?.toLongOrNull()
                val request = call.receive<LostPetRegisterRequest>()
                val insertedId = LostPetRepository.insert(request, userId)

                // ★新規追加：登録が成功した直後に、自動でマッチング処理(SQL絞り込み→AI類似度判定→matches保存)を実行する
                // これまでは/matching/runを手動で叩く必要があったが、本番導線として自動化した
                //
                // ★重要：マッチング処理自体が失敗しても、迷子ペットの「登録」自体は成功として扱う
                // (写真がまだ無い、候補が1件も見つからない、AIサーバーが一時的に落ちている等の理由で
                //  マッチングが失敗しても、ユーザーが行いたかった「登録」まで巻き添えで失敗させないための設計)
                val matchResults: List<MatchResultItem> = try {
                    MatchingService.runMatching(insertedId)
                } catch (e: Exception) {
                    call.application.log.warn("マッチング処理に失敗しましたが、登録は継続します(lostPetId=$insertedId): ${e.message}")
                    emptyList()
                }

                call.respond(
                    HttpStatusCode.Created,
                    LostPetRegisterResponse(id = insertedId, matchResults = matchResults)
                )
            }

            // Part 2 追加①: 発見API(foundpet_register へのINSERT、finder向け)
            // /pets/lost と同じ形。authenticate{} 直下の兄弟として並べること
            // (他のルートの中にネストすると、ビルドは通ってもルートが認識されず404になるので注意)
            post("/pets/found") {
                val principal = call.principal<JWTPrincipal>()
                val role = principal?.payload?.getClaim("role")?.asString()

                if (role != "finder") {
                    throw ForbiddenException("この操作にはfinder権限が必要です")
                }

                val userId = principal?.payload?.getClaim("userId")?.asString()?.toLongOrNull()
                val request = call.receive<FoundPetRegisterRequest>()
                val insertedId = FoundPetRepository.insert(request, userId)

                call.respond(HttpStatusCode.Created, FoundPetRegisterResponse(id = insertedId))
            }

            // Part 2 追加②: 保護API(rescuedpet_register へのINSERT、shelter向け)
            post("/pets/rescued") {
                val principal = call.principal<JWTPrincipal>()
                val role = principal?.payload?.getClaim("role")?.asString()

                if (role != "shelter") {
                    throw ForbiddenException("この操作にはshelter権限が必要です")
                }

                val userId = principal?.payload?.getClaim("userId")?.asString()?.toLongOrNull()
                val request = call.receive<RescuedPetRegisterRequest>()
                val insertedId = RescuedPetRepository.insert(request, userId)

                call.respond(HttpStatusCode.Created, RescuedPetRegisterResponse(id = insertedId))
            }

            // 委任タスク: 保護ペット一覧取得API(shelter向け)
            // foundpet_register・rescuedpet_registerの両方から全件取得して1つにまとめて返す(単純なSELECTのみ、
            // matchesテーブル関連の絞り込みは含まない)。/pets/rescued と同じく authenticate{} 直下の兄弟として置くこと
            // (他のルートの中にネストするとビルドは通ってもルートが404になるので注意)
            get("/shelter/pets") {
                val principal = call.principal<JWTPrincipal>()
                val role = principal?.payload?.getClaim("role")?.asString()

                if (role != "shelter") {
                    throw ForbiddenException("この操作にはshelter権限が必要です")
                }

                val pets = ShelterPetListRepository.getAll()
                call.respond(HttpStatusCode.OK, ShelterPetListResponse(pets = pets))
            }

            // ★新規追加：飼い主向け通知一覧取得API
            get("/notifications") {
                val principal = call.principal<JWTPrincipal>()
                val userId = principal?.payload?.getClaim("userId")?.asString()?.toLongOrNull()
                    ?: throw IllegalArgumentException("userId が取得できません")

                val notifications = NotificationRepository.findByUser(userId)
                call.respond(HttpStatusCode.OK, NotificationsResponse(notifications = notifications))
            }
        }
        
        // ★新規追加：Day3 SQL絞り込みロジックの動作確認用エンドポイント
        // クエリパラメータでspecie・color・lostPlaceを受け取り、
        // MatchingRepository.findCandidates()で絞り込んだ結果をそのまま返すだけの仮実装
        // (本番では/pets/lostの登録時などに自動で走らせる想定。今は単体動作確認が目的)
        get("/matching/test") {
            val specie = call.request.queryParameters["specie"]
            val color = call.request.queryParameters["color"]
            val lostPlace = call.request.queryParameters["lostPlace"]

            val candidates = MatchingRepository.findCandidates(specie, color, lostPlace)
            call.respond(HttpStatusCode.OK, candidates)
        }
        
        // ★修正：/contacts を authenticate ブロックの外に移動
        // 決定事項③（JWT認証なし、match_idの実在チェックのみ）を反映するため
        // authenticate の"外"にあるルートは、トークン無しで誰でも呼び出せる
        post("/contacts") {
            val request = call.receive<ContactRequest>()

            if (!ContactRepository.matchExists(request.matchId)) {
                throw NoSuchElementException("指定されたmatch_idが見つかりません: ${request.matchId}")
            }

            val response = ContactRepository.insert(request)
            call.respond(HttpStatusCode.Created, response)
        }
        
        // ★新規追加：contactsのステータスを更新するAPI(認証なし、matches.idの実在チェックと同じノリ)
        // 保健所側の運用画面などから、連絡の進捗(pending→contacted→confirmed/rejected)を更新する想定
        patch("/contacts/{id}/status") {
            val id = call.parameters["id"]?.toLongOrNull()
                ?: throw IllegalArgumentException("idは数値で指定してください")

            val request = call.receive<ContactStatusUpdateRequest>()

            val updated = ContactRepository.updateStatus(id, request.status)
                ?: throw NoSuchElementException("指定されたcontacts.idが見つかりません: $id")

            call.respond(HttpStatusCode.OK, updated)
        }
        
        // ★新規追加(Day3-3)：SQL絞り込み→AI類似度判定→matches保存、の一連の流れを動作確認するための仮エンドポイント
        // /matching/testと同じく認証なし(authenticateブロックの外)に置いている
        // 本番実装時は/pets/lost登録時などに自動で呼ばれる形に置き換える予定
        post("/matching/run") {
            val lostPetId = call.request.queryParameters["lostPetId"]?.toLongOrNull()
                ?: throw IllegalArgumentException("lostPetId(数値)をクエリパラメータで指定してください")

            val results = MatchingService.runMatching(lostPetId)

            call.respond(
                HttpStatusCode.OK,
                MatchingRunResponse(
                    lostPetId = lostPetId,
                    candidateCount = results.size,
                    results = results
                )
            )
        }
    }
}

// ★新規追加：GET /notifications のレスポンス用DTO
@Serializable
data class NotificationsResponse(
    val notifications: List<com.repositories.NotificationRow>
)
