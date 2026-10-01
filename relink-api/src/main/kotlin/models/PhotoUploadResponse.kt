// package com
package com.models

import kotlinx.serialization.Serializable

// 画像アップロード成功時に返すレスポンス
// フロント側は次に呼ぶ登録APIへ、この photoUrl をそのまま渡してもらう想定
@Serializable
data class PhotoUploadResponse(
    val photoUrl: String
)

//新規追加：音声アップロード成功時に返すレスポンス
@Serializable
data class VoiceUploadResponse(
    val voiceUrl: String
)