package com.models

import kotlinx.serialization.Serializable

// POST /pets/found に送られてくるリクエストボディの形
// DBのカラム名(snake_case)をKotlinの命名規則(camelCase)に合わせて変換している
@Serializable
data class FoundPetRegisterRequest(
    val photoUrl: String,      // ← photo_url に対応
    val foundPlace: String,    // ← found_place に対応
    val foundDate: String,     // ← found_date に対応(ISO8601形式の文字列。例: "2026-08-17T15:04:05")
    val specie: String,
    val color: String,
    val other: String? = null  // その他情報は任意項目(未入力を許容)
)

// 登録成功時に返すレスポンス
@Serializable
data class FoundPetRegisterResponse(
    val id: Long,
    val message: String = "発見ペット情報を登録しました"
)
