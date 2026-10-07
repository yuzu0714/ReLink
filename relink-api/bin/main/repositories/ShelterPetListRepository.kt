package com.repositories

import com.db.FoundPetRegisterTable
import com.db.MatchesTable
import com.db.RescuedPetRegisterTable
import com.models.ShelterPetListItem
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import com.db.ContactTable   // ★追加：照合に対する連絡の有無を見るため
import com.db.HandoverTable  // ★追加：引き渡し完了かどうかを見るため

object ShelterPetListRepository {

    // ① 写真・照合なしの軽量内部DTO
    private data class PetRow(
        val id: Long,
        val source: String,
        val place: String,
        val date: String,
        val specie: String,
        val color: String,
        val other: String?,
        val latitude: Double?,
        val longitude: Double?,
        val createdAt: OffsetDateTime
    )

    /**
     * ページネーション対応の保護ペット一覧取得。
     * N+1クエリを解消し、ページ分だけ写真・照合情報を取得する。
     *
     * @param limit  1ページあたりの件数
     * @param offset スキップ件数（page * limit）
     * @return Pair<ページ分アイテム一覧, 次ページが存在するか>
     */
    fun getAllPaged(limit: Int, offset: Int): Pair<List<ShelterPetListItem>, Boolean> = transaction {

        // ── ① 基本情報を全件取得（写真・照合なし → 高速） ──
        val foundRows = FoundPetRegisterTable.selectAll().map { row ->
            PetRow(
                id        = row[FoundPetRegisterTable.id],
                source    = "found",
                place     = row[FoundPetRegisterTable.foundPlace] ?: "",
                date      = row[FoundPetRegisterTable.foundDate]?.toString() ?: "",
                specie    = row[FoundPetRegisterTable.specie] ?: "",
                color     = row[FoundPetRegisterTable.color] ?: "",
                other     = row[FoundPetRegisterTable.other],
                latitude  = row[FoundPetRegisterTable.latitude],
                longitude = row[FoundPetRegisterTable.longitude],
                createdAt = row[FoundPetRegisterTable.createdAt]
            )
        }

        val rescuedRows = RescuedPetRegisterTable.selectAll().map { row ->
            PetRow(
                id        = row[RescuedPetRegisterTable.id],
                source    = "rescued",
                place     = row[RescuedPetRegisterTable.foundPlace] ?: "",
                date      = row[RescuedPetRegisterTable.foundDate]?.toString() ?: "",
                specie    = row[RescuedPetRegisterTable.specie] ?: "",
                color     = row[RescuedPetRegisterTable.color] ?: "",
                other     = row[RescuedPetRegisterTable.other],
                latitude  = row[RescuedPetRegisterTable.latitude],
                longitude = row[RescuedPetRegisterTable.longitude],
                createdAt = row[RescuedPetRegisterTable.createdAt]
            )
        }

        // ── ② マージして新着順ソート ──
        val allSorted = (foundRows + rescuedRows).sortedByDescending { it.createdAt }

        // ── ③ ページネーション ──
        val page = allSorted.drop(offset).take(limit + 1)
        val hasMore = page.size > limit
        val pageItems = if (hasMore) page.dropLast(1) else page

        if (pageItems.isEmpty()) return@transaction Pair(emptyList<ShelterPetListItem>(), false)

        // ── ④ 写真をバッチ取得（このページ分のみ・N+1解消） ──
        val foundIds   = pageItems.filter { it.source == "found"   }.map { it.id }
        val rescuedIds = pageItems.filter { it.source == "rescued" }.map { it.id }

        val foundPhotos   = if (foundIds.isNotEmpty())
            PetPhotoRepository.findFirstPhotoByPets("found",   foundIds)   else emptyMap()
        val rescuedPhotos = if (rescuedIds.isNotEmpty())
            PetPhotoRepository.findFirstPhotoByPets("rescued", rescuedIds) else emptyMap()

        // ── ⑤ 照合情報をバッチ取得（このページ分のみ・N+1解消） ──
        // ★修正：これまでは「最新の1件」だけ残していたが、状態判定には全件が必要なので
        //        まず全件をグループ化して持ち、最新の1件は後でそこから取り出す
        val foundMatchGroups: Map<Long, List<ResultRow>> = if (foundIds.isNotEmpty()) {
            MatchesTable.selectAll()
                .where {
                    (MatchesTable.protectedSource eq "found") and
                    (MatchesTable.protectedPetId inList foundIds)
                }
                .orderBy(MatchesTable.createdAt to SortOrder.DESC)
                .groupBy { it[MatchesTable.protectedPetId] }
        } else emptyMap()

        val rescuedMatchGroups: Map<Long, List<ResultRow>> = if (rescuedIds.isNotEmpty()) {
            MatchesTable.selectAll()
                .where {
                    (MatchesTable.protectedSource eq "rescued") and
                    (MatchesTable.protectedPetId inList rescuedIds)
                }
                .orderBy(MatchesTable.createdAt to SortOrder.DESC)
                .groupBy { it[MatchesTable.protectedPetId] }
        } else emptyMap()

        // 画面遷移用の「最新の1件」(今までと同じ動き)
        val foundMatches = foundMatchGroups.mapValues { (_, rows) -> rows.first() }
        val rescuedMatches = rescuedMatchGroups.mapValues { (_, rows) -> rows.first() }

        // ★追加：引き渡しが「完了」したマッチIDの集合を作る
        // matches → contacts(match_id) → handovers(contact_id, status=completed) の順にたどる
        val allMatchIds = (foundMatchGroups.values + rescuedMatchGroups.values)
            .flatten()
            .map { it[MatchesTable.id] }

        val completedMatchIds: Set<Long> = if (allMatchIds.isEmpty()) {
            emptySet()
        } else {
            // 連絡ID → マッチID の対応表(このページ分のマッチに紐づく連絡だけ)
            val contactToMatch = ContactTable.selectAll()
                .where { ContactTable.matchId inList allMatchIds }
                .associate { it[ContactTable.id] to it[ContactTable.matchId] }

            if (contactToMatch.isEmpty()) {
                emptySet()
            } else {
                // 引き渡し完了の記録がある連絡 → そのマッチID を集める
                HandoverTable.selectAll()
                    .where {
                        (HandoverTable.contactId inList contactToMatch.keys.toList()) and
                        (HandoverTable.status eq "completed")
                    }
                    .mapNotNull { contactToMatch[it[HandoverTable.contactId]] }
                    .toSet()
            }
        }

        // ── ⑥ 最終アイテムを組み立て ──
        val finalItems = pageItems.map { row ->
            val photoUrl = if (row.source == "found") foundPhotos[row.id]   ?: ""
                           else                       rescuedPhotos[row.id] ?: ""
            val matchRow = if (row.source == "found") foundMatches[row.id]
                           else                       rescuedMatches[row.id]

            // ★追加：このペットの全マッチから状態を判定する(上から順に評価。進んだ状態を優先)
            val myMatches = (if (row.source == "found") foundMatchGroups[row.id]
                             else                       rescuedMatchGroups[row.id]).orEmpty()
            val status = when {
                myMatches.any { it[MatchesTable.id] in completedMatchIds } -> "completed" // 引き渡し完了
                myMatches.isNotEmpty() -> "matched"                                        // 照合済み
                else -> "new"                                                              // まだ照合されていない
            }

            ShelterPetListItem(
                id        = row.id,
                matchId   = matchRow?.get(MatchesTable.id),
                lostPetId = matchRow?.get(MatchesTable.lostPetId),
                source    = row.source,
                photoUrl  = photoUrl,
                place     = row.place,
                date      = row.date,
                specie    = row.specie,
                color     = row.color,
                other     = row.other,
                latitude  = row.latitude,
                longitude = row.longitude,
                status    = status // ★追加：判定した状態コードを返す
            )
        }

        Pair(finalItems, hasMore)
    }

    /** 後方互換のため残す */
    fun getAll(): List<ShelterPetListItem> = getAllPaged(Int.MAX_VALUE, 0).first
}
