package com.db

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.timestampWithTimeZone

object NotificationTable : Table("notifications") {
    val id        = long("id").autoIncrement()
    val userId    = long("user_id").references(UserTable.id)
    val matchId   = long("match_id").references(MatchesTable.id).nullable()
    val message   = text("message")
    val isRead    = bool("is_read").default(false)
    val createdAt = timestampWithTimeZone("created_at")
        .clientDefault { java.time.OffsetDateTime.now() }

    override val primaryKey = PrimaryKey(id)
}
