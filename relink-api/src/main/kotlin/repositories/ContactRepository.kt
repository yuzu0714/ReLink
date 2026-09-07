package com.repositories

import com.db.ContactTable
import com.db.MatchesTable
import com.models.ContactRequest
import com.models.ContactResponse
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import kotlin.random.Random

object ContactRepository {

    // ★新規追加：statusとして許可する値の一覧。DB側のCHECK制約(matches_status_check等)と
    // 同じ4種類にしている。ここでもチェックしておくことで、DB側のエラー(500系)ではなく
    // アプリ側で分かりやすい400エラーとして早めに弾けるようにする
    private val ALLOWED_STATUSES = setOf("pending", "contacted", "confirmed", "rejected")

    fun matchExists(matchId: Long): Boolean = transaction {
        MatchesTable.selectAll().where { MatchesTable.id eq matchId }.limit(1).any()
    }

    fun insert(request: ContactRequest): ContactResponse = transaction {
        val receptionNumber = generateReceptionNumber()

        val insertedId = ContactTable.insert {
            it[matchId] = request.matchId
            it[contactedByPhone] = request.contactedByPhone
            it[ContactTable.receptionNumber] = receptionNumber
            it[note] = request.note
        } get ContactTable.id

        ContactTable.selectAll().where { ContactTable.id eq insertedId }
            .first()
            .let { row -> rowToResponse(row) }
    }

    // ★新規追加：指定したcontacts.idのstatusだけを更新し、更新後の最新の状態を返す
    // 存在しないidが指定された場合はnullを返す(呼び出し元のRoutingでNoSuchElementExceptionに変換する)
    fun updateStatus(id: Long, newStatus: String): ContactResponse? = transaction {
        // 許可されていない値が来た場合、DBのCHECK制約に頼らずアプリ側で早めに弾く
        if (newStatus !in ALLOWED_STATUSES) {
            throw IllegalArgumentException(
                "statusは${ALLOWED_STATUSES.joinToString(" / ")}のいずれかを指定してください(指定値: $newStatus)"
            )
        }

        // 対象のcontactsレコードが存在するか先に確認する
        val exists = ContactTable.selectAll().where { ContactTable.id eq id }.limit(1).any()
        if (!exists) return@transaction null

        ContactTable.update({ ContactTable.id eq id }) {
            it[status] = newStatus
        }

        ContactTable.selectAll().where { ContactTable.id eq id }
            .first()
            .let { row -> rowToResponse(row) }
    }

    // ★新規追加：Row→ContactResponse変換処理をinsert()とupdateStatus()の両方で使うため、
    // 共通の関数として切り出した(コードの重複を避けるため)
    private fun rowToResponse(row: ResultRow): ContactResponse =
        ContactResponse(
            id = row[ContactTable.id],
            matchId = row[ContactTable.matchId],
            contactedByPhone = row[ContactTable.contactedByPhone],
            receptionNumber = row[ContactTable.receptionNumber],
            status = row[ContactTable.status],
            note = row[ContactTable.note],
            createdAt = row[ContactTable.createdAt].toString()
        )

    private fun generateReceptionNumber(): String {
        val formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss")
        val timestamp = LocalDateTime.now().format(formatter)
        val randomSuffix = Random.nextInt(100, 1000)
        return "RL-$timestamp$randomSuffix"
    }
}