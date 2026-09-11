package com.exceptions

// ★新規追加：状態の競合が起きた時に投げる専用の例外
// 例:既に「連絡済み(contacted)」「確定済み(confirmed)」のmatchへ、
//    重複して連絡登録をしようとした場合に使う。
// IllegalArgumentException(400・入力自体が悪い)とは意味が違うので、
// ForbiddenException(403)と同じ考え方で専用クラスとして分離した。
// HTTPステータスは409 Conflict(リソースの状態が競合している)にマッピングする。
class ConflictException(message: String) : Exception(message)
