// package com
package com.models

import kotlinx.serialization.Serializable

// 画像アップロード成功時に返すレスポンス
// フロント側は次に呼ぶ登録APIへ、この photoUrl をそのまま渡してもらう想定
@Serializable
data class PhotoUploadResponse(
    val photoUrl: String
)