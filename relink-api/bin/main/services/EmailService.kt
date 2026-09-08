package com.services

import io.github.cdimascio.dotenv.dotenv
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

object EmailService {

    private val dotenv = dotenv()
    private val resendApiKey: String by lazy {
        dotenv["RESEND_API_KEY"]
    }

    private val client = HttpClient(CIO) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
    }

    // 飼い主へマッチング通知メールを送信する
    // 失敗してもメール送信エラーはログに出すだけで、マッチング処理全体を止めない
    suspend fun sendMatchNotification(
        toEmail: String,
        matchScore: Double,
        protectedSource: String   // "found" or "rescued"
    ) {
        val sourceLabel = if (protectedSource == "rescued") "保護施設" else "発見者"
        val subject = "【ReLINK】迷子のペットが見つかったかもしれません (マッチ率 ${matchScore.toInt()}%)"
        val body = """
            <p>飼い主様</p>
            <p>
              お探しのペットと似た動物が<strong>${sourceLabel}</strong>によって保護されました。<br>
              AIマッチングスコア: <strong>${"%.1f".format(matchScore)}%</strong>
            </p>
            <p>
              ReLINK アプリの「マッチング結果」から詳細を確認し、連絡を取ってください。
            </p>
            <p>──<br>ReLINK 自動通知</p>
        """.trimIndent()

        try {
            val response: HttpResponse = client.post("https://api.resend.com/emails") {
                header(HttpHeaders.Authorization, "Bearer $resendApiKey")
                contentType(ContentType.Application.Json)
                setBody(ResendRequest(
                    from    = "ReLINK <onboarding@resend.dev>",
                    to      = listOf(toEmail),
                    subject = subject,
                    html    = body
                ))
            }
            println("📧 メール送信完了 → $toEmail (HTTP ${response.status})")
        } catch (e: Exception) {
            println("⚠️ メール送信失敗 → $toEmail : ${e.message}")
        }
    }
}

@Serializable
private data class ResendRequest(
    val from    : String,
    val to      : List<String>,
    val subject : String,
    val html    : String
)
