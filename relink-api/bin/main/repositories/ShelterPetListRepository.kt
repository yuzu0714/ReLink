package com.repositories

import com.db.FoundPetRegisterTable
import com.db.RescuedPetRegisterTable
import com.models.ShelterPetListItem
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction

object ShelterPetListRepository {
    fun getAll(): List<ShelterPetListItem> {
        return transaction {
            // ★修正：ここではまだ写真を取りに行かず、photoUrlを仮で空文字("")にしたまま本体データだけを集める
            // (N+1解消のため、写真の取得は全件集め終わった後にまとめて1回だけ行う)
            val foundRows = FoundPetRegisterTable.selectAll().map { row ->
                val item = ShelterPetListItem(
                    id = row[FoundPetRegisterTable.id],
                    source = "found",
                    photoUrl = "", // ★修正：後段でまとめて取得した写真URLに差し替える(ここでは仮値)
                    place = row[FoundPetRegisterTable.foundPlace] ?: "",
                    date = row[FoundPetRegisterTable.foundDate]?.toString() ?: "",
                    specie = row[FoundPetRegisterTable.specie] ?: "",
                    color = row[FoundPetRegisterTable.color] ?: "",
                    other = row[FoundPetRegisterTable.other],
                )
                item to row[FoundPetRegisterTable.createdAt]
            }

            val rescuedRows = RescuedPetRegisterTable.selectAll().map { row ->
                val item = ShelterPetListItem(
                    id = row[RescuedPetRegisterTable.id],
                    source = "rescued",
                    photoUrl = "", // ★修正：同上
                    place = row[RescuedPetRegisterTable.foundPlace] ?: "",
                    date = row[RescuedPetRegisterTable.foundDate]?.toString() ?: "",
                    specie = row[RescuedPetRegisterTable.specie] ?: "",
                    color = row[RescuedPetRegisterTable.color] ?: "",
                    other = row[RescuedPetRegisterTable.other],
                )
                item to row[RescuedPetRegisterTable.createdAt]
            }

            // ★新規追加：foundpet_register・rescuedpet_registerそれぞれのIDだけを先に集めておく
            // (この時点ではまだDBへは1回もアクセスしていない、単なるKotlin側のリスト操作)
            val foundIds = foundRows.map { (item, _) -> item.id }
            val rescuedIds = rescuedRows.map { (item, _) -> item.id }

            // ★新規追加：ここでようやくPetPhotoRepositoryへ問い合わせる。
            // 以前は「件数分」クエリが飛んでいたが、ここではfound用に1回・rescued用に1回、
            // 合計たった2回のクエリで全ペットの代表写真が揃う
            val foundPhotoMap = PetPhotoRepository.findRepresentativePhotos("found", foundIds)
            val rescuedPhotoMap = PetPhotoRepository.findRepresentativePhotos("rescued", rescuedIds)

            // ★修正：仮で空文字にしていたphotoUrlを、さっき取得したMapから引いた実際のURLに差し替える
            // (copy()を使うことで、ShelterPetListItemの他のフィールドはそのまま、photoUrlだけ置き換えられる)
            val foundResolved = foundRows.map { (item, createdAt) ->
                item.copy(photoUrl = foundPhotoMap[item.id] ?: "") to createdAt
            }
            val rescuedResolved = rescuedRows.map { (item, createdAt) ->
                item.copy(photoUrl = rescuedPhotoMap[item.id] ?: "") to createdAt
            }

            // found由来・rescued由来をまとめて、created_atの新しい順(降順)に並べる(ここは元のロジックのまま)
            (foundResolved + rescuedResolved)
                .sortedByDescending { (_, createdAt) -> createdAt }
                .map { (item, _) -> item }
        }
    }
}