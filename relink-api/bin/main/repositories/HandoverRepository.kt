package com.repositories

import com.db.ContactTable
import com.db.HandoverTable
import com.models.HandoverRequest
import com.models.HandoverResponse
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime

object HandoverRepository {

    // ContactRepository.matchExists()と同じ考え方：
    // 存在しないcontactIdを渡された場合、INSERT前に弾いて404として扱えるようにするための確認用関数
    fun contactExists(contactId: Long): Boolean = transaction {
        ContactTable.selectAll().where { ContactTable.id eq contactId }.limit(1).any()
    }

    fun insert(request: HandoverRequest): HandoverResponse {
        // handoverDatetimeが未指定(null)なら「登録した瞬間の時刻」を採用する
        // 指定されている場合は日時パース失敗を400(IllegalArgumentException)に変換する
        // (FoundPetRepository等と同じ、日時パース失敗時のエラーハンドリング方針)
        val parsedDatetime = request.handoverDatetime?.let {
            try {
                LocalDateTime.parse(it)
            } catch (e: java.time.format.DateTimeParseException) {
                throw IllegalArgumentException("handoverDatetimeの形式が不正です。例: 2026-08-17T15:04:05")
            }
        } ?: LocalDateTime.now()

        return transaction {
            val insertedId = HandoverTable.insert {
                it[contactId] = request.contactId
                it[handoverPlace] = request.handoverPlace
                it[handoverDatetime] = parsedDatetime
                it[handedOverTo] = request.handedOverTo
                it[note] = request.note
                // statusはDBのDEFAULT('completed')に任せるのでここでは触らない
            } get HandoverTable.id

            // ContactRepository.insert()と同じパターン：INSERT直後にSELECTし直して
            // DBが実際に持ってる値(created_atのDEFAULT値など)をそのままレスポンスに使う
            HandoverTable.selectAll().where { HandoverTable.id eq insertedId }
                .first()
                .toHandoverResponse()
        }
    }

    // 「受け渡し記録の共有」の本体：ある連絡(contactId)に対する引き渡し記録を取得する
    // 飼い主・発見者・保護団体、誰でもこれを見れば「ちゃんと引き渡されたか」を確認できる
    fun findByContactId(contactId: Long): List<HandoverResponse> = transaction {
        HandoverTable.selectAll()
            .where { HandoverTable.contactId eq contactId }
            .orderBy(HandoverTable.createdAt to SortOrder.DESC)
            .map { it.toHandoverResponse() }
    }

    // 保護団体側の管理画面(frontend/finder.htmlの「受け渡し記録」一覧)用の全件取得
    fun getAll(): List<HandoverResponse> = transaction {
        HandoverTable.selectAll()
            .orderBy(HandoverTable.createdAt to SortOrder.DESC)
            .map { it.toHandoverResponse() }
    }

    // ResultRow → HandoverResponse への変換をここに集約(3箇所で同じ変換を書かなくて済むように)
    private fun ResultRow.toHandoverResponse(): HandoverResponse = HandoverResponse(
        id = this[HandoverTable.id],
        contactId = this[HandoverTable.contactId],
        handoverPlace = this[HandoverTable.handoverPlace],
        handoverDatetime = this[HandoverTable.handoverDatetime]?.toString(),
        handedOverTo = this[HandoverTable.handedOverTo],
        note = this[HandoverTable.note],
        status = this[HandoverTable.status],
        createdAt = this[HandoverTable.createdAt].toString()
    )
}