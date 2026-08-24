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

// 委任タスク: 保護ペット一覧取得API(GET /shelter/pets、shelter向け)
import com.models.ShelterPetListResponse
import com.repositories.ShelterPetListRepository

// ★新規追加：Day3のマッチング絞り込み機能の動作確認用
import com.repositories.MatchingRepository

// ↓↓↓ 既存のimportに追加 ↓↓↓
import com.services.MatchingService
import com.models.MatchingRunResponse

fun Application.configureRouting() {
    routing {
        get("/health") {
            call.respond(HttpStatusCode.OK, HealthResponse(status = "ok", service = "relink-api"))
        }
        // 本物のユーザー認証(パスワード照合など)はこれ以降に追加する。
        // 今は「roleを渡したらトークンが返ってくる」動作確認用の仮ルート
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
                        fileName = "${java.util.UUID.randomUUID()}_${part.originalFileName}"
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

            // authenticate{} 直下の兄弟ルートとして外に出した
            post("/pets/lost") {
                val principal = call.principal<JWTPrincipal>()
                val role = principal?.payload?.getClaim("role")?.asString()

                if (role != "owner") {
                    throw ForbiddenException("この操作にはowner権限が必要です")
                }

                val request = call.receive<LostPetRegisterRequest>()
                val insertedId = LostPetRepository.insert(request)

                call.respond(HttpStatusCode.Created, LostPetRegisterResponse(id = insertedId))
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

                val request = call.receive<FoundPetRegisterRequest>()
                val insertedId = FoundPetRepository.insert(request)

                call.respond(HttpStatusCode.Created, FoundPetRegisterResponse(id = insertedId))
            }

            // Part 2 追加②: 保護API(rescuedpet_register へのINSERT、shelter向け)
            post("/pets/rescued") {
                val principal = call.principal<JWTPrincipal>()
                val role = principal?.payload?.getClaim("role")?.asString()

                if (role != "shelter") {
                    throw ForbiddenException("この操作にはshelter権限が必要です")
                }

                val request = call.receive<RescuedPetRegisterRequest>()
                val insertedId = RescuedPetRepository.insert(request)

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