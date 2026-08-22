package com.db

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.datetime
import org.jetbrains.exposed.sql.javatime.timestampWithTimeZone
// build.gradle.kts に exposed-java-time:0.55.0 を追加したうえで使う

// rescuedpet_register テーブルへのマッピング定義
// カラム構成はFoundPetRegisterTableと同じ
object RescuedPetRegisterTable : Table("rescuedpet_register") {
    val id = long("id").autoIncrement()
    // ★修正：photoUrlカラムの定義を削除（DB側でDROP COLUMN済み、pet_photosテーブルに移管したため）
    val foundPlace = text("found_place").nullable()
    val foundDate = datetime("found_date").nullable()
    val specie = text("specie").nullable()
    val color = text("color").nullable()
    val other = text("other").nullable()
    // 委任タスク(GET /shelter/pets)で新しい順に並べ替えるために追加。読み取り専用として使う。
    val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey = PrimaryKey(id)
}