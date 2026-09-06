package com.repositories

import com.db.FoundPetRegisterTable
import com.db.RescuedPetRegisterTable
import com.models.ShelterPetListItem
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction

object ShelterPetListRepository {
    fun getAll(): List<ShelterPetListItem> {
        return transaction {
            val foundRows = FoundPetRegisterTable.selectAll().map { row ->
                val id = row[FoundPetRegisterTable.id]
                val item = ShelterPetListItem(
                    id = id,
                    source = "found",
                    // ★修正：FoundPetRegisterTable.photoUrl(存在しないカラム)ではなく、
                    // pet_photosテーブルから代表写真(sort_order=0の1枚目)を取得するように変更
                    photoUrl = PetPhotoRepository.findByPet("found", id).firstOrNull()?.photoUrl ?: "",
                    place = row[FoundPetRegisterTable.foundPlace] ?: "",
                    date = row[FoundPetRegisterTable.foundDate]?.toString() ?: "",
                    specie = row[FoundPetRegisterTable.specie] ?: "",
                    color = row[FoundPetRegisterTable.color] ?: "",
                    other = row[FoundPetRegisterTable.other],
                    latitude = row[FoundPetRegisterTable.latitude],
                    longitude = row[FoundPetRegisterTable.longitude],
                )
                item to row[FoundPetRegisterTable.createdAt]
            }

            val rescuedRows = RescuedPetRegisterTable.selectAll().map { row ->
                val id = row[RescuedPetRegisterTable.id]
                val item = ShelterPetListItem(
                    id = id,
                    source = "rescued",
                    // ★修正：同上。pet_photosテーブルから代表写真を取得する
                    photoUrl = PetPhotoRepository.findByPet("rescued", id).firstOrNull()?.photoUrl ?: "",
                    place = row[RescuedPetRegisterTable.foundPlace] ?: "",
                    date = row[RescuedPetRegisterTable.foundDate]?.toString() ?: "",
                    specie = row[RescuedPetRegisterTable.specie] ?: "",
                    color = row[RescuedPetRegisterTable.color] ?: "",
                    other = row[RescuedPetRegisterTable.other],
                    latitude = row[RescuedPetRegisterTable.latitude],
                    longitude = row[RescuedPetRegisterTable.longitude],
                )
                item to row[RescuedPetRegisterTable.createdAt]
            }

            (foundRows + rescuedRows)
                .sortedByDescending { (_, createdAt) -> createdAt }
                .map { (item, _) -> item }
        }
    }
}