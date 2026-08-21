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
                val item = ShelterPetListItem(
                    id = row[FoundPetRegisterTable.id],
                    source = "found",
                    photoUrl = row[FoundPetRegisterTable.photoUrl] ?: "",
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
                val item = ShelterPetListItem(
                    id = row[RescuedPetRegisterTable.id],
                    source = "rescued",
                    photoUrl = row[RescuedPetRegisterTable.photoUrl] ?: "",
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
