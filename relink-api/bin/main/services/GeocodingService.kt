package com.services

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.*
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// Google Geocoding APIを使って、住所の文字列を緯度経度の数値に変換するサービス
class GeocodingService(
    private val apiKey: String,
) {
    private val client = HttpClient(CIO) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
    }

    // 住所 → 緯度経度（フォワードジオコーディング）
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

    // 緯度経度 → 都道府県名（リバースジオコーディング）
    // 戻り値例: "東京都", "大阪府", "北海道", "京都府", "愛知県" など
    suspend fun reverseGeocode(lat: Double, lng: Double): String? {
        val response = try {
            client.get("https://maps.googleapis.com/maps/api/geocode/json") {
                parameter("latlng", "$lat,$lng")
                parameter("key", apiKey)
                parameter("language", "ja")
                parameter("result_type", "administrative_area_level_1")
            }
        } catch (e: Exception) {
            return null
        }

        return try {
            val result = response.body<GeocodeResponse>()
            // administrative_area_level_1 コンポーネント（都道府県）のlong_nameを取得
            result.results.firstOrNull()
                ?.addressComponents
                ?.firstOrNull { it.types.contains("administrative_area_level_1") }
                ?.longName
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
    @SerialName("address_components") val addressComponents: List<AddressComponent> = emptyList(),
)

@Serializable
private data class AddressComponent(
    @SerialName("long_name") val longName: String = "",
    @SerialName("short_name") val shortName: String = "",
    val types: List<String> = emptyList(),
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
