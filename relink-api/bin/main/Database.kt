//DB接続用のファイル
package com

import io.github.cdimascio.dotenv.dotenv
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.transactions.transaction

fun Application.configureDatabases() {
    val dotenv = dotenv()

    Database.connect(
        url = dotenv["DATABASE_URL"],
        user = dotenv["DATABASE_USER"],
        password = dotenv["DATABASE_PASSWORD"]
    )

    transaction {
        exec(
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
                id BIGSERIAL PRIMARY KEY,
                sender_id BIGINT NOT NULL REFERENCES users(id),
                receiver_id BIGINT NOT NULL REFERENCES users(id),
                message TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """.trimIndent()
        )
        exec(
            """
            ALTER TABLE chat_messages
                ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
            """.trimIndent()
        )
        exec(
            """
            ALTER TABLE chat_messages
                ADD COLUMN IF NOT EXISTS audio_url TEXT
            """.trimIndent()
        )
        exec(
            """
            CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
            ON chat_messages (sender_id, receiver_id, created_at)
            """.trimIndent()
        )
    }

    routing {
        get("/db-test") {
            try {
                val result = transaction {
                    exec("SELECT NOW()") { rs ->
                        rs.next()
                        rs.getString(1)
                    }
                }
                call.respondText("DB接続成功!現在時刻: $result")
            } catch (e: Exception) {
                call.respondText("DB接続失敗: ${e.message}")
            }
        }
    }
}
