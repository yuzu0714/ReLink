package com.models

import kotlinx.serialization.Serializable

@Serializable
data class LostPetRegisterRequest(
    val photoUrls: List<String>,
    val phoneNumber: String,
    val specie: String,
    val color: String,
    val other: String? = null,
    val lostPlace: String
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