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
    // 登録したユーザーのID（usersテーブルの外部キー）
    val userId = long("user_id").references(UserTable.id).nullable()
    val nickname = text("nickname").nullable()
    val petName = text("pet_name").nullable()
    val voiceUrl = text("voice_url").nullable()
    // ★追加：飼い主が「受け取りました」したときに記録する「誰から受け取ったか」
    // DB migration: ALTER TABLE lostpet_register ADD COLUMN received_from TEXT;
    val receivedFrom = text("received_from").nullable()
    // created_at は DBの DEFAULT now() に任せたいので、
    // ここでは列を定義せず(INSERT時に触らない)、Kotlin側からは扱わない

    override val primaryKey = PrimaryKey(id)
}// ★追加：飼い主が「ペットを受け取りました」機能で記録する「誰から受け取ったか」
// DB側では: ALTER TABLE lostpet_register ADD COLUMN received_from TEXT;
