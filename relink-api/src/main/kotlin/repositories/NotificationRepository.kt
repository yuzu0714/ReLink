package com.repositories

import com.db.NotificationTable
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.format.DateTimeFormatter

@Serializable
data class NotificationRow(
    val id        : Long,
    val matchId   : Long?,
    val message   : String,
    val isRead    : Boolean,
    val createdAt : String   // ISO-8601文字列として返す
)

object NotificationRepository {

    // 通知を1件保存する
    fun insert(userId: Long, matchId: Long?, message: String): Long = transaction {
        NotificationTable.insert {
            it[NotificationTable.userId]  = userId
            it[NotificationTable.matchId] = matchId
            it[NotificationTable.message] = message
        }[NotificationTable.id]
    }

    // ユーザーの通知一覧を新しい順で返す
    fun findByUser(userId: Long): List<NotificationRow> = transaction {
        NotificationTable
            .selectAll()
            .where { NotificationTable.userId eq userId }
            .orderBy(NotificationTable.createdAt, SortOrder.DESC)
            .map {
                NotificationRow(
                    id        = it[NotificationTable.id],
                    matchId   = it[NotificationTable.matchId],
                    message   = it[NotificationTable.message],
                    isRead    = it[NotificationTable.isRead],
                    createdAt = it[NotificationTable.createdAt]
                        .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
                )
            }
    }

    // 既読にする
    fun markAsRead(notificationId: Long): Unit = transaction {
        NotificationTable.update(
            where = { NotificationTable.id eq notificationId }
        ) {
            it[isRead] = true
        }
    }
}
