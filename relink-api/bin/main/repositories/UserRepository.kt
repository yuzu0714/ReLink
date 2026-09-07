package com.repositories

import com.db.UserTable
import com.models.RegisterRequest
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.mindrot.jbcrypt.BCrypt

object UserRepository {

    // 許可するロールの一覧
    private val allowedRoles = setOf("owner", "finder", "shelter")

    // 新規ユーザー登録
    // 成功したらinsertしたユーザーのidを返す。メール重複・不正ロールは例外を投げる
    fun register(request: RegisterRequest): Long = transaction {
        // ロールチェック
        if (request.role !in allowedRoles) {
            throw IllegalArgumentException("roleは owner / finder / shelter のいずれかを指定してください")
        }
        // メール重複チェック
        val exists = UserTable.selectAll()
            .where { UserTable.email eq request.email }
            .count() > 0
        if (exists) {
            throw IllegalArgumentException("このメールアドレスはすでに登録されています")
        }
        // パスワードをbcryptでハッシュ化してINSERT
        val hash = BCrypt.hashpw(request.password, BCrypt.gensalt())
        UserTable.insert {
            it[email]        = request.email
            it[passwordHash] = hash
            it[role]         = request.role
            it[displayName]  = request.displayName
        }[UserTable.id]
    }

    // ログイン検証
    // メール・パスワードが一致したら (userId, role) を返す。失敗はnull
    fun login(email: String, password: String): Pair<String, String>? = transaction {
        val row = UserTable.selectAll()
            .where { UserTable.email eq email }
            .singleOrNull() ?: return@transaction null

        val hash = row[UserTable.passwordHash]
        if (!BCrypt.checkpw(password, hash)) return@transaction null

        val userId = row[UserTable.id].toString()
        val role   = row[UserTable.role]
        Pair(userId, role)
    }
}
