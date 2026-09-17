package com.repositories

import com.db.FoundPetRegisterTable
import com.models.FoundPetRegisterRequest
import com.geocodingService
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime

object FoundPetRepository {
    suspend fun insert(request: FoundPetRegisterRequest, userId: Long? = null): Long {
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
        // マッチング時に都道府県で絞り込めるようにするため
        val storedPlace = if (!prefecture.isNullOrBlank()) {
            "$prefecture ${request.foundPlace}"
        } else {
            request.foundPlace
        }

        return transaction {
            val insertedId = FoundPetRegisterTable.insert {
                it[foundPlace] = storedPlace
                it[foundDate] = parsedDate
                it[specie] = request.specie
                it[color] = request.color
                it[other] = request.other
                it[latitude] = coordinates?.lat
                it[longitude] = coordinates?.lng
                it[FoundPetRegisterTable.userId] = userId
            } get FoundPetRegisterTable.id

            PetPhotoRepository.insertPhotos(
                petSource = "found",
                petId = insertedId,
                photoUrls = request.photoUrls
            )

            insertedId
        }
    }
}
