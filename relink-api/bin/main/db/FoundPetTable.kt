package com.db

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.datetime
import org.jetbrains.exposed.sql.javatime.timestampWithTimeZone
// build.gradle.kts に exposed-java-time:0.55.0 を追加したうえで使う

// foundpet_register テーブルへのマッピング定義
// LostPetRegisterTable と同じ書き方。found_date は TIMESTAMP 型なので datetime(...) を使う
object FoundPetRegisterTable : Table("foundpet_register") {
    val id = long("id").autoIncrement()
    val photoUrl = text("photo_url").nullable()
    val foundPlace = text("found_place").nullable()
    val foundDate = datetime("found_date").nullable()
    val specie = text("specie").nullable()
    val color = text("color").nullable()
    val other = text("other").nullable()
    // 委任タスク(GET /shelter/pets)で新しい順に並べ替えるために追加。
    // DBの DEFAULT now() に任せているのでINSERT時には触らない(読み取り専用として使う)。
    // created_at は timestamptz 型なので timestampWithTimeZone(...) を使う(datetime(...)だと型が合わない)
    val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey = PrimaryKey(id)
}
