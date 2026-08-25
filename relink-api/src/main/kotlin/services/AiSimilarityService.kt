package com.services

import com.models.AiSimilarityRawResponse
import com.models.AiSimilarityRequest
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.Json

// AIサーバー(match_api.py)の POST /compare-photos を叩き、
// 2組の写真URL一覧を渡して類似度スコアをもらうためのサービス。
class AiSimilarityService(
    private val aiApiBase: String,
) {
    private val client = HttpClient(CIO) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
    }

    suspend fun comparePhotos(
        photoUrls: List<String>,
        candidatePhotoUrls: List<String>,
    ): AiSimilarityRawResponse {
        if (photoUrls.isEmpty() || candidatePhotoUrls.isEmpty()) {
            throw IllegalArgumentException("比較する写真URLが不足しています")
        }

        val response =
            try {
                client.post("$aiApiBase/compare-photos") {
                    contentType(ContentType.Application.Json)
                    setBody(AiSimilarityRequest(photoUrls, candidatePhotoUrls))
                }
            } catch (e: Exception) {
                throw AiServiceException("AI類似度判定サーバーに接続できませんでした: ${e.message}")
            }

        if (!response.status.isSuccess()) {
            val bodyText = response.bodyAsText()
            throw AiServiceException("AI類似度判定に失敗しました(status ${response.status}): $bodyText")
        }

        return try {
            response.body<AiSimilarityRawResponse>()
        } catch (e: Exception) {
            throw AiServiceException("AI類似度判定の応答を解析できませんでした: ${e.message}")
        }
    }
}

// ★統合時に削除：AiServiceExceptionは com.services.AiExtractionService.kt に既に定義されているため、
// ここでの重複定義は削除した(同じpackage com.servicesに2つ定義すると「Conflicting declarations」で
// ビルドが通らなくなるため)。このファイルからは AiExtractionService.kt 側の定義をそのまま使う。