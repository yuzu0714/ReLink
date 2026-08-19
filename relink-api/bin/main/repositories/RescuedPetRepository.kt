package com.repositories

import com.db.RescuedPetRegisterTable
import com.models.RescuedPetRegisterRequest
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime

// rescuedpet_register への書き込みだけを担当するクラス
object RescuedPetRepository {
    fun insert(request: RescuedPetRegisterRequest): Long {
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
