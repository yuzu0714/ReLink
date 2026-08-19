// package com
package com.services

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*

// Supabase Storageへのアップロードだけを担当するクラス
// JWT発行を Security.kt に集約したのと同じ考え方で、
// 「Storageとの通信」をここ1箇所にまとめておく
class StorageService(
    private val supabaseUrl: String,   // .env から dotenv-kotlin で読み込む想定
    private val serviceRoleKey: String,
    private val bucketName: String = "pet-photos"
) {
    // HTTPクライアントは使い回すのでプロパティとして保持
    private val client = HttpClient(CIO)

    suspend fun uploadImage(fileName: String, fileBytes: ByteArray, contentType: String): String {
        val objectPath = "$fileName" // 必要ならUUID等でユニーク化する

        // Supabase Storage REST APIへPUTリクエストを送る
        // service_role keyを使うことで、バケットのアクセス制御を回避してサーバーから直接書き込める
        val response = client.put("$supabaseUrl/storage/v1/object/$bucketName/$objectPath") {
            header(HttpHeaders.Authorization, "Bearer $serviceRoleKey")
            header("apikey", serviceRoleKey)
            header(HttpHeaders.ContentType, contentType)
            setBody(fileBytes)
        }

        if (!response.status.isSuccess()) {
            throw StorageUploadException("画像のアップロードに失敗しました: ${response.status}")
        }

        // 公開URLを組み立てて返す(バケットをpublicに設定している前提)
        return "$supabaseUrl/storage/v1/object/public/$bucketName/$objectPath"
    }
}

// StatusPagesで補足してエラーレスポンスに変換するための専用例外
class StorageUploadException(message: String) : Exception(message)