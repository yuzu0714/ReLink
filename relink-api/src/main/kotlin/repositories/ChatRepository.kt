package com.repositories

import com.db.ChatMessageTable
import com.db.UserTable
import com.models.ChatContact
import com.models.ChatMessageResponse
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
                        "finder" -> UserTable.role eq "shelter"
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

    fun insertMessage(senderId: Long, receiverId: Long, message: String): ChatMessageResponse = transaction {
        val id = ChatMessageTable.insert {
            it[ChatMessageTable.senderId] = senderId
            it[ChatMessageTable.receiverId] = receiverId
            it[ChatMessageTable.message] = message
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
            "finder" -> setOf("shelter")
            "owner" -> setOf("finder", "shelter")
            else -> emptySet()
        }

        UserTable
            .selectAll()
            .where { UserTable.id eq otherUserId }
            .map { it[UserTable.role] }
            .any { it in allowedRoles }
    }

    private fun toResponse(row: ResultRow) = ChatMessageResponse(
        id = row[ChatMessageTable.id],
        senderId = row[ChatMessageTable.senderId],
        receiverId = row[ChatMessageTable.receiverId],
        message = row[ChatMessageTable.message],
        createdAt = row[ChatMessageTable.createdAt].format(isoFormatter)
    )

    private fun roleLabel(role: String): String = when (role) {
        "owner" -> "飼い主"
        "finder" -> "発見者"
        "shelter" -> "保護団体"
        else -> "ReLINKユーザー"
    }
}
