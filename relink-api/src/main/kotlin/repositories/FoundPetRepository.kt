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
        // 日時のパース失敗を「クライアント側の入力ミス」として
        // 400(IllegalArgumentException)に変換する
        val parsedDate = try {
            LocalDateTime.parse(request.foundDate)
        } catch (e: java.time.format.DateTimeParseException) {
            throw IllegalArgumentException("foundDateの形式が不正です。例: 2026-08-17T15:04:05")
        }
        return transaction {
            val insertedId = FoundPetRegisterTable.insert {
                // ★修正：photoUrlカラムへの代入を削除（pet_photosテーブルに移管したため）
                it[foundPlace] = request.foundPlace
                it[foundDate] = parsedDate
                it[specie] = request.specie
                it[color] = request.color
                it[other] = request.other
            } get FoundPetRegisterTable.id   // INSERT直後に採番されたidを取得して返す

            // ★新規追加：本体のINSERTに成功したidを使って、pet_photosテーブルに
            // 複数枚の写真をまとめてINSERTする
            PetPhotoRepository.insertPhotos(
                petSource = "found",
                petId = insertedId,
                photoUrls = request.photoUrls
            )

            insertedId
        }
    }
}