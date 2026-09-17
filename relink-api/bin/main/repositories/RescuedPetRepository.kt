package com.repositories

import com.db.RescuedPetRegisterTable
import com.models.RescuedPetRegisterRequest
import com.geocodingService
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime

// rescuedpet_register への書き込みだけを担当するクラス
object RescuedPetRepository {
    suspend fun insert(request: RescuedPetRegisterRequest, userId: Long? = null): Long {
        val parsedDate = try {
            LocalDateTime.parse(request.foundDate)
        } catch (e: java.time.format.DateTimeParseException) {
            throw IllegalArgumentException("foundDateの形式が不正です。例: 2026-08-17T15:04:05")
        }

        // フォワードジオコーディング：住所 → 緯度経度
        val coordinates = geocodingService.geocode(request.foundPlace)

        // ★新規追加：リバースジオコーディング：緯度経度 → 都道府県名
        val prefecture = if (coordinates != null) {
            geocodingService.reverseGeocode(coordinates.lat, coordinates.lng)
        } else null

        // 都道府県が取得できた場合は先頭に付与して保存
        val storedPlace = if (!prefecture.isNullOrBlank()) {
            "$prefecture ${request.foundPlace}"
        } else {
            request.foundPlace
        }

        return transaction {
            val insertedId = RescuedPetRegisterTable.insert {
                it[foundPlace] = storedPlace
                it[foundDate] = parsedDate
                it[specie] = request.specie
                it[color] = request.color
                it[other] = request.other
                it[latitude] = coordinates?.lat
                it[longitude] = coordinates?.lng
                it[RescuedPetRegisterTable.userId] = userId
            } get RescuedPetRegisterTable.id

            PetPhotoRepository.insertPhotos(
                petSource = "rescued",
                petId = insertedId,
                photoUrls = request.photoUrls
            )

            insertedId
        }
    }
}
