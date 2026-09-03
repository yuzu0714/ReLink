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

// ★修正(Day3-3)：仮の存在確認用MatchTableを削除しました
// 理由：本物のMatchesTable(db/MatchesTable.kt)ができたため、
//       同じ"matches"テーブルに対して2つのExposed定義が存在する状態を避けるため統合