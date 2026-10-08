package com.models

import kotlinx.serialization.Serializable

@Serializable
data class LostPetRegisterRequest(
    val photoUrls: List<String>,
    val phoneNumber: String,
    val specie: String,
    val color: String,
    val other: String? = null,
    // ★修正：事前登録(無事)では紛失場所が無いので null 可に変更
    val lostPlace: String? = null,
    val nickname: String? = null,
    val petName: String? = null,
    val voiceUrl: String? = null,
    // ★追加：登録時の状態。"safe"(今は一緒にいる・事前登録) / "lost"(すでに迷子)
    val petStatus: String = "lost"
)

// ★修正：本番導線化に伴い、登録直後に自動実行したマッチング結果もレスポンスに含めるようにした
// (フロント側が改めて/matching/runを叩かなくても、登録の返事と同時に候補一覧を受け取れるようにするため)
// マッチング処理自体が失敗した場合は空リストが入る(登録自体は成功として扱う設計のため)
@Serializable
data class LostPetRegisterResponse(
    val id: Long,
    val message: String = "迷子ペット情報を登録しました",
    val matchResults: List<MatchResultItem> = emptyList()
)