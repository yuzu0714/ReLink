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
import com.models.toResponse

// 委任タスク: 保護ペット一覧取得API(GET /shelter/pets、shelter向け)
import com.models.ShelterPetListResponse
import com.repositories.ShelterPetListRepository

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
    }
}
