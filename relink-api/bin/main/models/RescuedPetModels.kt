package com.models

import kotlinx.serialization.Serializable

// POST /pets/rescued に送られてくるリクエストボディの形
// カラム構成はfoundpet_registerと同じ(photo_url / found_place / found_date / specie / color / other)
@Serializable
data class RescuedPetRegisterRequest(
    // ★修正：photoUrl(単数・String) → photoUrls(複数・List<String>)に変更
    val photoUrls: List<String>,
    val foundPlace: String,    // ← found_place に対応
    val foundDate: String,     // ← found_date に対応(ISO8601形式の文字列。例: "2026-08-17T15:04:05")
    val specie: String,
    val color: String,
    val other: String? = null  // その他情報は任意項目(未入力を許容)
)

// 登録成功時に返すレスポンス
@Serializable
data class RescuedPetRegisterResponse(
    val id: Long,
    val message: String = "保護ペット情報を登録しました"
)