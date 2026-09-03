package com.models

import kotlinx.serialization.Serializable

// クライアントから送られてくるリクエストの形
// match_id・電話番号は必須、noteは任意入力
@Serializable
data class ContactRequest(
    val matchId: Long,
    val contactedByPhone: String,
    val note: String? = null
)

// insert成功時にクライアントへ返すレスポンスの形
// receptionNumber（受付番号）がここに乗ることで、フロント側が「RL-xxxx」を表示できる
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