package com.services

import com.models.AiRawFeatures
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.forms.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.serialization.json.Json

// 決定事項:「SupabaseへのデータアクセスはKotlinサーバーに一本化する」と同じ考え方で、
// ブラウザからPython側のAI特徴抽出API(match_api.py)を直接呼ばせるのではなく、
// 必ずこのKotlinサーバーを経由させる(このサービスがサーバー間通信を担当する)。
//
// match_api.py はブランチAI_JSONAPIにあるスクリプトで、事前に
//   uvicorn match_api:app --host 0.0.0.0 --port 8000
// でローカル起動しておく必要がある(このサービスはそこへHTTPで転送するだけ)。
class AiExtractionService(
    private val aiApiBase: String,
) {
    // HTTPクライアントは使い回す(StorageServiceと同じ考え方)
    // ★修正：/compare-photosと同じ理由で、AI解析が長引くケースに備えてタイムアウトを延長
    // (デフォルトのままだと写真の枚数が多いときに「Request timeout has expired」で失敗しうる)
    private val client = HttpClient(CIO) {
        install(HttpTimeout) {
            requestTimeoutMillis = 120_000
            connectTimeoutMillis = 30_000
            socketTimeoutMillis = 120_000
        }
    }
    private val json = Json { ignoreUnknownKeys = true }

    // photos: (ファイル名, バイト列) のリスト。複数枚まとめて送ると、
    // match_api.py側で「同じ1匹を別角度から撮ったもの」として扱ってくれる。
    suspend fun extractFeatures(photos: List<Pair<String, ByteArray>>): AiRawFeatures {
        if (photos.isEmpty()) {
            throw IllegalArgumentException("解析対象の写真が見つかりません")
        }

        val response =
            try {
                client.submitFormWithBinaryData(
                    url = "$aiApiBase/extract-features",
                    formData =
                        formData {
                            photos.forEach { (fileName, bytes) ->
                                append(
                                    "photos",
                                    bytes,
                                    Headers.build {
                                        append(HttpHeaders.ContentDisposition, "filename=\"$fileName\"")
                                    },
                                )
                            }
                        },
                )
            } catch (e: Exception) {
                // AIサーバー(match_api.py)が起動していない場合など、接続自体に失敗するケース
                throw AiServiceException("AI特徴抽出サーバーに接続できませんでした: ${e.message}")
            }

        val bodyText = response.bodyAsText()

        if (!response.status.isSuccess()) {
            throw AiServiceException("AI特徴抽出に失敗しました(status ${response.status}): $bodyText")
        }

        return try {
            json.decodeFromString<AiRawFeatures>(bodyText)
        } catch (e: Exception) {
            throw AiServiceException("AI特徴抽出の応答を解析できませんでした: ${e.message}")
        }
    }
}

// StatusPagesで補足してエラーレスポンス(502 Bad Gateway)に変換するための専用例外
class AiServiceException(message: String) : Exception(message)
