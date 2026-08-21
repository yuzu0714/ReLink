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
            val insertedId = LostPetRegisterTable.insert {
                // ★修正：photoUrlカラムへの代入を削除（pet_photosテーブルに移管したため）
                it[phoneNumber] = request.phoneNumber
                it[specie] = request.specie
                it[color] = request.color
                it[other] = request.other
                it[lostPlace] = request.lostPlace
            } get LostPetRegisterTable.id   // INSERT直後に採番されたidを取得して返す

            // ★新規追加：本体のINSERTに成功したidを使って、pet_photosテーブルに
            // 複数枚の写真をまとめてINSERTする。同じtransactionブロック内で行うことで、
            // 「本体は登録できたが写真は失敗した」という中途半端な状態を防いでいる
            PetPhotoRepository.insertPhotos(
                petSource = "lost",
                petId = insertedId,
                photoUrls = request.photoUrls
            )

            insertedId
        }
    }
}