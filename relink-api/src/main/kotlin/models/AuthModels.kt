package com.models

import kotlinx.serialization.Serializable

// POST /auth/register のリクエスト
@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    val role: String,           // "owner" / "finder" / "shelter"
    val displayName: String? = null
)

// POST /auth/login のリクエスト
@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
    val role: String = "owner"
)

// 登録・ログイン共通のレスポンス
@Serializable
data class AuthResponse(
    val token: String,
    val userId: String,
    val role: String
)
