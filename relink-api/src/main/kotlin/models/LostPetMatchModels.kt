package com.models

import kotlinx.serialization.Serializable

// 追加: 発見者の写真照合APIで使うリクエスト・候補・レスポンス
@Serializable
data class LostPetMatchRequest(
    val animalType: String? = null,
    val breed: String? = null,
    val coatColor: String? = null,
    val hasCollar: Boolean = false,
    val collarFeatures: String? = null,
)

@Serializable
data class LostPetMatchCandidate(
    val id: Long,
    val photoUrl: String? = null,
    val specie: String? = null,
    val color: String? = null,
    val lostPlace: String? = null,
    val score: Int,
    val reasons: List<String> = emptyList(),
)

@Serializable
data class LostPetMatchResponse(
    val matched: Boolean,
    val candidates: List<LostPetMatchCandidate>,
)
