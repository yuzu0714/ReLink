package com.db

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.datetime
// build.gradle.kts に exposed-java-time:0.55.0 を追加したうえで使う

// foundpet_register テーブルへのマッピング定義
// LostPetRegisterTable と同じ書き方。found_date は TIMESTAMP 型なので datetime(...) を使う
object FoundPetRegisterTable : Table("foundpet_register") {
    val id = long("id").autoIncrement()
    // ★修正：photoUrlカラムの定義を削除（DB側でDROP COLUMN済み、pet_photosテーブルに移管したため）
    val foundPlace = text("found_place").nullable()
    val foundDate = datetime("found_date").nullable()
    val specie = text("specie").nullable()
    val color = text("color").nullable()
    val other = text("other").nullable()
    // created_at は DBの DEFAULT now() に任せたいので、
    // ここでは列を定義せず(INSERT時に触らない)、Kotlin側からは扱わない

    override val primaryKey = PrimaryKey(id)
}