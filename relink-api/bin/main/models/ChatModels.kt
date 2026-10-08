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
    val message: String = "",
    val messageType: String = "text",
    val audioUrl: String? = null
)

@Serializable
data class ChatMessageResponse(
    val id: Long,
    val senderId: Long,
    val receiverId: Long,
    val message: String,
    val messageType: String = "text",
    val audioUrl: String? = null,
    val createdAt: String
)

@Serializable
data class ChatMessagesResponse(
    val messages: List<ChatMessageResponse>
)

@Serializable
data class ChatAudioUploadResponse(
    val audioUrl: String
)

@Serializable
data class ChatMonitorParticipant(
    val id: Long,
    val displayName: String,
    val role: String
)

@Serializable
data class ChatMonitorConversation(
    val userA: ChatMonitorParticipant,
    val userB: ChatMonitorParticipant,
    val lastMessage: String,
    val lastAt: String,
    val messageCount: Int
)

@Serializable
data class ChatMonitorListResponse(val conversations: List<ChatMonitorConversation>)

@Serializable
data class ChatMonitorMessagesResponse(
    val userA: ChatMonitorParticipant,
    val userB: ChatMonitorParticipant,
    val messages: List<ChatMessageResponse>
)
