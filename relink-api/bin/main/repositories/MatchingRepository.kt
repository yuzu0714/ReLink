package com.repositories

import com.db.FoundPetRegisterTable
import com.db.RescuedPetRegisterTable
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import kotlin.math.*

@Serializable
data class MatchCandidateRow(
    val source: String,      // "found" or "rescued"
    val id: Long,
    val specie: String?,
    val color: String?,
    val foundPlace: String?,
    val other: String?,
    // ★新規追加：距離ベースのフィルタリングに使用
    val latitude: Double?,
    val longitude: Double?
)

object MatchingRepository {

    // ハーバーサイン公式で2点間の距離(km)を計算
    private fun haversineKm(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val R = 6371.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLng = Math.toRadians(lng2 - lng1)
        val a = sin(dLat / 2).pow(2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
                sin(dLng / 2).pow(2)
        return 2 * R * asin(sqrt(a))
    }

    // lostPlaceの先頭から都道府県名を抽出する
    // 例: "東京都 渋谷区道玄坂2-1" → "東京都"
    //     "大阪府 梅田" → "大阪府"
    //     "渋谷区" → null（都道府県が含まれていない）
    private fun extractPrefecture(place: String?): String? {
        if (place.isNullOrBlank()) return null
        val match = Regex("^([^ 　]+[都道府県])").find(place)
        return match?.groupValues?.get(1)
    }

    private fun SqlExpressionBuilder.buildCondition(
        specie: String?,
        prefecture: String?,
        lostPlace: String?,
        specieCol: Column<String?>,
        colorCol: Column<String?>,
        placeCol: Column<String?>
    ): Op<Boolean> {
        var condition: Op<Boolean> = Op.TRUE

        if (!specie.isNullOrBlank()) {
            condition = condition and (specieCol eq specie)
        }

        // ★変更：場所のマッチングを改善
        // 都道府県が抽出できた場合は都道府県名で前方一致検索（精度向上）
        // 抽出できなかった場合は従来通りLIKE検索にフォールバック
        when {
            !prefecture.isNullOrBlank() ->
                condition = condition and (placeCol like "$prefecture%")
            !lostPlace.isNullOrBlank() ->
                condition = condition and (placeCol like "%$lostPlace%")
        }

        return condition
    }

    // ★変更：lostLatitude/lostLongitudeを追加（距離ベースのフィルタリングに使用）
    // 距離フィルタリングの半径（km）。座標が取得できない場合は都道府県マッチングのみで絞り込む
    fun findCandidates(
        specie: String?,
        color: String?,
        lostPlace: String?,
        lostLatitude: Double? = null,
        lostLongitude: Double? = null,
        radiusKm: Double = 100.0
    ): List<MatchCandidateRow> = transaction {

        val prefecture = extractPrefecture(lostPlace)

        val foundResults = FoundPetRegisterTable
            .selectAll()
            .where {
                buildCondition(
                    specie, prefecture, lostPlace,
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
                    other = it[FoundPetRegisterTable.other],
                    latitude = it[FoundPetRegisterTable.latitude],
                    longitude = it[FoundPetRegisterTable.longitude]
                )
            }

        val rescuedResults = RescuedPetRegisterTable
            .selectAll()
            .where {
                buildCondition(
                    specie, prefecture, lostPlace,
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
                    other = it[RescuedPetRegisterTable.other],
                    latitude = it[RescuedPetRegisterTable.latitude],
                    longitude = it[RescuedPetRegisterTable.longitude]
                )
            }

        val allCandidates = foundResults + rescuedResults

        // ★距離フィルタリング：迷子ペットの座標が取得できている場合のみ適用
        // 候補の座標がnullの場合はフィルタリングから除外しない（座標未登録の古いデータを救済）
        if (lostLatitude != null && lostLongitude != null) {
            allCandidates.filter { candidate ->
                val candLat = candidate.latitude
                val candLng = candidate.longitude
                if (candLat == null || candLng == null) {
                    // 候補に座標がなければ距離判定できないため残す
                    true
                } else {
                    haversineKm(lostLatitude, lostLongitude, candLat, candLng) <= radiusKm
                }
            }
        } else {
            allCandidates
        }
    }
}
