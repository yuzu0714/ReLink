package com.services

import com.aiSimilarityService
import com.db.MatchesTable
import com.models.MatchResultItem
import com.repositories.LostPetRepository
import com.repositories.MatchingRepository
import com.repositories.NotificationRepository
import com.repositories.PetPhotoRepository
import com.repositories.UserRepository
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import java.math.BigDecimal

object MatchingService {

    suspend fun runMatching(lostPetId: Long): List<MatchResultItem> {
        val lostPet = LostPetRepository.findById(lostPetId)
            ?: throw NoSuchElementException("指定されたlostPetIdが見つかりません: $lostPetId")

        val lostPhotoUrls = PetPhotoRepository.findByPet("lost", lostPetId).map { it.photoUrl }
        if (lostPhotoUrls.isEmpty()) {
            throw IllegalArgumentException("迷子ペットに写真が登録されていません(lostPetId=$lostPetId)")
        }

        val candidates = MatchingRepository.findCandidates(
            specie    = lostPet.specie,
            color     = lostPet.color,
            lostPlace = lostPet.lostPlace
        )

        val results = mutableListOf<MatchResultItem>()

        for (candidate in candidates) {
            val candidatePhotoUrls = PetPhotoRepository
                .findByPet(candidate.source, candidate.id)
                .map { it.photoUrl }

            if (candidatePhotoUrls.isEmpty()) continue

            val aiResponse = try {
                aiSimilarityService.comparePhotos(
                    photoUrls          = lostPhotoUrls,
                    candidatePhotoUrls = candidatePhotoUrls
                )
            } catch (e: AiServiceException) {
                call_log_skip(candidate.source, candidate.id, e.message)
                continue
            }

            val scorePercent = aiResponse.similarityScore * 100

            // ★修正：uq_match制約（lost_pet_id, protected_source, protected_pet_id）の重複を回避する。
            // 同じ組み合わせが既にあればそのIDを使い、なければINSERTする。
            val matchId = transaction {
                val existing = MatchesTable.selectAll()
                    .where {
                        (MatchesTable.lostPetId      eq lostPetId)       and
                        (MatchesTable.protectedSource eq candidate.source) and
                        (MatchesTable.protectedPetId  eq candidate.id)
                    }
                    .map { it[MatchesTable.id] }
                    .firstOrNull()

                existing ?: MatchesTable.insert {
                    it[MatchesTable.lostPetId]       = lostPetId
                    it[MatchesTable.protectedSource]  = candidate.source
                    it[MatchesTable.protectedPetId]   = candidate.id
                    it[MatchesTable.matchScore]        = BigDecimal.valueOf(scorePercent)
                }[MatchesTable.id]
            }

            // ★新規追加：マッチ率70%以上の場合に飼い主へ通知する
            if (scorePercent >= 70.0) {
                notifyOwner(
                    lostPet         = lostPet,
                    matchId         = matchId,
                    scorePercent    = scorePercent,
                    protectedSource = candidate.source
                )
            }

            results.add(
                MatchResultItem(
                    matchId         = matchId,
                    protectedSource = candidate.source,
                    protectedPetId  = candidate.id,
                    matchScore      = scorePercent,
                    reason          = aiResponse.reason,
                    photoUrls       = candidatePhotoUrls
                )
            )
        }

        return results.sortedByDescending { it.matchScore }
    }

    // 飼い主へのメール送信＆通知履歴保存（失敗してもマッチング全体を止めない）
    private suspend fun notifyOwner(
        lostPet        : com.repositories.LostPetRegisterRow,
        matchId        : Long,
        scorePercent   : Double,
        protectedSource: String
    ) {
        val userId = lostPet.userId ?: run {
            println("⚠️ lostPet(id=${lostPet.id})にuserIdが無いため通知をスキップします")
            return
        }

        val sourceLabel = if (protectedSource == "rescued") "保護施設" else "発見者"
        val message = "マッチ率${scorePercent.toInt()}%：${sourceLabel}によって似たペットが保護されました。マッチング結果を確認してください。"

        // 通知履歴をDBに保存（重複チェック：同じmatchIdの通知がなければINSERT）
        try {
            val alreadyNotified = transaction {
                com.db.NotificationTable.selectAll()
                    .where { com.db.NotificationTable.matchId eq matchId }
                    .count() > 0
            }
            if (!alreadyNotified) {
                NotificationRepository.insert(userId = userId, matchId = matchId, message = message)
                println("🔔 通知保存完了 (userId=$userId, matchId=$matchId)")
            } else {
                println("ℹ️ 通知済みのためスキップ (matchId=$matchId)")
            }
        } catch (e: Exception) {
            println("⚠️ 通知保存失敗 (userId=$userId): ${e.message}")
        }

        // メール送信
        val email = try {
            UserRepository.findEmailById(userId)
        } catch (e: Exception) {
            println("⚠️ メールアドレス取得失敗 (userId=$userId): ${e.message}")
            null
        }
        if (email != null) {
            EmailService.sendMatchNotification(
                toEmail         = email,
                matchScore      = scorePercent,
                protectedSource = protectedSource
            )
        }
    }

    private fun call_log_skip(source: String, id: Long, message: String?) {
        println("⚠️ 候補(source=$source, id=$id)のAI比較に失敗、スキップします: $message")
    }
}
