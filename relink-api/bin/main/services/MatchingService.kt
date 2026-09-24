package com.services

import com.aiSimilarityService
import com.db.MatchesTable
import com.models.AiBatchCandidateItem
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

        // テキスト特徴（種類・毛色・場所）で事前絞り込み
        val candidates = MatchingRepository.findCandidates(
            specie    = lostPet.specie,
            color     = lostPet.color,
            lostPlace = lostPet.lostPlace
        )

        if (candidates.isEmpty()) {
            return emptyList()
        }

        // 候補ごとの写真URLを取得（写真がない候補は除外）
        data class CandidateWithPhotos(
            val source: String,
            val id: Long,
            val photoUrls: List<String>
        )
        val candidatesWithPhotos = candidates.mapNotNull { candidate ->
            val urls = PetPhotoRepository.findByPet(candidate.source, candidate.id).map { it.photoUrl }
            if (urls.isEmpty()) null else CandidateWithPhotos(candidate.source, candidate.id, urls)
        }

        if (candidatesWithPhotos.isEmpty()) {
            return emptyList()
        }

        // ★変更点：候補ごとに逐次 compare-photos を呼ぶのをやめ、
        //           /batch-compare-photos に全候補をまとめて投げて並列処理させる。
        //   旧：候補N件 × AI処理時間(10〜30秒) = 合計 100〜300秒
        //   新：AI並列処理(最大8並列) → 実質 1件分の処理時間程度で全候補を比較可能
        val batchItems = candidatesWithPhotos.map { c ->
            AiBatchCandidateItem(
                id = "${c.source}:${c.id}",  // "found:123" のような形でIDを文字列化
                photoUrls = c.photoUrls
            )
        }

        val batchResponse = try {
            aiSimilarityService.batchComparePhotos(
                photoUrls  = lostPhotoUrls,
                candidates = batchItems
            )
        } catch (e: AiServiceException) {
            println("⚠️ バッチAI比較に失敗しました。スキップします: ${e.message}")
            return emptyList()
        }

        // バッチ結果をIDでマップ化
        val scoreById = batchResponse.results.associateBy { it.id }

        val results = mutableListOf<MatchResultItem>()

        for (c in candidatesWithPhotos) {
            val key = "${c.source}:${c.id}"
            val aiResult = scoreById[key] ?: continue

            val scorePercent = aiResult.similarityScore * 100

            // uq_match制約（lost_pet_id, protected_source, protected_pet_id）の重複を回避
            val matchId = transaction {
                val existing = MatchesTable.selectAll()
                    .where {
                        (MatchesTable.lostPetId      eq lostPetId)    and
                        (MatchesTable.protectedSource eq c.source)     and
                        (MatchesTable.protectedPetId  eq c.id)
                    }
                    .map { it[MatchesTable.id] }
                    .firstOrNull()

                existing ?: MatchesTable.insert {
                    it[MatchesTable.lostPetId]       = lostPetId
                    it[MatchesTable.protectedSource]  = c.source
                    it[MatchesTable.protectedPetId]   = c.id
                    it[MatchesTable.matchScore]        = BigDecimal.valueOf(scorePercent)
                }[MatchesTable.id]
            }

            // マッチ率70%以上の場合に飼い主へ通知する
            if (scorePercent >= 70.0) {
                notifyOwner(
                    lostPet         = lostPet,
                    matchId         = matchId,
                    scorePercent    = scorePercent,
                    protectedSource = c.source
                )
            }

            results.add(
                MatchResultItem(
                    matchId         = matchId,
                    protectedSource = c.source,
                    protectedPetId  = c.id,
                    matchScore      = scorePercent,
                    reason          = aiResult.reason,
                    photoUrls       = c.photoUrls
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
}
