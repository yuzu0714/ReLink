package com.services

import com.aiSimilarityService
import com.db.MatchesTable
import com.models.MatchResultItem
import com.repositories.LostPetRepository
import com.repositories.MatchingRepository
import com.repositories.PetPhotoRepository
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.transactions.transaction
import java.math.BigDecimal

// SQL絞り込み(MatchingRepository)→AI類似度判定(AiSimilarityService)
// →matchesテーブルへの保存、をひとつなぎにするサービス。
object MatchingService {

    suspend fun runMatching(lostPetId: Long): List<MatchResultItem> {
        val lostPet = LostPetRepository.findById(lostPetId)
            ?: throw NoSuchElementException("指定されたlostPetIdが見つかりません: $lostPetId")

        val lostPhotoUrls = PetPhotoRepository.findByPet("lost", lostPetId).map { it.photoUrl }
        if (lostPhotoUrls.isEmpty()) {
            throw IllegalArgumentException("迷子ペットに写真が登録されていません(lostPetId=$lostPetId)")
        }

        val candidates = MatchingRepository.findCandidates(
            specie = lostPet.specie,
            color = lostPet.color,
            lostPlace = lostPet.lostPlace
        )

        val results = mutableListOf<MatchResultItem>()

        for (candidate in candidates) {
            val candidatePhotoUrls = PetPhotoRepository
                .findByPet(candidate.source, candidate.id)
                .map { it.photoUrl }

            if (candidatePhotoUrls.isEmpty()) continue

            // ★修正：候補1件のAI比較が失敗しても、ループ全体を止めずに次の候補へ進むようにする
            // (画像破損や一時的な通信エラーが、他の正常な候補まで巻き添えにしないための対応)
            val aiResponse = try {
                aiSimilarityService.comparePhotos(
                    photoUrls = lostPhotoUrls,
                    candidatePhotoUrls = candidatePhotoUrls
                )
            } catch (e: AiServiceException) {
                // この候補だけスキップして、次の候補の判定を続ける
                call_log_skip(candidate.source, candidate.id, e.message)
                continue
            }

            val scorePercent = aiResponse.similarityScore * 100

            val insertedId = transaction {
                MatchesTable.insert {
                    it[MatchesTable.lostPetId] = lostPetId
                    it[MatchesTable.protectedSource] = candidate.source
                    it[MatchesTable.protectedPetId] = candidate.id
                    it[MatchesTable.matchScore] = BigDecimal.valueOf(scorePercent)
                } get MatchesTable.id
            }

            results.add(
                MatchResultItem(
                    matchId = insertedId,
                    protectedSource = candidate.source,
                    protectedPetId = candidate.id,
                    matchScore = scorePercent,
                    reason = aiResponse.reason,
                    photoUrls = candidatePhotoUrls   // ← この行を追加
                )
            )
        }

        return results.sortedByDescending { it.matchScore }
    }

    // ★新規追加：スキップ時のログ出力を1箇所にまとめた小さなヘルパー関数
    private fun call_log_skip(source: String, id: Long, message: String?) {
        println("⚠️ 候補(source=$source, id=$id)のAI比較に失敗、スキップします: $message")
    }
}