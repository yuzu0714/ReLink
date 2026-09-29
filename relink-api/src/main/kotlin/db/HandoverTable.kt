package com.db

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.datetime
import org.jetbrains.exposed.sql.javatime.timestampWithTimeZone

// handoversテーブルへのマッピング定義
// ContactTable.ktと同じ方針：FK制約はDB側(SQL)で貼ってあるのでExposed側では貼らない
object HandoverTable : Table("handovers") {
    val id = long("id").autoIncrement()
    val contactId = long("contact_id")
    val handoverPlace = text("handover_place").nullable()
    // found_date等と同じくTIMESTAMP型なのでdatetime(...)を使う(timestampWithTimeZoneだと型不一致になる)
    val handoverDatetime = datetime("handover_datetime").nullable()
    val handedOverTo = text("handed_over_to").nullable()
    val note = text("note").nullable()
    val status = varchar("status", 20).default("completed")
    // created_atはtimestamptz型なのでtimestampWithTimeZone(...)を使う(ContactTableのcreatedAtとは型が違う点に注意！
    // ContactTable.ktはtimestamp型で作られてるけど、ここは新規テーブルなのでMatchesTableと同じtimestamptzで統一したよ)
    val createdAt = timestampWithTimeZone("created_at").clientDefault { java.time.OffsetDateTime.now() }

    override val primaryKey = PrimaryKey(id)
}