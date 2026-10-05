package com.services

import com.aiSimilarityService
import com.db.MatchesTable
import com.models.AiBatchCandidateItem
import com.repositories.MatchCandidateRow
import com.models.MatchResultItem
import com.repositories.LostPetRepository
import com.repositories.MatchingRepository
import com.repositories.PetPhotoRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import org.jetbrains.exposed.exceptions.ExposedSQLException // ★新規追加：重複INSERT検知のため
import org.jetbrains.exposed.sql.* // ★修正：where{}内でand/eqを使うため、個別importからワイルドカードに変更
import org.jetbrains.exposed.sql.transactions.transaction
import java.math.BigDecimal

// SQL絞り込み(MatchingRepository)→AI類似度判定(AiSimilarityService)
// →matchesテーブルへの保存、をひとつなぎにするサービス。
object MatchingService {
    private val matchingDatabaseSemaphore = Semaphore(2)

    private suspend fun <T> withMatchingDatabaseAccess(block: () -> T): T =
        matchingDatabaseSemaphore.withPermit {
            withContext(Dispatchers.IO) { block() }
        }

    suspend fun runMatching(lostPetId: Long): List<MatchResultItem> {
        val lostPet = withMatchingDatabaseAccess { LostPetRepository.findById(lostPetId) }
            ?: throw NoSuchElementException("指定されたlostPetIdが見つかりません: $lostPetId")

        val lostPhotoUrls = withMatchingDatabaseAccess {
            PetPhotoRepository.findByPet("lost", lostPetId).map { it.photoUrl }
        }
        if (lostPhotoUrls.isEmpty()) {
            throw IllegalArgumentException("迷子ペットに写真が登録されていません(lostPetId=$lostPetId)")
        }

        println("🔍 [Matching] lostPetId=$lostPetId specie=${lostPet.specie} color=${lostPet.color} lostPlace=${lostPet.lostPlace}")
        println("🔍 [Matching] 迷子写真枚数: ${lostPhotoUrls.size}")

        val candidates = withMatchingDatabaseAccess {
            MatchingRepository.findCandidates(
                specie = lostPet.specie,
                color = lostPet.color,
                lostPlace = lostPet.lostPlace
            )
        }

        println("🔍 [Matching] SQL絞り込み結果: ${candidates.size}件")
        candidates.forEach { c -> println("  → source=${c.source} id=${c.id} specie=${c.specie} color=${c.color} place=${c.foundPlace}") }

        val candidatesWithPhotos = coroutineScope {
            candidates
                .map { candidate ->
                    async {
                        val photoUrls = withMatchingDatabaseAccess {
                            PetPhotoRepository.findByPet(candidate.source, candidate.id)
                                .map { it.photoUrl }
                        }
                        candidate to photoUrls
                    }
                }
                .awaitAll()
        }.filter { (_, photoUrls) -> photoUrls.isNotEmpty() }

        println("🔍 [Matching] 写真あり候補: ${candidatesWithPhotos.size}件")

        if (candidatesWithPhotos.isEmpty()) return emptyList()

        val candidateItems = candidatesWithPhotos.map { (candidate, photoUrls) ->
            AiBatchCandidateItem(
                id = candidateKey(candidate),
                photoUrls = photoUrls,
            )
        }
        val aiResults =
            try {
                aiSimilarityService.comparePhotosBatch(lostPhotoUrls, candidateItems).results
            } catch (e: AiServiceException) {
                println("⚠️ 迷子ペット(id=$lostPetId)のAI一括比較に失敗しました: ${e.message}")
                return emptyList()
            }
        val aiResultsByCandidate = aiResults.associateBy { it.id }

        val candidatesWithResults = candidatesWithPhotos.mapNotNull { (candidate, photoUrls) ->
            val aiResult = aiResultsByCandidate[candidateKey(candidate)]
            if (aiResult == null) {
                call_log_skip(candidate.source, candidate.id, "AI一括比較の応答に候補がありません")
                return@mapNotNull null
            }
            if (aiResult.reason?.startsWith("比較エラー:") == true) {
                call_log_skip(candidate.source, candidate.id, aiResult.reason)
                return@mapNotNull null
            }
            Triple(candidate, photoUrls, aiResult)
        }

        val results = coroutineScope {
            candidatesWithResults.map { (candidate, photoUrls, aiResult) ->
                async {
                    saveCandidateResult(
                        lostPetId = lostPetId,
                        candidate = candidate,
                        candidatePhotoUrls = photoUrls,
                        scorePercent = aiResult.similarityScore * 100,
                        reason = aiResult.reason,
                    )
                }
            }.awaitAll()
        }

        return results.sortedByDescending { it.matchScore }
    }

    private fun candidateKey(candidate: MatchCandidateRow): String =
        "${candidate.source}:${candidate.id}"

    private suspend fun saveCandidateResult(
        lostPetId: Long,
        candidate: MatchCandidateRow,
        candidatePhotoUrls: List<String>,
        scorePercent: Double,
        reason: String?,
    ): MatchResultItem {
        // ★修正：以前このlostPetId×この候補の組み合わせで既にマッチング済みだった場合、
        // matchesテーブルのDB制約(uq_match: lost_pet_id + protected_source + protected_pet_id の一意制約)
        // に引っかかってINSERTが失敗し、リクエスト全体が500エラーで落ちてしまっていた。
        // (同じ迷子ペットに対してマッチングを再実行すると起こりうる、実運用でも普通に起きるケース)
        // → INSERTを試みて、重複エラー(SQLState "23505" = unique_violation)だった場合だけ
        //   「新規登録」ではなく「既存のレコードを取得して使う」形に切り替える。
        //   それ以外の予期しないDBエラーはそのまま上位に投げて、通常通り500として扱う。
        val (insertedId, resolvedReason) = try {
            val newId = withMatchingDatabaseAccess {
                // ★修正：repetitionAttemptsという名前付き引数は、このプロジェクトで使っている
                // Exposed 0.55.0には存在しなかった(ビルドエラーになったため)。
                // リトライ無効化はあくまで速度面のおまけ最適化であり、重複エラー自体の
                // ハンドリング(catchブロック側)には影響しないため、一旦標準のtransaction{}に戻した。
                // (リトライ回数の制御方法は、Exposedのバージョンごとに設定方法が変わるようなので、
                //  正確な方法は別途ドキュメントで確認してから改めて対応する)
                transaction {
                    MatchesTable.insert {
                        it[MatchesTable.lostPetId] = lostPetId
                        it[MatchesTable.protectedSource] = candidate.source
                        it[MatchesTable.protectedPetId] = candidate.id
                        it[MatchesTable.matchScore] = BigDecimal.valueOf(scorePercent)
                    } get MatchesTable.id
                }
            }
            newId to reason
        } catch (e: ExposedSQLException) {
            if (e.sqlState != "23505") throw e // uq_match以外のDBエラーはそのまま投げる

            // ★修正：ResultRowから値を取り出す処理(existingRow[MatchesTable.id])が
            // transaction{}ブロックの"外"で行われていたため、
            // 「No transaction in context」エラーになっていた。
            // Exposedの自動採番列(id)は、値を読み出す際に内部でDB方言の確認が必要で、
            // それにはトランザクションが有効な状態でなければならない。
            // → transaction{}ブロックの中でid(Long)まで取り出し切ってから返すように変更した。
            val existingId = withMatchingDatabaseAccess {
                transaction {
                    MatchesTable.selectAll().where {
                        (MatchesTable.lostPetId eq lostPetId) and
                            (MatchesTable.protectedSource eq candidate.source) and
                            (MatchesTable.protectedPetId eq candidate.id)
                    }.first()[MatchesTable.id] // ← ブロックの中でLong値まで取り出す
                }
            }

            // 既存レコードのidとスコアを使う。reason(判定理由)はDBに保存されていないため、
            // その旨が分かるコメントを付けて返す(★改善余地：matchesテーブルにreason列を
            // 追加すれば、再実行時も判定理由を保持できるようになる)
            existingId to "(前回のマッチング結果を再利用。判定理由は保存されていないため空欄)"
        }

        return MatchResultItem(
            matchId = insertedId,
            protectedSource = candidate.source,
            protectedPetId = candidate.id,
            matchScore = scorePercent,
            reason = resolvedReason,
            photoUrls = candidatePhotoUrls,
            specie = candidate.specie,
            color = candidate.color,
            foundPlace = candidate.foundPlace,
        )
    }

    // スキップ時のログ出力を1箇所にまとめた小さなヘルパー関数
    private fun call_log_skip(source: String, id: Long, message: String?) {
        println("⚠️ 候補(source=$source, id=$id)のAI比較に失敗、スキップします: $message")
    }
}
