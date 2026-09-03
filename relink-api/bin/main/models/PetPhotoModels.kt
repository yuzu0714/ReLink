package com.models

import kotlinx.serialization.Serializable

// ★新規追加：pet_photos の1件分を表すDTO（一覧表示・詳細表示で使う想定）
@Serializable
data class PetPhotoItem(
    val photoUrl: String,
    val sortOrder: Int
)