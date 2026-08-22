package com.repositories

import com.db.FoundPetRegisterTable
import com.db.RescuedPetRegisterTable
import com.models.ShelterPetListItem
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction

// foundpet_register と rescuedpet_register の両方から一覧を取得し、
// 1つのリストにまとめて返すだけの読み取り専用リポジトリ(INSERTはしない)。
// matchesテーブル関連の絞り込みは一切行わない(単純なSELECTのみ)。
object ShelterPetListRepository {
    fun getAll(): List<ShelterPetListItem> {
        return transaction {
            // select { } は非推奨のため selectAll() を使う
            val foundRows = FoundPetRegisterTable.selectAll().map { row ->
                val petId = row[FoundPetRegisterTable.id]
                // ★修正：photoUrlカラムはpet_photosテーブルに移管されたため削除。
                // 代わりにPetPhotoRepositoryから代表写真(sort_order=0の1枚)だけを取得する
                // (一覧画面はサムネイル的に1枚見えれば十分という判断のため)
                val representativePhotoUrl = PetPhotoRepository.findByPet("found", petId)
                    .firstOrNull { it.sortOrder == 0 }
                    ?.photoUrl ?: ""

                val item = ShelterPetListItem(
                    id = petId,
                    source = "found",
                    photoUrl = representativePhotoUrl,
                    place = row[FoundPetRegisterTable.foundPlace] ?: "",
                    date = row[FoundPetRegisterTable.foundDate]?.toString() ?: "",
                    specie = row[FoundPetRegisterTable.specie] ?: "",
                    color = row[FoundPetRegisterTable.color] ?: "",
                    other = row[FoundPetRegisterTable.other],
                )
                // レスポンスDTOにはcreated_atを含めないが、並び替えに使うので一旦ペアで持っておく
                item to row[FoundPetRegisterTable.createdAt]
            }

            val rescuedRows = RescuedPetRegisterTable.selectAll().map { row ->
                val petId = row[RescuedPetRegisterTable.id]
                // ★修正：同上（rescued側）
                val representativePhotoUrl = PetPhotoRepository.findByPet("rescued", petId)
                    .firstOrNull { it.sortOrder == 0 }
                    ?.photoUrl ?: ""

                val item = ShelterPetListItem(
                    id = petId,
                    source = "rescued",
                    photoUrl = representativePhotoUrl,
                    place = row[RescuedPetRegisterTable.foundPlace] ?: "",
                    date = row[RescuedPetRegisterTable.foundDate]?.toString() ?: "",
                    specie = row[RescuedPetRegisterTable.specie] ?: "",
                    color = row[RescuedPetRegisterTable.color] ?: "",
                    other = row[RescuedPetRegisterTable.other],
                )
                item to row[RescuedPetRegisterTable.createdAt]
            }

            // found由来・rescued由来をまとめて、created_atの新しい順(降順)に並べる
            (foundRows + rescuedRows)
                .sortedByDescending { (_, createdAt) -> createdAt }
                .map { (item, _) -> item }
        }
    }
}