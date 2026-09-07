package com.models

import kotlinx.serialization.Serializable

// ★新規追加(Day3-3)：マッチング実行結果をフロント/テスト用エンドポイントに返すためのDTO
// AIから返ってきたsimilarity_score(0〜1)を×100した後の値(0〜100)を持つ

@Serializable
data class MatchResultItem(
    val matchId: Long,
    val protectedSource: String,   // "found" or "rescued"
    val protectedPetId: Long,
    val matchScore: Double,        // 0〜100（×100変換済み）
    val reason: String? = null,    // AIが返してくれた判定理由（あれば）
    val photoUrls: List<String> = emptyList()  // ← この行を追加
)

@Serializable
data class MatchingRunResponse(
    val lostPetId: Long,
    val candidateCount: Int,   // SQL絞り込みでヒットした候補の総数
    val results: List<MatchResultItem>
)