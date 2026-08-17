package com.repositories

import com.db.LostPetRegisterTable
import com.models.LostPetRegisterRequest
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.transactions.transaction

// lostpet_register への書き込みだけを担当するクラス
// StorageServiceと同じ考え方で、「DBへの書き込み処理」を1箇所にまとめている
object LostPetRepository {
    fun insert(request: LostPetRegisterRequest): Long {
        // Database.kt の /db-test と同じ transaction{} ブロックのスタイルに揃えた
        return transaction {
            LostPetRegisterTable.insert {
                it[photoUrl] = request.photoUrl
                it[phoneNumber] = request.phoneNumber
                it[specie] = request.specie
                it[color] = request.color
                it[other] = request.other
                it[lostPlace] = request.lostPlace
            } get LostPetRegisterTable.id   // INSERT直後に採番されたidを取得して返す
        }
    }
}