package com.repositories

import com.db.LostPetRegisterTable
import com.geocodingService
import com.models.LostPetRegisterRequest
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction

// lostpet_register への書き込みだけを担当するクラス
object LostPetRepository {
    // ★修正：ジオコーディングを呼ぶためsuspend関数に変更
    suspend fun insert(request: LostPetRegisterRequest, userId: Long? = null): Long {
        // フォワードジオコーディング：入力住所 → 緯度経度
        val coordinates = geocodingService.geocode(request.lostPlace)

        // リバースジオコーディング：緯度経度 → 都道府県名
        val prefecture = if (coordinates != null) {
            geocodingService.reverseGeocode(coordinates.lat, coordinates.lng)
        } else null

        // 都道府県が取得できた場合は先頭に付与する（例: "東京都 渋谷区道玄坂2-1"）
        // マッチング時に都道府県で絞り込めるようにするため
        val storedPlace = if (!prefecture.isNullOrBlank()) {
            "$prefecture ${request.lostPlace}"
        } else {
            request.lostPlace
        }

        return transaction {
            val insertedId = LostPetRegisterTable.insert {
                it[phoneNumber] = request.phoneNumber
                it[specie] = request.specie
                it[color] = request.color
                it[other] = request.other
                it[lostPlace] = storedPlace
                // ★新規追加：座標が取得できていれば保存する
                it[latitude] = coordinates?.lat
                it[longitude] = coordinates?.lng
                it[LostPetRegisterTable.userId] = userId
            } get LostPetRegisterTable.id

            PetPhotoRepository.insertPhotos(
                petSource = "lost",
                petId = insertedId,
                photoUrls = request.photoUrls
            )

            insertedId
        }
    }

    // マッチングループ開始時に、迷子ペット本体の情報を取得する
    fun findById(id: Long): LostPetRegisterRow? = transaction {
        LostPetRegisterTable.selectAll()
            .where { LostPetRegisterTable.id eq id }
            .map {
                LostPetRegisterRow(
                    id = it[LostPetRegisterTable.id],
                    specie = it[LostPetRegisterTable.specie],
                    color = it[LostPetRegisterTable.color],
                    lostPlace = it[LostPetRegisterTable.lostPlace],
                    latitude = it[LostPetRegisterTable.latitude],
                    longitude = it[LostPetRegisterTable.longitude],
                    userId = it[LostPetRegisterTable.userId]
                )
            }
            .firstOrNull()
    }
}

// findById()の戻り値専用の内部DTO
data class LostPetRegisterRow(
    val id: Long,
    val specie: String?,
    val color: String?,
    val lostPlace: String?,
    // ★新規追加：距離ベースのマッチングフィルタリングに使用
    val latitude: Double?,
    val longitude: Double?,
    val userId: Long?
)
