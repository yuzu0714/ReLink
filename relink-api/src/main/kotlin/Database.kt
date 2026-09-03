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