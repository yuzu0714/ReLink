package com.repositories

import com.db.LostPetRegisterTable
import com.models.AiRawFeatures
import com.models.LostPetMatchCandidate
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction

object LostPetMatchRepository {
    // 追加: AI特徴と迷子報告の登録情報を比較し、一致度の高い候補を返す
    fun findMatches(features: AiRawFeatures): List<LostPetMatchCandidate> = transaction {
        LostPetRegisterTable.selectAll()
            .mapNotNull { row ->
                val id     = row[LostPetRegisterTable.id]
                val specie = row[LostPetRegisterTable.specie]
                val color  = row[LostPetRegisterTable.color]
                val other  = row[LostPetRegisterTable.other]
                val scoreParts = mutableListOf<Pair<Int, String>>()

                if (containsAny(specie, features.animalType, features.breed)) {
                    scoreParts += 40 to "動物の種類・犬種が一致"
                }
                if (containsAny(color, features.coatColor)) {
                    scoreParts += 30 to "毛色が一致"
                }
                if (features.hasCollar && containsAny(other, features.collarFeatures, "首輪")) {
                    scoreParts += 20 to "首輪の特徴が一致"
                }

                val score = scoreParts.sumOf { it.first }
                if (score < 30) return@mapNotNull null

                // ★修正：photoUrlはlostpet_registerから削除済みのため、
                // pet_photosテーブルから先頭の写真URLを取得する
                val photoUrl = PetPhotoRepository.findByPet("lost", id)
                    .firstOrNull()?.photoUrl

                LostPetMatchCandidate(
                    id        = id,
                    photoUrl  = photoUrl,
                    specie    = specie,
                    color     = color,
                    lostPlace = row[LostPetRegisterTable.lostPlace],
                    score     = score,
                    reasons   = scoreParts.map { it.second },
                )
            }
            .sortedByDescending { it.score }
            .take(10)
    }

    private fun containsAny(value: String?, vararg terms: String?): Boolean {
        val normalizedValue = value?.lowercase()?.replace(" ", "") ?: return false
        return terms.filterNot { it.isNullOrBlank() }
            .any { normalizedValue.contains(it!!.lowercase().replace(" ", "")) }
    }
}
