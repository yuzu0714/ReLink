package com

import com.exceptions.ForbiddenException
import com.models.ErrorResponse
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*

fun Application.configureStatusPages() {
    install(StatusPages) {
        // ↓↓↓ 追加:権限不足エラー(403)
        exception<ForbiddenException> { call, cause ->
            call.respond(
                HttpStatusCode.Forbidden,
                ErrorResponse("FORBIDDEN", cause.message ?: "この操作を行う権限がありません")
            )
        }
        // ① 想定内のエラー：リクエストの中身が悪い
        exception<IllegalArgumentException> { call, cause ->
            call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse("BAD_REQUEST", cause.message ?: "リクエストが不正です")
            )
        }

        // ② 想定内のエラー：探したデータが無い
        exception<NoSuchElementException> { call, cause ->
            call.respond(
                HttpStatusCode.NotFound,
                ErrorResponse("NOT_FOUND", cause.message ?: "指定されたデータが見つかりません")
            )
        }

        // ③ 想定外のエラー：バグやDB接続断など、拾いきれなかった全部
        exception<Throwable> { call, cause ->
            call.application.log.error("Unhandled exception", cause)
            call.respond(
                HttpStatusCode.InternalServerError,
                ErrorResponse("INTERNAL_ERROR", "サーバー内部でエラーが発生しました")
            )
        }

        // ④ 例外じゃなく「ステータスコードだけ」返ってきたケース
        status(HttpStatusCode.NotFound) { call, status ->
            call.respond(status, ErrorResponse("NOT_FOUND", "指定されたエンドポイントが見つかりません"))
        }
        status(HttpStatusCode.Unauthorized) { call, status ->
            call.respond(status, ErrorResponse("UNAUTHORIZED", "認証が必要です"))
        }
    }
}