package com.repositories

import com.db.FoundPetRegisterTable
import com.db.MatchesTable
import com.db.RescuedPetRegisterTable
import com.db.UserTable
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction

@Serializable
data class MatchDetailResponse(
    val matchId: Long,
    val matchScore: Double,
    val protectedSource: String,
    val pet: MatchedPetDetail,
    val contact: ContactDetail
)

@Serializable
data class MatchedPetDetail(
    val specie: String?,
    val color: String?,
    val foundPlace: String?,
    val foundDate: String?,
    val other: String?,
    val photoUrls: List<String>,
    val latitude: Double?,
    val longitude: Double?
)

@Serializable
data class ContactDetail(
    val email: String?,
    val displayName: String?,
    val role: String?
)

private data class PetRow(
    val specie: String?, val color: String?,
    val foundPlace: String?, val foundDate: String?,
    val other: String?, val latitude: Double?,
    val longitude: Double?, val userId: Long?
)

object MatchDetailRepository {

    fun findById(matchId: Long): MatchDetailResponse? = transaction {
        val matchRow = MatchesTable.selectAll()
            .where { MatchesTable.id eq matchId }
            .firstOrNull() ?: return@transaction null

        val source = matchRow[MatchesTable.protectedSource]
        val petId  = matchRow[MatchesTable.protectedPetId]
        val score  = matchRow[MatchesTable.matchScore].toDouble()

        val petRow: PetRow = when (source) {
            "found" -> FoundPetRegisterTable.selectAll()
                .where { FoundPetRegisterTable.id eq petId }
                .firstOrNull()?.let { r ->
                    PetRow(
                        specie     = r[FoundPetRegisterTable.specie],
                        color      = r[FoundPetRegisterTable.color],
                        foundPlace = r[FoundPetRegisterTable.foundPlace],
                        foundDate  = r[FoundPetRegisterTable.foundDate]?.toString(),
                        other      = r[FoundPetRegisterTable.other],
                        latitude   = r[FoundPetRegisterTable.latitude],
                        longitude  = r[FoundPetRegisterTable.longitude],
                        userId     = r[FoundPetRegisterTable.userId]
                    )
                } ?: return@transaction null
            else -> RescuedPetRegisterTable.selectAll()
                .where { RescuedPetRegisterTable.id eq petId }
                .firstOrNull()?.let { r ->
                    PetRow(
                        specie     = r[RescuedPetRegisterTable.specie],
                        color      = r[RescuedPetRegisterTable.color],
                        foundPlace = r[RescuedPetRegisterTable.foundPlace],
                        foundDate  = r[RescuedPetRegisterTable.foundDate]?.toString(),
                        other      = r[RescuedPetRegisterTable.other],
                        latitude   = r[RescuedPetRegisterTable.latitude],
                        longitude  = r[RescuedPetRegisterTable.longitude],
                        userId     = r[RescuedPetRegisterTable.userId]
                    )
                } ?: return@transaction null
        }

        val photoUrls = PetPhotoRepository.findByPet(source, petId).map { it.photoUrl }

        val contact = petRow.userId?.let { uid ->
            UserTable.selectAll()
                .where { UserTable.id eq uid }
                .firstOrNull()?.let { u ->
                    ContactDetail(
                        email       = u[UserTable.email],
                        displayName = u[UserTable.displayName],
                        role        = u[UserTable.role]
                    )
                }
        } ?: ContactDetail(null, null, null)

        MatchDetailResponse(
            matchId         = matchId,
            matchScore      = score,
            protectedSource = source,
            pet = MatchedPetDetail(
                specie     = petRow.specie,
                color      = petRow.color,
                foundPlace = petRow.foundPlace,
                foundDate  = petRow.foundDate,
                other      = petRow.other,
                photoUrls  = photoUrls,
                latitude   = petRow.latitude,
                longitude  = petRow.longitude
            ),
            contact = contact
        )
    }
}
