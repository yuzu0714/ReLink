package com.repositories

import com.db.RescuedPetRegisterTable
import com.models.RescuedPetRegisterRequest
import com.geocodingService // ★新規追加：Security.ktのトップレベルvalをimport
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime

// rescuedpet_register への書き込みだけを担当するクラス
object RescuedPetRepository {
    // ★修正：ジオコーディングを呼ぶためsuspend関数に変更
    suspend fun insert(request: RescuedPetRegisterRequest): Long {
        val parsedDate = try {
            LocalDateTime.parse(request.foundDate)
        } catch (e: java.time.format.DateTimeParseException) {
            throw IllegalArgumentException("foundDateの形式が不正です。例: 2026-08-17T15:04:05")
        }

        // ★新規追加：DBへの書き込みより前に、住所→座標変換を済ませておく
        val coordinates = geocodingService.geocode(request.foundPlace)

        return transaction {
            val insertedId = RescuedPetRegisterTable.insert {
                it[foundPlace] = request.foundPlace
                it[foundDate] = parsedDate
                it[specie] = request.specie
                it[color] = request.color
                it[other] = request.other
                // ★新規追加：座標が取得できていれば保存する
                it[latitude] = coordinates?.lat
                it[longitude] = coordinates?.lng
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