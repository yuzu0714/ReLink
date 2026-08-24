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

// ★新規追加(Day3-3)：SQL絞り込み(MatchingRepository)→AI類似度判定(AiSimilarityService)
// →matchesテーブルへの保存、をひとつなぎにするサービス。
// 単純な1テーブルの読み書きだけを行うRepositoryとは責務が違う(複数のRepository/Serviceを
// 横断的に呼び出す「司令塔」の役割)ため、servicesパッケージに置いている
object MatchingService {

    // 1件の迷子ペット(lostPetId)について、絞り込んだ候補全件にAIスコアをつけてmatchesに保存する。
    // AI呼び出し(comparePhotos)がsuspend関数のため、このメソッド自体もsuspendにする必要がある
    // (Ktorのルート内であればsuspendのまま呼び出せる)
    suspend fun runMatching(lostPetId: Long): List<MatchResultItem> {
        // ① 迷子ペット本体の情報を取得(絞り込み条件に使うspecie/color/lostPlaceが必要)
        val lostPet = LostPetRepository.findById(lostPetId)
            ?: throw NoSuchElementException("指定されたlostPetIdが見つかりません: $lostPetId")

        // ② 迷子ペットの写真URL一覧を取得(AIに送る「基準側」の写真)
        val lostPhotoUrls = PetPhotoRepository.findByPet("lost", lostPetId).map { it.photoUrl }
        if (lostPhotoUrls.isEmpty()) {
            throw IllegalArgumentException("迷子ペットに写真が登録されていません(lostPetId=$lostPetId)")
        }

        // ③ SQLでの粗い絞り込み(specie完全一致・color/lostPlace部分一致)
        val candidates = MatchingRepository.findCandidates(
            specie = lostPet.specie,
            color = lostPet.color,
            lostPlace = lostPet.lostPlace
        )

        val results = mutableListOf<MatchResultItem>()

        // ④ 候補を1件ずつ処理するループ(ここが今回のメイン部分)
        //    候補が複数いても、1件ずつ順番にAIへ問い合わせて結果を待つ「直列ループ」になっている
        //    (Unityで複数の敵1体ずつにダメージ判定をかけるforeachループと考え方は同じ🎮)
        for (candidate in candidates) {
            val candidatePhotoUrls = PetPhotoRepository
                .findByPet(candidate.source, candidate.id)
                .map { it.photoUrl }

            // 候補側に写真が1枚も無い場合はAIに送っても判定できないためスキップする
            if (candidatePhotoUrls.isEmpty()) continue

            // AIサーバー(match_api.py)へ問い合わせ、類似度スコア(0〜1)をもらう
            val aiResponse = aiSimilarityService.comparePhotos(
                photoUrls = lostPhotoUrls,
                candidatePhotoUrls = candidatePhotoUrls
            )

            // 0〜1のスコアを×100して0〜100スケールに変換(matches.match_scoreの単位に合わせる)
            val scorePercent = aiResponse.similarityScore * 100

            // matchesテーブルへ1件ずつINSERT(statusはデフォルトの"pending"のまま触らない)
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
                    reason = aiResponse.reason
                )
            )
        }

        // マッチ率が高い順に並べ替えて返す(フロントの表示順としてもそのまま使える)
        return results.sortedByDescending { it.matchScore }
    }
}