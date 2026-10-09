package com.db

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.timestampWithTimeZone

object ChatMessageTable : Table("chat_messages") {
    val id = long("id").autoIncrement()
    val senderId = long("sender_id").references(UserTable.id)
    val receiverId = long("receiver_id").references(UserTable.id)
    val message = text("message")
    val messageType = text("message_type").default("text")
    val audioUrl = text("audio_url").nullable()
    val createdAt = timestampWithTimeZone("created_at")
        .clientDefault { java.time.OffsetDateTime.now() }

    override val primaryKey = PrimaryKey(id)
}
