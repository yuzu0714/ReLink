package com.db

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.timestamp

// ★新規追加：写真専用テーブルの定義
// pet_source（'lost'/'found'/'rescued'の文字列）+ pet_id の組み合わせで、
// どのペット登録レコードに紐づく写真かを表現する（matchesテーブルと同じポリモーフィック設計）
object PetPhotoTable : Table("pet_photos") {
    val id = long("id").autoIncrement()
    val petSource = varchar("pet_source", 20) // 'lost' / 'found' / 'rescued'（DB側はENUM、Kotlin側はStringで受け渡し）
    val petId = long("pet_id")
    val photoUrl = text("photo_url")
    val sortOrder = integer("sort_order").default(0) // 0番目が代表写真（メイン写真）扱い
    val createdAt = timestamp("created_at").clientDefault { java.time.Instant.now() }

    override val primaryKey = PrimaryKey(id)
}