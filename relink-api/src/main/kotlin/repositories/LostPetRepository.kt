package com.repositories

import com.db.LostPetRegisterTable
import com.models.LostPetRegisterRequest
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import com.models.ShelterLostPetListItem // ★追加：一覧用DTOを使うため
import com.db.MatchesTable   // ★追加：候補(マッチ)の有無とスコアを見るため
import com.db.ContactTable   // ★追加：飼い主からの連絡の有無と進捗を見るため
import com.db.HandoverTable  // ★追加：引き渡し完了かどうかを見るため
import com.models.ShelterLostPetDetail // ★追加：詳細用DTOを使うため
import com.models.OwnerPetDetail // ★追加：飼い主向けペット詳細DTO

// lostpet_register への書き込みだけを担当するクラス
object LostPetRepository {
    fun insert(request: LostPetRegisterRequest, userId: Long? = null): Long {
        return transaction {
            val insertedId = LostPetRegisterTable.insert {
                // ★修正：photoUrlカラムがDB側でDROP COLUMN済み(pet_photosテーブルへ移管)のため、
                // LostPetRegisterTable側にもう存在しない。この行を削除してエラーを解消
                it[phoneNumber] = request.phoneNumber
                it[specie] = request.specie
                it[color] = request.color
                it[other] = request.other
                it[lostPlace] = request.lostPlace
                //新規追加：ペットの名前を保存
                it[LostPetRegisterTable.nickname] = request.nickname
                //新規追加：ペットの正式名称を保存
                it[LostPetRegisterTable.petName] = request.petName
                //新規追加：音声を保存
                it[LostPetRegisterTable.voiceUrl] = request.voiceUrl
                // ★新規追加：登録したユーザーのIDを保存
                it[LostPetRegisterTable.userId] = userId
                // ★追加：登録時の状態(safe=事前登録 / lost=すでに迷子)を保存
                it[LostPetRegisterTable.petStatus] = request.petStatus
            } get LostPetRegisterTable.id

            // ★新規追加：FoundPetRepositoryと同じく、本体INSERT成功後のidを使って
            // pet_photosテーブルに複数枚の写真をまとめてINSERTする
            // (これが抜けていたため、写真URLがリクエストで届いてもDBに一切保存されていなかった)
            PetPhotoRepository.insertPhotos(
                petSource = "lost",
                petId = insertedId,
                photoUrls = request.photoUrls
            )

            insertedId
        }
    }

    // ★新規追加(Day3-3)：マッチングループ開始時に、迷子ペット本体の情報(specie/color/lostPlace)を
    // 取得するために追加。MatchingRepository.findCandidates()に渡す検索条件はここから作る
    fun findById(id: Long): LostPetRegisterRow? = transaction {
        LostPetRegisterTable.selectAll()
            .where { LostPetRegisterTable.id eq id }
            .map {
                LostPetRegisterRow(
                    id = it[LostPetRegisterTable.id],
                    specie = it[LostPetRegisterTable.specie],
                    color = it[LostPetRegisterTable.color],
                    lostPlace = it[LostPetRegisterTable.lostPlace],
                    userId = it[LostPetRegisterTable.userId],   // ★追加
                    petStatus = it[LostPetRegisterTable.petStatus]
                )
            }
            .firstOrNull()
    }
    
    /*★新規追加：
    指定されたユーザーIDのペットを探して、ペットのリストとして返す
    「lostpet_registerから全部取得
    ただし、その中から指定したユーザーIDのものだけにして
    新しく登録した順番に並べてデータベースの行を LostPetRegisterRow に変換して
    ペット一覧として返す
    */
    fun findByUserId(userId: Long): List<LostPetRegisterRow> = transaction {
        LostPetRegisterTable.selectAll()
            .where { LostPetRegisterTable.userId eq userId }
            .orderBy(LostPetRegisterTable.id to SortOrder.DESC)
            .map {
                LostPetRegisterRow(
                    id = it[LostPetRegisterTable.id],
                    specie = it[LostPetRegisterTable.specie],
                    color = it[LostPetRegisterTable.color],
                    lostPlace = it[LostPetRegisterTable.lostPlace],
                    userId = it[LostPetRegisterTable.userId],
                    receivedFrom = it[LostPetRegisterTable.receivedFrom],
                    petStatus = it[LostPetRegisterTable.petStatus]
                )
            }
    }
    // ★新規追加：「迷子ペットIDから状態コードを返す関数」を作る
    // 前は findAllForShelter の中に直接書いていた判定を切り出して、一覧と詳細で共用する
    // 3つのテーブルを最初に1回ずつ全件取得してメモリに持ち、返す関数はメモリ上で振り分けるだけ(DBに追加で問い合わせない)
    private fun buildLostStatusResolver(): (Long) -> String = transaction {
        // 迷子ペットID → そのペットのマッチ一覧 (Triple = matchId, lostPetId, スコア0〜100)
        val matchesByLostPet = MatchesTable.selectAll()
            .map { Triple(it[MatchesTable.id], it[MatchesTable.lostPetId], it[MatchesTable.matchScore].toDouble()) }
            .groupBy { it.second }

        // matchId → その照合に対する連絡(contacts)の一覧
        val contactsByMatch = ContactTable.selectAll()
            .map { ContactStateRow(it[ContactTable.id], it[ContactTable.matchId], it[ContactTable.status]) }
            .groupBy { it.matchId }

        // 引き渡し「完了」の記録がある contactId の集合
        val handedOverContactIds = HandoverTable.selectAll()
            .where { HandoverTable.status eq "completed" }
            .map { it[HandoverTable.contactId] }
            .toSet()

        // 判定ロジック(前回と同じ)。上から順に評価して、最初に当てはまったものを採用する
        val resolver: (Long) -> String = { lostPetId ->
            val myMatches = matchesByLostPet[lostPetId].orEmpty()
            // 「rejected(見当違いだった)」の連絡は状態を進めない扱いにするので除外
            val myContacts = myMatches
                .flatMap { contactsByMatch[it.first].orEmpty() }
                .filter { it.status != "rejected" }

            when {
                myContacts.any { it.contactId in handedOverContactIds } -> "completed"  // 引き渡し記録あり
                myContacts.any { it.status == "confirmed" } -> "confirmed"              // 一致確認済み・引き渡し待ち
                myContacts.isNotEmpty() -> "contacting"                                  // 連絡済み
                myMatches.any { it.third >= CANDIDATE_SCORE_THRESHOLD } -> "candidate"   // 有力な候補あり
                else -> "lost"                                                           // まだ見つかっていない
            }
        }
        resolver
    }

    // ★修正：状態判定は buildLostStatusResolver に任せる形に変更。
    // ★修正：一覧からは電話番号を外した(電話番号は詳細ページだけで見せるため)
    fun findAllForShelter(): List<ShelterLostPetListItem> = transaction {
        val resolveStatus = buildLostStatusResolver() // ★状態を調べる関数を1回だけ作る

        LostPetRegisterTable.selectAll()
            .where { LostPetRegisterTable.petStatus eq "lost" } // ★追加：無事(safe)のペットは迷子一覧に出さない
            .orderBy(LostPetRegisterTable.id to SortOrder.DESC) // id降順＝新しい順
            .map { row ->
                val id = row[LostPetRegisterTable.id]
                ShelterLostPetListItem(
                    id = id,
                    photoUrl = PetPhotoRepository.findByPet("lost", id).firstOrNull()?.photoUrl,
                    petName = row[LostPetRegisterTable.petName],
                    specie = row[LostPetRegisterTable.specie],
                    color = row[LostPetRegisterTable.color],
                    lostPlace = row[LostPetRegisterTable.lostPlace],
                    other = row[LostPetRegisterTable.other],
                    status = resolveStatus(id)
                )
            }
    }

    // ★追加：offset ページネーション対応の迷子ペット一覧(N+1解消)
    fun findAllForShelterPaged(limit: Int, offset: Int): Pair<List<ShelterLostPetListItem>, Boolean> = transaction {
        val resolveStatus = buildLostStatusResolver()

        // ① 全件の基本情報だけを取得(写真なし)し、ソートしてからページ切り出し
        val allRows = LostPetRegisterTable.selectAll()
            .where { LostPetRegisterTable.petStatus eq "lost" } // ★追加：無事(safe)のペットは迷子一覧に出さない
            .orderBy(LostPetRegisterTable.id to SortOrder.DESC)
            .toList()

        val page = allRows.drop(offset).take(limit + 1)
        val hasMore = page.size > limit
        val pageRows = if (hasMore) page.dropLast(1) else page

        if (pageRows.isEmpty()) return@transaction Pair(emptyList<ShelterLostPetListItem>(), false)

        // ② このページ分の写真を一括取得(N+1解消)
        val pageIds = pageRows.map { it[LostPetRegisterTable.id] }
        val photos = PetPhotoRepository.findFirstPhotoByPets("lost", pageIds)

        // ③ 組み立て
        val items = pageRows.map { row ->
            val id = row[LostPetRegisterTable.id]
            ShelterLostPetListItem(
                id = id,
                photoUrl = photos[id],
                petName = row[LostPetRegisterTable.petName],
                specie = row[LostPetRegisterTable.specie],
                color = row[LostPetRegisterTable.color],
                lostPlace = row[LostPetRegisterTable.lostPlace],
                other = row[LostPetRegisterTable.other],
                status = resolveStatus(id)
            )
        }
        Pair(items, hasMore)
    }

    // ★新規追加：保護団体向けの迷子ペット詳細(1件)。存在しないidなら null を返す
    // 一覧と違って、電話番号・全写真・音声URL も入れて返す
    fun findDetailForShelter(id: Long): ShelterLostPetDetail? = transaction {
        val row = LostPetRegisterTable.selectAll()
            .where { LostPetRegisterTable.id eq id }
            .firstOrNull() ?: return@transaction null // 見つからなければ null(Routing側で404にする)

        ShelterLostPetDetail(
            id = id,
            petName = row[LostPetRegisterTable.petName],
            nickname = row[LostPetRegisterTable.nickname],
            specie = row[LostPetRegisterTable.specie],
            color = row[LostPetRegisterTable.color],
            lostPlace = row[LostPetRegisterTable.lostPlace],
            other = row[LostPetRegisterTable.other],
            phoneNumber = row[LostPetRegisterTable.phoneNumber],
            // 全写真を sort_order 順に取得(findByPet が昇順で返す)
            photoUrls = PetPhotoRepository.findByPet("lost", id).map { it.photoUrl },
            voiceUrl = row[LostPetRegisterTable.voiceUrl],
            status = buildLostStatusResolver()(id) // 状態を判定して、このペット分だけ取り出す
        )
    }

    /*★新規追加：カーソルページネーション対応のペット取得
     * cursor: 直前の最後のペットID。nullなら先頭から取得
     * limit: 1回に取得する件数
     * 戻り値: (ペットリスト, 次ページのcursor) ※次ページがなければcursorはnull
     */
    fun findByUserIdPaged(userId: Long, limit: Int, cursor: Long?): Pair<List<LostPetRegisterRow>, Long?> = transaction {
        var query = LostPetRegisterTable.selectAll()
            .where { LostPetRegisterTable.userId eq userId }

        // cursor指定あり：そのIDより小さいもの（=より古い）を取得（DESC順のため）
        if (cursor != null) {
            query = query.andWhere { LostPetRegisterTable.id less cursor }
        }

        // limit+1件取得して「次のページがあるか」を確認する
        val rows = query
            .orderBy(LostPetRegisterTable.id to SortOrder.DESC)
            .limit(limit + 1)
            .map {
                LostPetRegisterRow(
                    id = it[LostPetRegisterTable.id],
                    specie = it[LostPetRegisterTable.specie],
                    color = it[LostPetRegisterTable.color],
                    lostPlace = it[LostPetRegisterTable.lostPlace],
                    userId = it[LostPetRegisterTable.userId],
                    receivedFrom = it[LostPetRegisterTable.receivedFrom],
                    petStatus = it[LostPetRegisterTable.petStatus]
                )
            }

        val hasMore = rows.size > limit
        val items = if (hasMore) rows.dropLast(1) else rows
        val nextCursor = if (hasMore) items.lastOrNull()?.id else null
        Pair(items, nextCursor)
    }
    // ★新規追加：飼い主向けのペット詳細（自分のペットのみ、全写真・全フィールド）
    fun findDetailForOwner(id: Long, userId: Long): OwnerPetDetail? = transaction {
        val row = LostPetRegisterTable.selectAll()
            .where {
                (LostPetRegisterTable.id eq id) and
                (LostPetRegisterTable.userId eq userId)
            }
            .firstOrNull() ?: return@transaction null

        val photos = PetPhotoRepository.findByPet("lost", id).map { it.photoUrl }

        OwnerPetDetail(
            id = id,
            photoUrls = photos,
            specie = row[LostPetRegisterTable.specie],
            color = row[LostPetRegisterTable.color],
            lostPlace = row[LostPetRegisterTable.lostPlace],
            other = row[LostPetRegisterTable.other],
            nickname = row[LostPetRegisterTable.nickname],
            petName = row[LostPetRegisterTable.petName],
            receivedFrom = row[LostPetRegisterTable.receivedFrom],
            petStatus = row[LostPetRegisterTable.petStatus]
        )
    }

    // ★新規追加：「ペットを受け取りました」で received_from を保存する
    fun markAsReceived(id: Long, userId: Long, receivedFrom: String?): Boolean = transaction {
        val updated = LostPetRegisterTable.update({
            (LostPetRegisterTable.id eq id) and (LostPetRegisterTable.userId eq userId)
        }) {
            it[LostPetRegisterTable.receivedFrom] = receivedFrom
            // ★追加：受け取ったら飼い主のもとに戻ったので「無事」にする
            it[LostPetRegisterTable.petStatus] = "safe"
        }
        updated > 0
    }

    // ★新規追加：「迷子になりました」で状態を lost にし、いなくなった場所を保存する
    // 前回の受け取り記録(received_from)は今回の迷子とは無関係なので消す
    fun markAsLost(id: Long, userId: Long, lostPlace: String): Boolean = transaction {
        val updated = LostPetRegisterTable.update({
            (LostPetRegisterTable.id eq id) and (LostPetRegisterTable.userId eq userId)
        }) {
            it[LostPetRegisterTable.petStatus] = "lost"
            it[LostPetRegisterTable.lostPlace] = lostPlace
            it[LostPetRegisterTable.receivedFrom] = null
        }
        updated > 0
    }

}

// ★新規追加：findById()の戻り値専用の内部DTO
data class LostPetRegisterRow(
    val id: Long,
    val specie: String?,
    val color: String?,
    val lostPlace: String?,
    val userId: Long?,   // ★追加：通知送信時に飼い主を特定するために必要
    val receivedFrom: String? = null,  // ★追加：受け取り済み情報
    val petStatus: String = "lost"     // ★追加：ペットの状態。safe(無事) / lost(迷子)
)

// ★新規追加：「候補あり」と判定するマッチ率(%)のしきい値。ここを変えれば判定が変わる
private const val CANDIDATE_SCORE_THRESHOLD = 70.0

// ★新規追加：状態判定のためだけに使う、連絡(contacts)の最小限の中身
private data class ContactStateRow(
    val contactId: Long,
    val matchId: Long,
    val status: String
)