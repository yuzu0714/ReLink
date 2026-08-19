package com.exceptions

// 権限が無い操作をしようとした時に投げる専用の例外
// IllegalArgumentException(400)とは意味が違うので、専用クラスとして分離した
class ForbiddenException(message: String) : Exception(message)