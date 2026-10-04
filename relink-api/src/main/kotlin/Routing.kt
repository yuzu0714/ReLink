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
import com.models.VoiceUploadResponse
import com.models.RegisterRequest
import com.models.LoginRequest
import com.models.AuthResponse
import com.repositories.UserRepository
import com.services.StorageService
import com.exceptions.ForbiddenException
import com.models.LostPetRegisterRequest
import com.models.LostPetRegisterResponse
import com.repositories.LostPetRepository
import com.models.FoundPetRegisterRequest
import com.models.FoundPetRegisterResponse
import com.repositories.FoundPetRepository
import com.models.RescuedPetRegisterRequest
import com.models.RescuedPetRegisterResponse
import com.repositories.RescuedPetRepository
import com.models.ContactRequest
import com.repositories.ContactRepository
import com.models.toResponse
import com.models.ShelterPetListResponse
import com.repositories.ShelterPetListRepository
import com.repositories.MatchingRepository
import com.services.MatchingService
import com.models.MatchingRunResponse
import com.models.ContactStatusUpdateRequest
import com.repositories.NotificationRepository
import com.repositories.MatchDetailRepository
import com.models.LostPetMatchResponse
import com.repositories.LostPetMatchRepository
import com.models.HandoverRequest
import com.models.OwnerPetListItem
import com.models.OwnerPetListResponse
import com.repositories.HandoverRepository
import com.repositories.PetPhotoRepository
import com.db.LostPetRegisterTable
import com.repositories.ChatRepository
import com.models.ChatContactsResponse
import com.models.ChatMessageRequest
import com.models.ChatMessagesResponse
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import com.models.ShelterLostPetListResponse // ★追加：迷子一覧のレスポンスDTO

fun Application.configureRouting() {
    routing {
        get("/health") {
            call.respond(HttpStatusCode.OK, HealthResponse(status = "ok", service = "relink-api"))
        }

        post("/auth/register") {
            val request = call.receive<RegisterRequest>()
            val userId = UserRepository.register(request).toString()
            val token = generateToken(userId = userId, role = request.role)
            call.respond(HttpStatusCode.Created, AuthResponse(token = token, userId = userId, role = request.role))
        }

        post("/auth/login") {
            val request = call.receive<LoginRequest>()
            val result = UserRepository.login(request.email, request.password, request.role)
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

        authenticate("auth-jwt") {
            post("/pets/photos") {
                val multipart = call.receiveMultipart()
                var fileBytes: ByteArray? = null
                var fileName = ""
                var contentType = "image/jpeg"

                multipart.forEachPart { part ->
                    if (part is PartData.FileItem) {
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
            
            post("/pets/voice") {
                val multipart = call.receiveMultipart()
                var fileBytes: ByteArray? = null
                var fileName = ""
                var contentType = "audio/webm"

                multipart.forEachPart { part ->
                    if (part is PartData.FileItem) {
                        val safeOriginalName = (part.originalFileName ?: "voice.webm")
                            .replace(Regex("[^A-Za-z0-9._-]"), "_")

                        fileName = "${java.util.UUID.randomUUID()}_$safeOriginalName"
                        contentType = part.contentType?.toString() ?: contentType
                        fileBytes = part.provider().readRemaining().readBytes()
                    }
                    part.dispose()
                }

                if (fileBytes == null) {
                    throw IllegalArgumentException("音声ファイルが見つかりません")
                }

                val voiceUrl = storageService.uploadVoice(
                    fileName,
                    fileBytes!!,
                    contentType
                )

                call.respond(
                    HttpStatusCode.Created,
                    VoiceUploadResponse(voiceUrl)
                )
            }
            
            get("/pets/{petId}/voice") {
                val petId = call.parameters["petId"]?.toLongOrNull()
                    ?: throw IllegalArgumentException("petIdは数値で指定してください")

                val voiceUrl = transaction {
                    LostPetRegisterTable
                        .selectAll()
                        .where { LostPetRegisterTable.id eq petId }
                        .firstOrNull()
                        ?.get(LostPetRegisterTable.voiceUrl)
                }

                call.respond(
                    HttpStatusCode.OK,
                    mapOf("voiceUrl" to voiceUrl)
                )
            }

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

            // 追加: 発見者の保護写真をAI解析し、既存の迷子報告と照合するAPI
            post("/pets/match-lost") {
                val principal = call.principal<JWTPrincipal>()
                val role = principal?.payload?.getClaim("role")?.asString()
                if (role != "finder") {
                    throw ForbiddenException("この操作にはfinder権限が必要です")
                }

                val multipart = call.receiveMultipart()
                val photos = mutableListOf<Pair<String, ByteArray>>()
                multipart.forEachPart { part ->
                    if (part is PartData.FileItem) {
                        val safeOriginalName = (part.originalFileName ?: "photo.jpg")
                            .replace(Regex("[^A-Za-z0-9._-]"), "_")
                        photos.add(safeOriginalName to part.provider().readRemaining().readBytes())
                    }
                    part.dispose()
                }
                if (photos.isEmpty()) {
                    throw IllegalArgumentException("画像ファイルが見つかりません")
                }

                val features = aiExtractionService.extractFeatures(photos)
                val candidates = LostPetMatchRepository.findMatches(features)
                call.respond(HttpStatusCode.OK, LostPetMatchResponse(candidates.isNotEmpty(), candidates))
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

                call.respond(
                    HttpStatusCode.Created,
                    LostPetRegisterResponse(id = insertedId)
                )
            }

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

            get("/shelter/pets") {
                val principal = call.principal<JWTPrincipal>()
                val role = principal?.payload?.getClaim("role")?.asString()

                if (role != "shelter") {
                    throw ForbiddenException("この操作にはshelter権限が必要です")
                }

                val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 12
                val offset = call.request.queryParameters["offset"]?.toIntOrNull() ?: 0
                val (pets, hasMore) = ShelterPetListRepository.getAllPaged(limit, offset)
                val nextCursor = if (hasMore) (offset + limit).toLong() else null
                call.respond(HttpStatusCode.OK, ShelterPetListResponse(pets = pets, nextCursor = nextCursor))
            }
            
            // ★新規追加：保護団体向け「迷子ペット一覧」API
            // /shelter/pets と同じく shelter 権限のみ。authenticate{} の直下に置くこと
            // (他のルートの中にネストするとビルドは通るのに404になるよ！)
            get("/shelter/lost-pets") {
                val principal = call.principal<JWTPrincipal>()
                val role = principal?.payload?.getClaim("role")?.asString()

                if (role != "shelter") {
                    throw ForbiddenException("この操作にはshelter権限が必要です")
                }

                val pets = LostPetRepository.findAllForShelter()
                call.respond(HttpStatusCode.OK, ShelterLostPetListResponse(pets = pets))
            }
            
            // ★新規追加：保護団体向け「迷子ペット詳細」API(1件)
            // /shelter/lost-pets と同じく shelter 権限のみ。電話番号・音声URLはここで返す
            get("/shelter/lost-pets/{id}") {
                val principal = call.principal<JWTPrincipal>()
                val role = principal?.payload?.getClaim("role")?.asString()

                if (role != "shelter") {
                    throw ForbiddenException("この操作にはshelter権限が必要です")
                }

                val id = call.parameters["id"]?.toLongOrNull()
                    ?: throw IllegalArgumentException("idは数値で指定してください") // → 400

                val detail = LostPetRepository.findDetailForShelter(id)
                    ?: throw NoSuchElementException("指定された迷子ペットが見つかりません: $id") // → 404

                call.respond(HttpStatusCode.OK, detail)
            }
            
            /*★新規追加
             * JWTトークンからログイン情報を取得
             * 飼い主のペットを取得
             */
            get("/pets/lost") {
                val principal = call.principal<JWTPrincipal>()
                val role = principal?.payload?.getClaim("role")?.asString()

                if (role != "owner") {
                    throw ForbiddenException("この操作にはowner権限が必要です")
                }

                val userId = principal?.payload?.getClaim("userId")?.asString()?.toLongOrNull()
                    ?: throw IllegalArgumentException("ユーザーIDを取得できません")

                // ★改善：カーソルページネーション対応
                // limit: 1回あたりの取得件数（1〜50件、デフォルト12件）
                // cursor: 前ページの最後のペットID（省略時は先頭から取得）
                val limit = call.request.queryParameters["limit"]?.toIntOrNull()?.coerceIn(1, 50) ?: 12
                val cursor = call.request.queryParameters["cursor"]?.toLongOrNull()

                val (pets, nextCursor) = LostPetRepository.findByUserIdPaged(userId, limit, cursor)

                // ★改善：N+1クエリ解消 → 全ペット分の代表写真を1回のクエリで一括取得
                val photoMap = PetPhotoRepository.findFirstPhotoByPets("lost", pets.map { it.id })

                val petItems = pets.map { pet ->
                    OwnerPetListItem(
                        photoUrl = photoMap[pet.id],
                        id = pet.id,
                        specie = pet.specie,
                        color = pet.color,
                        lostPlace = pet.lostPlace,
                        other = null
                    )
                }

                call.respond(
                    HttpStatusCode.OK,
                    OwnerPetListResponse(pets = petItems, nextCursor = nextCursor)
                )
            }

            get("/notifications") {
                val principal = call.principal<JWTPrincipal>()
                val userId = principal?.payload?.getClaim("userId")?.asString()?.toLongOrNull()
                    ?: throw IllegalArgumentException("userId が取得できません")
                val notifications = NotificationRepository.findByUser(userId)
                call.respond(HttpStatusCode.OK, NotificationsResponse(notifications = notifications))
            }

            patch("/notifications/{id}/read") {
                val notificationId = call.parameters["id"]?.toLongOrNull()
                    ?: throw IllegalArgumentException("idは数値で指定してください")
                NotificationRepository.markAsRead(notificationId)
                call.respond(HttpStatusCode.OK, mapOf("ok" to true))
            }

            get("/chat/contacts") {
                val role = requireChatRole(call)
                val userId = authenticatedUserId(call)
                call.respond(
                    HttpStatusCode.OK,
                    ChatContactsResponse(contacts = ChatRepository.findContacts(userId, role))
                )
            }

            get("/chat/conversations/{userId}/messages") {
                val role = requireChatRole(call)
                val userId = authenticatedUserId(call)
                val otherUserId = call.parameters["userId"]?.toLongOrNull()
                    ?: throw IllegalArgumentException("userIdは数値で指定してください")

                if (userId == otherUserId || !ChatRepository.canChat(role, otherUserId)) {
                    throw NoSuchElementException("指定されたチャット相手が見つかりません")
                }

                call.respond(
                    HttpStatusCode.OK,
                    ChatMessagesResponse(
                        messages = ChatRepository.findConversation(userId, otherUserId)
                    )
                )
            }

            post("/chat/messages") {
                val role = requireChatRole(call)
                val userId = authenticatedUserId(call)
                val request = call.receive<ChatMessageRequest>()
                val message = request.message.trim()

                if (message.isBlank()) {
                    throw IllegalArgumentException("メッセージを入力してください")
                }
                if (message.length > 500) {
                    throw IllegalArgumentException("メッセージは500文字以内で入力してください")
                }
                if (userId == request.receiverId || !ChatRepository.canChat(role, request.receiverId)) {
                    throw NoSuchElementException("指定されたチャット相手が見つかりません")
                }

                call.respond(
                    HttpStatusCode.Created,
                    ChatRepository.insertMessage(userId, request.receiverId, message)
                )
            }

            get("/matches/{matchId}/detail") {
                val matchId = call.parameters["matchId"]?.toLongOrNull()
                    ?: throw IllegalArgumentException("matchIdは数値で指定してください")
                val detail = MatchDetailRepository.findById(matchId)
                    ?: throw NoSuchElementException("指定されたmatchIdが見つかりません: $matchId")
                call.respond(HttpStatusCode.OK, detail)
            }
            // 受け渡し記録の登録(shelter/finder限定)
            post("/handovers") {
                val principal = call.principal<JWTPrincipal>()
                val role = principal?.payload?.getClaim("role")?.asString()

                if (role != "shelter" && role != "finder") {
                    throw ForbiddenException("この操作には保護団体(shelter)または発見者(finder)権限が必要です")
                }

                val request = call.receive<HandoverRequest>()

                if (!HandoverRepository.contactExists(request.contactId)) {
                    throw NoSuchElementException("指定されたcontactIdが見つかりません: \${request.contactId}")
                }

                val response = HandoverRepository.insert(request)
                call.respond(HttpStatusCode.Created, response)
            }
        }


        get("/matching/test") {
            val specie = call.request.queryParameters["specie"]
            val color = call.request.queryParameters["color"]
            val lostPlace = call.request.queryParameters["lostPlace"]

            val candidates = MatchingRepository.findCandidates(specie, color, lostPlace)
            call.respond(HttpStatusCode.OK, candidates)
        }

        post("/contacts") {
            val request = call.receive<ContactRequest>()

            if (!ContactRepository.matchExists(request.matchId)) {
                throw NoSuchElementException("指定されたmatch_idが見つかりません: ${request.matchId}")
            }

            val response = ContactRepository.insert(request)
            call.respond(HttpStatusCode.Created, response)
        }

        patch("/contacts/{id}/status") {
            val id = call.parameters["id"]?.toLongOrNull()
                ?: throw IllegalArgumentException("idは数値で指定してください")

            val request = call.receive<ContactStatusUpdateRequest>()

            val updated = ContactRepository.updateStatus(id, request.status)
                ?: throw NoSuchElementException("指定されたcontacts.idが見つかりません: $id")

            call.respond(HttpStatusCode.OK, updated)
        }


        // 受け渡し記録の取得(認証不要、誰でも確認可)
        get("/handovers/{contactId}") {
            val contactId = call.parameters["contactId"]?.toLongOrNull()
                ?: throw IllegalArgumentException("contactId(数値)をパスパラメータで指定してください")

            val records = HandoverRepository.findByContactId(contactId)
            call.respond(HttpStatusCode.OK, records)
        }

        get("/handovers") {
            val records = HandoverRepository.getAll()
            call.respond(HttpStatusCode.OK, records)
        }
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

private fun authenticatedUserId(call: ApplicationCall): Long =
    call.principal<JWTPrincipal>()
        ?.payload
        ?.getClaim("userId")
        ?.asString()
        ?.toLongOrNull()
        ?: throw IllegalArgumentException("userId が取得できません")

private fun requireChatRole(call: ApplicationCall): String {
    val role = call.principal<JWTPrincipal>()
        ?.payload
        ?.getClaim("role")
        ?.asString()

    if (role == null || role !in setOf("owner", "finder", "shelter")) {
        throw ForbiddenException("チャット機能には有効な利用者権限が必要です")
    }

    return role
}

@Serializable
data class NotificationsResponse(val notifications: List<com.repositories.NotificationRow>)
