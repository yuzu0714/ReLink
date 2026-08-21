package com.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// match_api.py (Python側のAI特徴抽出API) の POST /extract-features がそのまま返してくる形。
// Python側はsnake_caseのキー名を使っているので、デコード専用にここで@SerialNameを付ける。
// (このクラスはKotlinサーバー内部でしか使わない。フロントエンドには直接返さない)
@Serializable
data class AiRawFeatures(
    @SerialName("animal_type") val animalType: String? = null,
    @SerialName("breed") val breed: String? = null,
    @SerialName("coat_color") val coatColor: String? = null,
    @SerialName("has_collar") val hasCollar: Boolean = false,
    @SerialName("collar_features") val collarFeatures: String? = null,
)

// フロントエンドに返すレスポンス。他のAPI(photoUrlなど)と同じcamelCase規則に統一する。
@Serializable
data class AiFeatureExtractionResponse(
    val animalType: String? = null,
    val breed: String? = null,
    val coatColor: String? = null,
    val hasCollar: Boolean = false,
    val collarFeatures: String? = null,
)

fun AiRawFeatures.toResponse(): AiFeatureExtractionResponse =
    AiFeatureExtractionResponse(
        animalType = animalType,
        breed = breed,
        coatColor = coatColor,
        hasCollar = hasCollar,
        collarFeatures = collarFeatures,
    )
