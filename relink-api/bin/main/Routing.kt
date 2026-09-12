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
import com.models.MatchResultItem
import com.repositories.NotificationRepository
import com.repositories.MatchDetailRepository
import com.models.LostPetMatchResponse
import com.repositories.LostPetMatchRepository
import kotlinx.serialization.Serializable

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

                val pets = ShelterPetListRepository.getAll()
                call.respond(HttpStatusCode.OK, ShelterPetListResponse(pets = pets))
            }

            get("/notifications") {
                val principal = call.principal<JWTPrincipal>()
                val userId = principal?.payload?.getClaim("userId")?.asString()?.toLongOrNull()
                    ?: throw IllegalArgumentException("userId が取得できません")
                val notifications = NotificationRepository.findByUser(userId)
                call.respond(HttpStatusCode.OK, NotificationsResponse(notifications = notifications))
            }

            get("/matches/{matchId}/detail") {
                val matchId = call.parameters["matchId"]?.toLongOrNull()
                    ?: throw IllegalArgumentException("matchIdは数値で指定してください")
                val detail = MatchDetailRepository.findById(matchId)
                    ?: throw NoSuchElementException("指定されたmatchIdが見つかりません: $matchId")
                call.respond(HttpStatusCode.OK, detail)
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

@Serializable
data class NotificationsResponse(val notifications: List<com.repositories.NotificationRow>)
