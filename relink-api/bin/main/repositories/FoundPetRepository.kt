package com.repositories

import com.db.FoundPetRegisterTable
import com.models.FoundPetRegisterRequest
import com.geocodingService // ★新規追加：Security.ktのトップレベルvalをimport
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime

object FoundPetRepository {
    // ★修正：ジオコーディングを呼ぶためsuspend関数に変更
    // (Ktorのルート内はsuspendのまま呼び出せるため、Routing.kt側の変更は最小限で済む)
    suspend fun insert(request: FoundPetRegisterRequest, userId: Long? = null): Long {
        val parsedDate = try {
            LocalDateTime.parse(request.foundDate)
        } catch (e: java.time.format.DateTimeParseException) {
            throw IllegalArgumentException("foundDateの形式が不正です。例: 2026-08-17T15:04:05")
        }

        // ★新規追加：DBへの書き込み(transaction)より前に、住所→座標変換を済ませておく
        // (Geocoding APIの呼び出しがsuspend関数のため、transaction{}の外で先に済ませる必要がある。
        //  Exposedのtransaction{}ブロックの中でsuspend関数を直接呼ぶと動かないため)
        val coordinates = geocodingService.geocode(request.foundPlace)

        return transaction {
            val insertedId = FoundPetRegisterTable.insert {
                it[foundPlace] = request.foundPlace
                it[foundDate] = parsedDate
                it[specie] = request.specie
                it[color] = request.color
                it[other] = request.other
                // ★新規追加：座標が取得できていれば保存する(取得できなくてもnullのまま登録は続行)
                it[latitude] = coordinates?.lat
                it[longitude] = coordinates?.lng
                // ★新規追加：登録したユーザーのIDを保存
                it[FoundPetRegisterTable.userId] = userId
            } get FoundPetRegisterTable.id

            PetPhotoRepository.insertPhotos(
                petSource = "found",
                petId = insertedId,
                photoUrls = request.photoUrls
            )

            insertedId
        }
    }
}