package com.repositories

import com.db.ContactTable
import com.db.MatchTable
import com.models.ContactRequest
import com.models.ContactResponse
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import kotlin.random.Random

object ContactRepository {

    // ★修正：非推奨の select{} → selectAll().where{} に変更（ビルドがwarning=errorモードのため）
    fun matchExists(matchId: Long): Boolean = transaction {
        MatchTable.selectAll().where { MatchTable.id eq matchId }.limit(1).any()
    }

    fun insert(request: ContactRequest): ContactResponse = transaction {
        val receptionNumber = generateReceptionNumber()

        val insertedId = ContactTable.insert {
            it[matchId] = request.matchId
            it[contactedByPhone] = request.contactedByPhone
            it[ContactTable.receptionNumber] = receptionNumber
            it[note] = request.note
        } get ContactTable.id

        // ★修正：非推奨の select{} → selectAll().where{} に変更
        ContactTable.selectAll().where { ContactTable.id eq insertedId }
            .first()
            .let { row ->
                ContactResponse(
                    id = row[ContactTable.id],
                    matchId = row[ContactTable.matchId],
                    contactedByPhone = row[ContactTable.contactedByPhone],
                    receptionNumber = row[ContactTable.receptionNumber],
                    status = row[ContactTable.status],
                    note = row[ContactTable.note],
                    createdAt = row[ContactTable.createdAt].toString()
                )
            }
    }

    private fun generateReceptionNumber(): String {
        val formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss")
        val timestamp = LocalDateTime.now().format(formatter)
        val randomSuffix = Random.nextInt(100, 1000)
        return "RL-$timestamp$randomSuffix"
    }
}