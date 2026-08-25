package com.services

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.*
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// Google Geocoding APIを使って、住所の文字列を緯度経度の数値に変換するサービス
class GeocodingService(
    private val apiKey: String,
) {
    // ★修正：AiSimilarityServiceと同じく、JSONレスポンスを受け取るためContentNegotiationを組み込んだ
    // HttpClientに変更(これが無いとresponse.body<GeocodeResponse>()が使えずコンパイルエラーになる)
    private val client = HttpClient(CIO) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
    }

    suspend fun geocode(address: String): LatLng? {
        if (address.isBlank()) return null

        val response = try {
            client.get("https://maps.googleapis.com/maps/api/geocode/json") {
                parameter("address", address)
                parameter("key", apiKey)
                parameter("language", "ja")
            }
        } catch (e: Exception) {
            return null
        }

        return try {
            val result = response.body<GeocodeResponse>()
            val location = result.results.firstOrNull()?.geometry?.location
            location?.let { LatLng(it.lat, it.lng) }
        } catch (e: Exception) {
            null
        }
    }
}

data class LatLng(val lat: Double, val lng: Double)

@Serializable
private data class GeocodeResponse(
    val results: List<GeocodeResult> = emptyList(),
    val status: String = "",
)

@Serializable
private data class GeocodeResult(
    val geometry: GeocodeGeometry,
)

@Serializable
private data class GeocodeGeometry(
    val location: GeocodeLocation,
)

@Serializable
private data class GeocodeLocation(
    val lat: Double,
    val lng: Double,
)