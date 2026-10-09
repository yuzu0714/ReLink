package com.repositories

import com.db.ChatMessageTable
import com.db.UserTable
import com.models.ChatContact
import com.models.ChatMessageResponse
import com.models.ChatMonitorConversation
import com.models.ChatMonitorMessagesResponse
import com.models.ChatMonitorParticipant
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.format.DateTimeFormatter

object ChatRepository {
    private val isoFormatter = DateTimeFormatter.ISO_OFFSET_DATE_TIME

    fun findContacts(currentUserId: Long, currentRole: String): List<ChatContact> = transaction {
        UserTable
            .selectAll()
            .where {
                (UserTable.id neq currentUserId) and
                    when (currentRole) {
                        "shelter" -> UserTable.role eq "finder"
                        "finder" -> (UserTable.role eq "owner") or (UserTable.role eq "shelter")
                        "owner" -> (UserTable.role eq "finder") or (UserTable.role eq "shelter")
                        else -> Op.FALSE
                    }
            }
            .orderBy(UserTable.displayName to SortOrder.ASC, UserTable.id to SortOrder.ASC)
            .map { row ->
                ChatContact(
                    id = row[UserTable.id],
                    displayName = row[UserTable.displayName] ?: roleLabel(row[UserTable.role]),
                    role = row[UserTable.role]
                )
            }
    }

    fun findConversation(currentUserId: Long, otherUserId: Long): List<ChatMessageResponse> = transaction {
        ChatMessageTable
            .selectAll()
            .where {
                ((ChatMessageTable.senderId eq currentUserId) and
                    (ChatMessageTable.receiverId eq otherUserId)) or
                    ((ChatMessageTable.senderId eq otherUserId) and
                        (ChatMessageTable.receiverId eq currentUserId))
            }
            .orderBy(ChatMessageTable.createdAt to SortOrder.ASC)
            .map(::toResponse)
    }

    fun insertMessage(
        senderId: Long,
        receiverId: Long,
        message: String,
        messageType: String = "text",
        audioUrl: String? = null
    ): ChatMessageResponse = transaction {
        val id = ChatMessageTable.insert {
            it[ChatMessageTable.senderId] = senderId
            it[ChatMessageTable.receiverId] = receiverId
            it[ChatMessageTable.message] = message
            it[ChatMessageTable.messageType] = messageType
            it[ChatMessageTable.audioUrl] = audioUrl
        }[ChatMessageTable.id]

        ChatMessageTable
            .selectAll()
            .where { ChatMessageTable.id eq id }
            .single()
            .let(::toResponse)
    }

    fun canChat(currentRole: String, otherUserId: Long): Boolean = transaction {
        val allowedRoles = when (currentRole) {
            "shelter" -> setOf("finder")
            "finder" -> setOf("owner", "shelter")
            "owner" -> setOf("finder", "shelter")
            else -> emptySet()
        }

        UserTable
            .selectAll()
            .where { UserTable.id eq otherUserId }
            .map { it[UserTable.role] }
            .any { it in allowedRoles }
    }

    /** Conversations between owners and finders only; shelter conversations are never exposed here. */
    fun findMonitorConversations(): List<ChatMonitorConversation> = transaction {
        val participants = UserTable.selectAll()
            .where { (UserTable.role eq "owner") or (UserTable.role eq "finder") }
            .associate { row ->
                val role = row[UserTable.role]
                row[UserTable.id] to ChatMonitorParticipant(
                    id = row[UserTable.id],
                    displayName = row[UserTable.displayName] ?: roleLabel(role),
                    role = role
                )
            }
        if (participants.size < 2) return@transaction emptyList()

        ChatMessageTable.selectAll()
            .where {
                (ChatMessageTable.senderId inList participants.keys.toList()) and
                    (ChatMessageTable.receiverId inList participants.keys.toList())
            }
            .orderBy(ChatMessageTable.createdAt to SortOrder.ASC, ChatMessageTable.id to SortOrder.ASC)
            .toList()
            .groupBy { row ->
                val sender = row[ChatMessageTable.senderId]
                val receiver = row[ChatMessageTable.receiverId]
                minOf(sender, receiver) to maxOf(sender, receiver)
            }
            .entries
            .sortedByDescending { (_, rows) -> rows.last()[ChatMessageTable.createdAt] }
            .mapNotNull { (ids, rows) ->
                val a = participants[ids.first] ?: return@mapNotNull null
                val b = participants[ids.second] ?: return@mapNotNull null
                val last = rows.last()
                ChatMonitorConversation(
                    userA = a,
                    userB = b,
                    lastMessage = if (last[ChatMessageTable.messageType] == "audio") "音声メッセージ" else last[ChatMessageTable.message],
                    lastAt = last[ChatMessageTable.createdAt].format(isoFormatter),
                    messageCount = rows.size
                )
            }
    }

    fun findMonitorMessages(userA: Long, userB: Long): ChatMonitorMessagesResponse? = transaction {
        if (userA == userB) return@transaction null
        val a = findMonitorParticipant(userA) ?: return@transaction null
        val b = findMonitorParticipant(userB) ?: return@transaction null
        ChatMonitorMessagesResponse(userA = a, userB = b, messages = findConversation(userA, userB))
    }

    private fun findMonitorParticipant(userId: Long): ChatMonitorParticipant? =
        UserTable.selectAll()
            .where {
                (UserTable.id eq userId) and
                    ((UserTable.role eq "owner") or (UserTable.role eq "finder"))
            }
            .firstOrNull()
            ?.let { row ->
                val role = row[UserTable.role]
                ChatMonitorParticipant(
                    id = row[UserTable.id],
                    displayName = row[UserTable.displayName] ?: roleLabel(role),
                    role = role
                )
            }

    private fun toResponse(row: ResultRow) = ChatMessageResponse(
        id = row[ChatMessageTable.id],
        senderId = row[ChatMessageTable.senderId],
        receiverId = row[ChatMessageTable.receiverId],
        message = row[ChatMessageTable.message],
        messageType = row[ChatMessageTable.messageType],
        audioUrl = row[ChatMessageTable.audioUrl],
        createdAt = row[ChatMessageTable.createdAt].format(isoFormatter)
    )

    private fun roleLabel(role: String): String = when (role) {
        "owner" -> "飼い主"
        "finder" -> "発見者"
        "shelter" -> "保護団体"
        else -> "ReLINKユーザー"
    }
}
