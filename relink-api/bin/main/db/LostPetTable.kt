package com.db

import org.jetbrains.exposed.sql.Table

// lostpet_register テーブルへのマッピング定義
// Exposedはこの定義を通してSQLを組み立てる(生SQLを直接書かずに済む)
object LostPetRegisterTable : Table("lostpet_register") {
    val id = long("id").autoIncrement()
    // ★修正：photoUrlカラムの定義を削除（DB側でDROP COLUMN済み、pet_photosテーブルに移管したため）
    val phoneNumber = text("phone_number").nullable()
    val specie = text("specie").nullable()
    val color = text("color").nullable()
    val other = text("other").nullable()
    val lostPlace = text("lost_place").nullable()
    // created_at は DBの DEFAULT now() に任せたいので、
    // ここでは列を定義せず(INSERT時に触らない)、Kotlin側からは扱わない

    override val primaryKey = PrimaryKey(id)
}