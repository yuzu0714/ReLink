package com.repositories

import com.db.FoundPetRegisterTable
import com.db.RescuedPetRegisterTable
import kotlinx.serialization.Serializable // ★新規追加：@Serializableを使うために必要
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction

// ★修正：@Serializableアノテーションを追加
// Ktorがこのクラスをレスポンスとして返す際、JSONに変換(シリアライズ)するために必須。
// これが無いと「Serializer for class 'MatchCandidateRow' is not found」エラーになる
// （候補が0件の場合は変換対象が無いためエラーが起きず、200になっていた）
@Serializable
data class MatchCandidateRow(
    val source: String,      // "found" or "rescued"（どちらのテーブル由来かを区別）
    val id: Long,
    val specie: String?,
    val color: String?,
    val foundPlace: String?,
    val other: String?
)

object MatchingRepository {

    private fun SqlExpressionBuilder.buildCondition(
        specie: String?,
        color: String?,
        lostPlace: String?,
        specieCol: Column<String?>,
        colorCol: Column<String?>,
        placeCol: Column<String?>
    ): Op<Boolean> {
        var condition: Op<Boolean> = Op.TRUE

        // ★修正：完全一致(eq)から部分一致(like)に変更。
        // 「犬」と「小型犬」、「猫」と「三毛猫」なども候補に含まれるようにする。
        if (!specie.isNullOrBlank()) {
            condition = condition and (specieCol like "%$specie%")
        }

        if (!color.isNullOrBlank()) {
            condition = condition and (colorCol like "%$color%")
        }

        // ★修正：lostPlaceが「徳島県 阿南市」形式の場合、市区町村部分だけ抽出してLIKE検索。
        // スペースで分割して最後のトークンを使う（「阿南市」単体でも「徳島県 阿南市」でも動く）。
        if (!lostPlace.isNullOrBlank()) {
            val cityPart = lostPlace.trim().split(" ").last()
            condition = condition and (placeCol like "%$cityPart%")
        }

        return condition
    }

    fun findCandidates(
        specie: String?,
        color: String?,
        lostPlace: String?
    ): List<MatchCandidateRow> = transaction {

        val foundResults = FoundPetRegisterTable
            .selectAll()
            .where {
                buildCondition(
                    specie, color, lostPlace,
                    FoundPetRegisterTable.specie,
                    FoundPetRegisterTable.color,
                    FoundPetRegisterTable.foundPlace
                )
            }
            .map {
                MatchCandidateRow(
                    source = "found",
                    id = it[FoundPetRegisterTable.id],
                    specie = it[FoundPetRegisterTable.specie],
                    color = it[FoundPetRegisterTable.color],
                    foundPlace = it[FoundPetRegisterTable.foundPlace],
                    other = it[FoundPetRegisterTable.other]
                )
            }

        val rescuedResults = RescuedPetRegisterTable
            .selectAll()
            .where {
                buildCondition(
                    specie, color, lostPlace,
                    RescuedPetRegisterTable.specie,
                    RescuedPetRegisterTable.color,
                    RescuedPetRegisterTable.foundPlace
                )
            }
            .map {
                MatchCandidateRow(
                    source = "rescued",
                    id = it[RescuedPetRegisterTable.id],
                    specie = it[RescuedPetRegisterTable.specie],
                    color = it[RescuedPetRegisterTable.color],
                    foundPlace = it[RescuedPetRegisterTable.foundPlace],
                    other = it[RescuedPetRegisterTable.other]
                )
            }

        foundResults + rescuedResults
    }
}