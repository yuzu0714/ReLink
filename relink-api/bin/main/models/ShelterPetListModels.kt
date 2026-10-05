package com.models

import kotlinx.serialization.Serializable

// GET /shelter/pets のレスポンス1件分のDTO
// foundpet_register由来かrescuedpet_register由来かをsourceで区別する
// (matchesテーブルのprotected_sourceと同じ考え方)
@Serializable
data class ShelterPetListItem(
    val id: Long,
    val matchId: Long?,
    val lostPetId: Long?,
    val source: String,     // "found" または "rescued"
    val photoUrl: String,
    val place: String,      // found_place に対応
    val date: String,       // found_date に対応(ISO8601形式の文字列。例: "2026-07-07T09:30:00")
    val specie: String,
    val color: String,
    val other: String? = null,
    // ★新規追加：地図表示用の緯度経度(変換に失敗している場合はnull)
    val latitude: Double? = null,
    val longitude: Double? = null
)

// GET /shelter/pets 全体のレスポンス
@Serializable
data class ShelterPetListResponse(
    val pets: List<ShelterPetListItem>,
    val nextCursor: Long? = null   // カーソルページネーション用：次ページのcursor。nullなら最終ページ
)

@Serializable
data class OwnerPetListItem(
    val id: Long,
    val photoUrl: String? = null,
    val specie: String? = null,
    val color: String? = null,
    val lostPlace: String? = null,
    val other: String? = null
)

@Serializable
data class OwnerPetListResponse(
    val pets: List<OwnerPetListItem>,
    val nextCursor: Long? = null   // カーソルページネーション用：次ページのcursor。nullなら最終ページ
)

// ★新規追加：保護団体向けの「迷子ペット一覧」1件分のDTO
// 飼い主が登録した lostpet_register の中身を、一覧表示に必要な分だけ返す
@Serializable
data class ShelterLostPetListItem(
    val id: Long,
    val photoUrl: String? = null,     // 代表写真(pet_photosのsort_order=0の1枚目)
    val petName: String? = null,      // ペットの正式名称
    val specie: String? = null,       // 犬種・種類
    val color: String? = null,        // 毛色
    val lostPlace: String? = null,    // いなくなった場所
    val other: String? = null,        // そのほか(特徴メモ)
    // ★修正：phoneNumber を削除(電話番号は一覧では見せず、詳細ページだけで返す)
    // ★新規追加：いまの状態コード。lost / candidate / contacting / confirmed / completed のどれか
    // (表示ラベルへの変換はフロント側で行う。バックエンドは「コード」だけ返す)
    val status: String = "lost"
)

// ★新規追加：GET /shelter/lost-pets 全体のレスポンス
@Serializable
data class ShelterLostPetListResponse(
    val pets: List<ShelterLostPetListItem>
    
)

// ★新規追加：保護団体向け「迷子ペット詳細」のDTO
// 一覧(ShelterLostPetListItem)より項目が多く、電話番号・全写真・音声URLを持つ
@Serializable
data class ShelterLostPetDetail(
    val id: Long,
    val petName: String? = null,      // ペットの正式名称
    val nickname: String? = null,     // 普段の呼び名
    val specie: String? = null,
    val color: String? = null,
    val lostPlace: String? = null,
    val other: String? = null,
    val phoneNumber: String? = null,  // 飼い主の連絡先(詳細だけで返す)
    val photoUrls: List<String> = emptyList(), // 登録された全写真(sort_order順。0番目が代表)
    val voiceUrl: String? = null,     // 飼い主が録音した「呼び声」(無ければnull)
    val status: String = "lost"
)