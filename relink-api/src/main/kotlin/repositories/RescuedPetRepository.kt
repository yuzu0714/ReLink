package com.repositories

import com.db.RescuedPetRegisterTable
import com.models.RescuedPetRegisterRequest
import com.repositories.PetPhotoRepository // ★修正：import漏れを追加(これが無いとUnresolved referenceになる)
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime

// rescuedpet_register への書き込みだけを担当するクラス
object RescuedPetRepository {
    fun insert(request: RescuedPetRegisterRequest): Long {
        val parsedDate = try {
            LocalDateTime.parse(request.foundDate)
        } catch (e: java.time.format.DateTimeParseException) {
            throw IllegalArgumentException("foundDateの形式が不正です。例: 2026-08-17T15:04:05")
        }
        return transaction {
            val insertedId = RescuedPetRegisterTable.insert {
                it[foundPlace] = request.foundPlace
                it[foundDate] = parsedDate
                it[specie] = request.specie
                it[color] = request.color
                it[other] = request.other
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