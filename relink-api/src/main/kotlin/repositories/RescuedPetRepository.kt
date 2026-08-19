package com.repositories

import com.db.RescuedPetRegisterTable
import com.models.RescuedPetRegisterRequest
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime

// rescuedpet_register への書き込みだけを担当するクラス
object RescuedPetRepository {
    fun insert(request: RescuedPetRegisterRequest): Long {
        // 修正:発見API(FoundPetRepository)と同じく、日時パース失敗を
        // 400(IllegalArgumentException)に変換する処理を追加
        val parsedDate = try {
            LocalDateTime.parse(request.foundDate)
        } catch (e: java.time.format.DateTimeParseException) {
            throw IllegalArgumentException("foundDateの形式が不正です。例: 2026-08-17T15:04:05")
        }
        return transaction {
            RescuedPetRegisterTable.insert {
                it[photoUrl] = request.photoUrl
                it[foundPlace] = request.foundPlace
                it[foundDate] = LocalDateTime.parse(request.foundDate)
                it[specie] = request.specie
                it[color] = request.color
                it[other] = request.other
            } get RescuedPetRegisterTable.id
        }
    }
}
