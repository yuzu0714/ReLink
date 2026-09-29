package com.services

import com.models.AiBatchCompareRequest
import com.models.AiBatchCompareResponse
import com.models.AiBatchCandidateItem
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

// AIサーバー(match_api.py)の POST /compare-photos / POST /batch-compare-photos を叩き、
// 写真URL一覧を渡して類似度スコアをもらうためのサービス。
class AiSimilarityService(
    private val aiApiBase: String,
) {
    private val client = HttpClient(CIO) {
        // タイムアウト設定：
        //   /compare-photos は写真ダウンロード + AI推論で重いため長めに設定。
        //   /batch-compare-photos は候補が多い場合さらに時間がかかるため、
        //   requestTimeoutMillis は余裕を持って設定している。
        install(HttpTimeout) {
            requestTimeoutMillis = 300_000   // バッチで候補が多い場合も対応（5分）
            connectTimeoutMillis = 30_000
            socketTimeoutMillis  = 300_000
        }
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
    }

    // 1件だけ比較する（後方互換用、基本的には batchComparePhotos を使うこと）
    suspend fun comparePhotos(
        photoUrls: List<String>,
        candidatePhotoUrls: List<String>,
    ): AiSimilarityRawResponse {
        if (photoUrls.isEmpty() || candidatePhotoUrls.isEmpty()) {
            throw IllegalArgumentException("比較する写真URLが不足しています")
        }

        val response = try {
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

    // 複数の候補をまとめてAIに並列比較させる（高速化バッチ版）。
    // 候補ごとに comparePhotos() を逐次呼ぶより大幅に速い。
    // Python側の /batch-compare-photos が候補数×AI処理を並列実行して返してくれる。
    suspend fun batchComparePhotos(
        photoUrls: List<String>,
        candidates: List<AiBatchCandidateItem>,
    ): AiBatchCompareResponse {
        if (photoUrls.isEmpty()) {
            throw IllegalArgumentException("迷子ペットの写真URLが指定されていません")
        }
        if (candidates.isEmpty()) {
            return AiBatchCompareResponse(results = emptyList())
        }

        val response = try {
            client.post("$aiApiBase/batch-compare-photos") {
                contentType(ContentType.Application.Json)
                setBody(AiBatchCompareRequest(photoUrls = photoUrls, candidates = candidates))
            }
        } catch (e: Exception) {
            throw AiServiceException("AIバッチ類似度判定サーバーに接続できませんでした: ${e.message}")
        }

        if (!response.status.isSuccess()) {
            val bodyText = response.bodyAsText()
            throw AiServiceException("AIバッチ類似度判定に失敗しました(status ${response.status}): $bodyText")
        }

        return try {
            response.body<AiBatchCompareResponse>()
        } catch (e: Exception) {
            throw AiServiceException("AIバッチ類似度判定の応答を解析できませんでした: ${e.message}")
        }
    }
}

// ★統合時に削除：AiServiceExceptionは com.services.AiExtractionService.kt に既に定義されているため、
// ここでの重複定義は削除した(同じpackage com.servicesに2つ定義すると「Conflicting declarations」で
// ビルドが通らなくなるため)。このファイルからは AiExtractionService.kt 側の定義をそのまま使う。
