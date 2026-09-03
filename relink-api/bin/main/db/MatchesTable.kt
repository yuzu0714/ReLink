package com.db

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.timestampWithTimeZone

// matchesテーブルの本格的なマッピング定義
object MatchesTable : Table("matches") {
    val id = long("id").autoIncrement()
    val lostPetId = long("lost_pet_id")
    val protectedSource = text("protected_source")   // "found" or "rescued"

    // ★修正：実際のDB値(pending/contacted/confirmed/rejectedの4種)に合わせてコメント更新
    val protectedPetId = long("protected_pet_id")
    val matchScore = decimal("match_score", 5, 2)     // 0.00〜100.00を想定
    val status = text("status").default("pending")    // pending / contacted / confirmed / rejected
    val createdAt = timestampWithTimeZone("created_at").clientDefault { java.time.OffsetDateTime.now() }

    override val primaryKey = PrimaryKey(id)
}