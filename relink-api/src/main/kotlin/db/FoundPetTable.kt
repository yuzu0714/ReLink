package com.db

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.datetime
import org.jetbrains.exposed.sql.javatime.timestampWithTimeZone

object FoundPetRegisterTable : Table("foundpet_register") {
    val id = long("id").autoIncrement()
    // ★修正：photoUrlカラムの定義を削除
    // (DB側では既にDROP COLUMN済み。pet_photosテーブルへ移管したため。
    //  RescuedPetTable.ktでは既に修正済みだったが、こちらは修正漏れだった)
    val foundPlace = text("found_place").nullable()
    val foundDate = datetime("found_date").nullable()
    val specie = text("specie").nullable()
    val color = text("color").nullable()
    val other = text("other").nullable()
    val createdAt = timestampWithTimeZone("created_at")

    // ★新規追加：Geocoding APIで変換した緯度経度を保存するカラム
    // 変換に失敗した場合も登録自体は継続させるため、nullableにしている
    val latitude = double("latitude").nullable()
    val longitude = double("longitude").nullable()

    override val primaryKey = PrimaryKey(id)
}