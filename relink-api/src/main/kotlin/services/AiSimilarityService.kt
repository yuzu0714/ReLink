package com.services

import com.models.AiSimilarityRawResponse
import com.models.AiSimilarityRequest
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.HttpTimeout
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
        // ★修正：タイムアウト超過で失敗していたのを修正。
        // /compare-photos は「迷子側・候補側それぞれの写真を全部ダウンロード→base64化→
        // AI(Sakura AI)に複数枚まとめて投げて判定させる」という重い処理のため、
        // Ktorクライアントのデフォルトのタイムアウト(明示指定しない場合、CIOエンジンの
        // デフォルトで15秒程度)だと簡単に超えてしまい、
        // 「Request timeout has expired」で候補がAI比較スキップ扱いになっていた。
        // 写真が複数枚・AIの応答が遅いケースを考慮して長めに設定する。
        install(HttpTimeout) {
            requestTimeoutMillis = 120_000
            connectTimeoutMillis = 30_000
            socketTimeoutMillis = 120_000
        }
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