package com

import com.exceptions.ForbiddenException
import com.models.ErrorResponse
import com.services.AiServiceException
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
        // ↓↓↓ 追加:AI特徴抽出サーバー(match_api.py)との通信に失敗した場合(502)
        // match_api.pyが起動していない/応答が想定外の形式だった、などのケース
        exception<AiServiceException> { call, cause ->
            call.respond(
                HttpStatusCode.BadGateway,
                ErrorResponse("AI_SERVICE_ERROR", cause.message ?: "AI特徴抽出サーバーとの通信に失敗しました")
            )
        }
        // ① 想定内のエラー：リクエストの中身が悪い
        exception<IllegalArgumentException> { call, cause ->
            call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse("BAD_REQUEST", cause.message ?: "リクエストが不正です")
            )
        }
        // ★修正：kotlinx.serialization.SerializationException ではなく
        // io.ktor.server.plugins.BadRequestException で捕まえるように変更
        // （実際にサーバーログで確認したところ、call.receive()のJSON変換失敗時に
        // 　最終的にthrowされるのはこの型だったため。内部ではJsonConvertException →
        // 　MissingFieldExceptionが連鎖して発生し、それをKtorがBadRequestExceptionに
        // 　ラップしなおしてから投げている）
        exception<io.ktor.server.plugins.BadRequestException> { call, cause ->
            call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse("BAD_REQUEST", "リクエストの形式が正しくありません: ${cause.message}")
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