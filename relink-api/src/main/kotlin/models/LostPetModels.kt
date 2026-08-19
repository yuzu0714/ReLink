package com.models

import kotlinx.serialization.Serializable

// POST /pets/lost に送られてくるリクエストボディの形
// DBのカラム名(snake_case)をKotlinの命名規則(camelCase)に合わせて変換している
@Serializable
data class LostPetRegisterRequest(
    val photoUrl: String,       // ← photo_url に対応
    val phoneNumber: String,    // ← phone_number に対応
    val specie: String,
    val color: String,
    val other: String? = null,  // その他情報は任意項目(未入力を許容)
    val lostPlace: String       // ← lost_place に対応
)

// 登録成功時に返すレスポンス
@Serializable
data class LostPetRegisterResponse(
    val id: Long,
    val message: String = "迷子ペット情報を登録しました"
)