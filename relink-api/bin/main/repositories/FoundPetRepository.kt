package com.repositories

import com.db.FoundPetRegisterTable
import com.models.FoundPetRegisterRequest
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime

// foundpet_register への書き込みだけを担当するクラス
// LostPetRepository と同じ構造
object FoundPetRepository {
    fun insert(request: FoundPetRegisterRequest): Long {
        return transaction {
            FoundPetRegisterTable.insert {
                it[photoUrl] = request.photoUrl
                it[foundPlace] = request.foundPlace
                it[foundDate] = LocalDateTime.parse(request.foundDate)
                it[specie] = request.specie
                it[color] = request.color
                it[other] = request.other
            } get FoundPetRegisterTable.id   // INSERT直後に採番されたidを取得して返す
        }
    }
}
