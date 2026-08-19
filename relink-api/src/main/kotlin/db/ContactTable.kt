package com.db

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.timestamp

// contactsテーブルの定義（DDLと1対1対応させる）
object ContactTable : Table("contacts") {
    val id = long("id").autoIncrement()
    val matchId = long("match_id") // ※FK制約はDB側(SQL)で貼ってあるのでExposed側では貼らない
    val contactedByPhone = varchar("contacted_by_phone", 20)
    val receptionNumber = varchar("reception_number", 50).uniqueIndex()
    val status = varchar("status", 20).default("pending")
    val note = text("note").nullable()
    val createdAt = timestamp("created_at").clientDefault { java.time.Instant.now() }

    override val primaryKey = PrimaryKey(id)
}

// ★新規追加：match_id存在チェック専用の最小限テーブル定義
// Day3で本格的なMatchesTable/MatchRepositoryを作るまでの「仮の存在確認用」オブジェクト
// idカラムだけ持たせていて、SELECT EXISTSのためだけに使う
object MatchTable : Table("matches") {
    val id = long("id")
    override val primaryKey = PrimaryKey(id)
}