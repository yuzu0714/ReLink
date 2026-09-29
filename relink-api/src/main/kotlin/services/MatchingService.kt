package com.services

import com.aiSimilarityService
import com.db.MatchesTable
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

    // ★新規追加：AIサーバー(match_api.py)への同時リクエスト数の上限。
    // 候補が何十件あっても、この数を超えて同時に投げることはしない。
    // 値が大きいほど全体は速く終わるが、AIサーバー側の負荷(match_api.pyは1プロセスで動作)や
    // 外部AI APIのレート制限も考慮し、まずは控えめな3から始める。
    // (実測してみて余裕がありそうなら増やす、遅延やエラーが増えるなら減らす、という調整をする値)
    private const val MAX_CONCURRENT_AI_CALLS = 3

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

        // ★修正：for文で1件ずつ順番に処理していたのを、async/awaitAllによる並行処理に変更。
        // 候補ごとの処理(AI比較→matches保存)を独立したコルーチンとして起動し、
        // 全部の完了を待ってから結果をまとめる。
        // Semaphoreで同時実行数をMAX_CONCURRENT_AI_CALLS件までに制限することで、
        // AIサーバーに一度に大量のリクエストが殺到しないようにしている。
        val semaphore = Semaphore(MAX_CONCURRENT_AI_CALLS)

        val results = coroutineScope {
            candidates
                .map { candidate ->
                    async {
                        semaphore.withPermit {
                            processCandidate(lostPetId, lostPhotoUrls, candidate)
                        }
                    }
                }
                .awaitAll()
        }.filterNotNull() // AI比較に失敗した候補・写真が無い候補はnullで返ってくるので除外する

        return results.sortedByDescending { it.matchScore }
    }

    // ★新規追加：候補1件分の「写真取得→AI比較→matches保存」をまとめた関数。
    // 元々for文の中に直接書かれていた処理を、async{}から呼び出しやすいように関数として切り出した。
    // 失敗時(写真が無い/AI比較エラー)はnullを返し、呼び出し元でスキップ扱いにする。
    private suspend fun processCandidate(
        lostPetId: Long,
        lostPhotoUrls: List<String>,
        candidate: MatchCandidateRow,
    ): MatchResultItem? {
        // ★修正：DBアクセス(transaction{})はブロッキング処理のため、コルーチンの
        // デフォルトのスレッドを占有しないよう、Dispatchers.IO上で実行するようにwithContextで囲んだ。
        // (並列実行するコルーチンが増えるほど、ブロッキング処理を専用スレッドに逃がす重要性が増す)
        val candidatePhotoUrls = withContext(Dispatchers.IO) {
            PetPhotoRepository.findByPet(candidate.source, candidate.id).map { it.photoUrl }
        }
        if (candidatePhotoUrls.isEmpty()) return null

        // AIサーバーへのHTTPリクエストは元々suspend関数(非ブロッキング)なので、そのままでOK
        val aiResponse =
            try {
                aiSimilarityService.comparePhotos(
                    photoUrls = lostPhotoUrls,
                    candidatePhotoUrls = candidatePhotoUrls,
                )
            } catch (e: AiServiceException) {
                // この候補だけスキップして、他の候補の処理には影響させない
                call_log_skip(candidate.source, candidate.id, e.message)
                return null
            }

        val scorePercent = aiResponse.similarityScore * 100

        // ★修正：以前このlostPetId×この候補の組み合わせで既にマッチング済みだった場合、
        // matchesテーブルのDB制約(uq_match: lost_pet_id + protected_source + protected_pet_id の一意制約)
        // に引っかかってINSERTが失敗し、リクエスト全体が500エラーで落ちてしまっていた。
        // (同じ迷子ペットに対してマッチングを再実行すると起こりうる、実運用でも普通に起きるケース)
        // → INSERTを試みて、重複エラー(SQLState "23505" = unique_violation)だった場合だけ
        //   「新規登録」ではなく「既存のレコードを取得して使う」形に切り替える。
        //   それ以外の予期しないDBエラーはそのまま上位に投げて、通常通り500として扱う。
        val (insertedId, resolvedReason) = try {
            val newId = withContext(Dispatchers.IO) {
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
            newId to aiResponse.reason
        } catch (e: ExposedSQLException) {
            if (e.sqlState != "23505") throw e // uq_match以外のDBエラーはそのまま投げる

            // ★修正：ResultRowから値を取り出す処理(existingRow[MatchesTable.id])が
            // transaction{}ブロックの"外"で行われていたため、
            // 「No transaction in context」エラーになっていた。
            // Exposedの自動採番列(id)は、値を読み出す際に内部でDB方言の確認が必要で、
            // それにはトランザクションが有効な状態でなければならない。
            // → transaction{}ブロックの中でid(Long)まで取り出し切ってから返すように変更した。
            val existingId = withContext(Dispatchers.IO) {
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
        )
    }

    // スキップ時のログ出力を1箇所にまとめた小さなヘルパー関数
    private fun call_log_skip(source: String, id: Long, message: String?) {
        println("⚠️ 候補(source=$source, id=$id)のAI比較に失敗、スキップします: $message")
    }
}
