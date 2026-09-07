package com.db

import org.jetbrains.exposed.sql.Column
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.statements.api.PreparedStatementApi
import org.jetbrains.exposed.sql.vendors.currentDialect
import org.jetbrains.exposed.sql.StringColumnType
import org.postgresql.util.PGobject

// PostgreSQLのカスタムenum型を文字列として扱うカラム型
class PgEnumColumnType(private val enumTypeName: String) : StringColumnType() {
    override fun sqlType() = enumTypeName

    override fun notNullValueToDB(value: String): Any =
        PGobject().also { it.type = enumTypeName; it.value = value }

    override fun valueFromDB(value: Any): String = when (value) {
        is PGobject -> value.value ?: ""
        else        -> value.toString()
    }
}

// public.users テーブルへのマッピング定義
object UserTable : Table("users") {
    val id           = long("id").autoIncrement()
    val email        = text("email")
    val passwordHash = text("password_hash")
    val role: Column<String> = registerColumn("role", PgEnumColumnType("user_role"))
    val displayName  = text("display_name").nullable()

    override val primaryKey = PrimaryKey(id)
}
