package com.repositories

import com.db.LostPetRegisterTable
import com.models.LostPetRegisterRequest
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction

// lostpet_register への書き込みだけを担当するクラス
object LostPetRepository {
    fun insert(request: LostPetRegisterRequest): Long {
        return transaction {
            val insertedId = LostPetRegisterTable.insert {
                // ★修正：photoUrlカラムがDB側でDROP COLUMN済み(pet_photosテーブルへ移管)のため、
                // LostPetRegisterTable側にもう存在しない。この行を削除してエラーを解消
                it[phoneNumber] = request.phoneNumber
                it[specie] = request.specie
                it[color] = request.color
                it[other] = request.other
                it[lostPlace] = request.lostPlace
            } get LostPetRegisterTable.id

            // ★新規追加：FoundPetRepositoryと同じく、本体INSERT成功後のidを使って
            // pet_photosテーブルに複数枚の写真をまとめてINSERTする
            // (これが抜けていたため、写真URLがリクエストで届いてもDBに一切保存されていなかった)
            PetPhotoRepository.insertPhotos(
                petSource = "lost",
                petId = insertedId,
                photoUrls = request.photoUrls
            )

            insertedId
        }
    }

    // ★新規追加(Day3-3)：マッチングループ開始時に、迷子ペット本体の情報(specie/color/lostPlace)を
    // 取得するために追加。MatchingRepository.findCandidates()に渡す検索条件はここから作る
    fun findById(id: Long): LostPetRegisterRow? = transaction {
        LostPetRegisterTable.selectAll()
            .where { LostPetRegisterTable.id eq id }
            .map {
                LostPetRegisterRow(
                    id = it[LostPetRegisterTable.id],
                    specie = it[LostPetRegisterTable.specie],
                    color = it[LostPetRegisterTable.color],
                    lostPlace = it[LostPetRegisterTable.lostPlace]
                )
            }
            .firstOrNull()
    }
}

// ★新規追加：findById()の戻り値専用の内部DTO
data class LostPetRegisterRow(
    val id: Long,
    val specie: String?,
    val color: String?,
    val lostPlace: String?
)