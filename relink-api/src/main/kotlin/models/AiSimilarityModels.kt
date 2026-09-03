package com.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// AIサーバー(match_api.py)の POST /compare-photos に送るリクエストの形。
// AiExtractionServiceが写真バイナリを送るのに対し、こちらは既にpet_photosに
// 保存済みの写真URLを比較するだけなので、JSON形式で送る（マルチパートではない）
@Serializable
data class AiSimilarityRequest(
    val photoUrls: List<String>,          // 基準側（例：迷子ペット）の写真URL一覧
    val candidatePhotoUrls: List<String>  // 比較対象（候補ペット）の写真URL一覧
)

// AIサーバーからそのまま返ってくるレスポンスの形。
// AI側はsnake_caseのキー名(similarity_score)を使っているため、
// AiRawFeaturesと同じくデコード専用に@SerialNameを付ける
@Serializable
data class AiSimilarityRawResponse(
    @SerialName("similarity_score") val similarityScore: Double, // 0〜1の小数
    val reason: String? = null
)