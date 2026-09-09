package com.services

import com.aiSimilarityService
import com.db.MatchesTable
import com.models.MatchResultItem
import com.repositories.LostPetRepository
import com.repositories.MatchCandidateRow
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

        // ── 1回目：犬種・毛色・場所すべてで絞り込み ──────────────────
        val firstCandidates = MatchingRepository.findCandidates(
            specie    = lostPet.specie,
            color     = lostPet.color,
            lostPlace = lostPet.lostPlace
        )

        val results = mutableListOf<MatchResultItem>()
        // 処理済みの候補を記録しておく（2回目で重複しないよう）
        val processedKeys = mutableSetOf<Pair<String, Long>>()

        for (candidate in firstCandidates) {
            processedKeys.add(Pair(candidate.source, candidate.id))
            processCandidate(lostPetId, lostPhotoUrls, candidate, results)
        }

        // ── 2回目：3件未満なら場所条件を外して再検索 ──────────────────
        if (results.size < 3 && !lostPet.lostPlace.isNullOrBlank()) {
            println("ℹ️ 1回目のマッチング結果が${results.size}件のため、発見場所を除いて再マッチングします")

            val fallbackCandidates = MatchingRepository.findCandidates(
                specie    = lostPet.specie,
                color     = lostPet.color,
                lostPlace = null   // ← 場所条件を除外
            ).filter { candidate ->
                // 1回目で既に処理した候補は除く
                Pair(candidate.source, candidate.id) !in processedKeys
            }

            println("ℹ️ 発見場所なし再検索：追加候補${fallbackCandidates.size}件")

            for (candidate in fallbackCandidates) {
                processCandidate(lostPetId, lostPhotoUrls, candidate, results)
            }
        }

        return results.sortedByDescending { it.matchScore }
    }

    // 候補1件に対してAI比較→matches保存→通知、を行う共通処理
    private suspend fun processCandidate(
        lostPetId: Long,
        lostPhotoUrls: List<String>,
        candidate: MatchCandidateRow,
        results: MutableList<MatchResultItem>
    ) {
        val candidatePhotoUrls = PetPhotoRepository
            .findByPet(candidate.source, candidate.id)
            .map { it.photoUrl }

        if (candidatePhotoUrls.isEmpty()) return

        val aiResponse = try {
            aiSimilarityService.comparePhotos(
                photoUrls          = lostPhotoUrls,
                candidatePhotoUrls = candidatePhotoUrls
            )
        } catch (e: AiServiceException) {
            call_log_skip(candidate.source, candidate.id, e.message)
            return
        }

        val scorePercent = aiResponse.similarityScore * 100

        // uq_match制約（lost_pet_id, protected_source, protected_pet_id）の重複を回避
        val matchId = transaction {
            val existing = MatchesTable.selectAll()
                .where {
                    (MatchesTable.lostPetId      eq lostPetId)        and
                    (MatchesTable.protectedSource eq candidate.source) and
                    (MatchesTable.protectedPetId  eq candidate.id)
                }
                .map { it[MatchesTable.id] }
                .firstOrNull()

            existing ?: MatchesTable.insert {
                it[MatchesTable.lostPetId]      = lostPetId
                it[MatchesTable.protectedSource] = candidate.source
                it[MatchesTable.protectedPetId]  = candidate.id
                it[MatchesTable.matchScore]       = BigDecimal.valueOf(scorePercent)
            }[MatchesTable.id]
        }

        // マッチ率70%以上の場合に飼い主へ通知する
        if (scorePercent >= 70.0) {
            val lostPet = LostPetRepository.findById(lostPetId)
            if (lostPet != null) {
                notifyOwner(
                    lostPet         = lostPet,
                    matchId         = matchId,
                    scorePercent    = scorePercent,
                    protectedSource = candidate.source
                )
            }
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
