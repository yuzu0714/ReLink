package com.db

import org.jetbrains.exposed.sql.Table

// lostpet_register テーブルへのマッピング定義
object LostPetRegisterTable : Table("lostpet_register") {
    val id = long("id").autoIncrement()
    val phoneNumber = text("phone_number").nullable()
    val specie = text("specie").nullable()
    val color = text("color").nullable()
    val other = text("other").nullable()
    // ★変更：住所登録時にリバースジオコーディングで得た都道府県名を先頭に付与して保存する
    // 例: "東京都 渋谷区道玄坂2-1"
    val lostPlace = text("lost_place").nullable()
    // ★新規追加：フォワードジオコーディングで変換した緯度経度を保存するカラム
    // 変換に失敗した場合も登録自体は継続させるため、nullableにしている
    val latitude = double("latitude").nullable()
    val longitude = double("longitude").nullable()
    // 登録したユーザーのID（usersテーブルの外部キー）
    val userId = long("user_id").references(UserTable.id).nullable()

    override val primaryKey = PrimaryKey(id)
}
