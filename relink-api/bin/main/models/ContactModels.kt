package com.models

import kotlinx.serialization.Serializable

// クライアントから送られてくるリクエストの形
@Serializable
data class ContactRequest(
    val matchId: Long,
    val contactedByPhone: String,
    val note: String? = null
)

// insert成功時にクライアントへ返すレスポンスの形
@Serializable
data class ContactResponse(
    val id: Long,
    val matchId: Long,
    val contactedByPhone: String,
    val receptionNumber: String,
    val status: String,
    val note: String?,
    val createdAt: String
)

// ★新規追加：PATCH /contacts/{id}/status に送られてくるリクエストボディの形
// statusの値は "pending" / "contacted" / "confirmed" / "rejected" の4種類のみを許可する
// (matchesテーブルのstatusと同じCHECK制約の値に合わせている)
@Serializable
data class ContactStatusUpdateRequest(
    val status: String
)