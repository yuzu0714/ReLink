package com.models

import kotlinx.serialization.Serializable

// POST /handovers に送られてくるリクエストボディの形
// handoverDatetimeは任意項目：nullで送られてきたら「登録した瞬間の時刻」をリポジトリ側で入れる
// (実際に引き渡した"その場"でスマホから登録するケースを想定して、必須にしない設計にした)
@Serializable
data class HandoverRequest(
    val contactId: Long,
    val handoverPlace: String? = null,
    val handoverDatetime: String? = null, // ISO8601形式。例: "2026-08-17T15:04:05"
    val handedOverTo: String? = null,
    val note: String? = null
)

// 登録・一覧取得どちらのレスポンスにも使う共通DTO
@Serializable
data class HandoverResponse(
    val id: Long,
    val contactId: Long,
    val handoverPlace: String?,
    val handoverDatetime: String?,
    val handedOverTo: String?,
    val note: String?,
    val status: String,
    val createdAt: String
)
// POST /handovers/by-pet 用：保護ペットID + 飼い主メールから contact_id を自動解決して登録
@Serializable
data class HandoverByPetRequest(
    val foundPetId: Long,           // 保護ペットID (foundpet_register.id)
    val ownerEmail: String,         // 飼い主のメールアドレス (usersテーブルで照合)
    val handoverPlace: String? = null,
    val handoverDatetime: String? = null,
    val handedOverTo: String? = null,
    val note: String? = null
)
