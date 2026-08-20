package com.models

import kotlinx.serialization.Serializable

// GET /shelter/pets のレスポンス1件分のDTO
// foundpet_register由来かrescuedpet_register由来かをsourceで区別する
// (matchesテーブルのprotected_sourceと同じ考え方)
@Serializable
data class ShelterPetListItem(
    val id: Long,
    val source: String,     // "found" または "rescued"
    val photoUrl: String,
    val place: String,      // found_place に対応
    val date: String,       // found_date に対応(ISO8601形式の文字列。例: "2026-07-07T09:30:00")
    val specie: String,
    val color: String,
    val other: String? = null
)

// GET /shelter/pets 全体のレスポンス
@Serializable
data class ShelterPetListResponse(
    val pets: List<ShelterPetListItem>
)
