package com.models

import kotlinx.serialization.Serializable

@Serializable
data class ChatContact(
    val id: Long,
    val displayName: String,
    val role: String
)

@Serializable
data class ChatContactsResponse(
    val contacts: List<ChatContact>
)

@Serializable
data class ChatMessageRequest(
    val receiverId: Long,
    val message: String
)

@Serializable
data class ChatMessageResponse(
    val id: Long,
    val senderId: Long,
    val receiverId: Long,
    val message: String,
    val createdAt: String
)

@Serializable
data class ChatMessagesResponse(
    val messages: List<ChatMessageResponse>
)
