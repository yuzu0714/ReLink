package com.repositories

import com.db.PetPhotoTable
import com.models.PetPhotoItem
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction

// 写真の複数枚INSERT・取得を担当するリポジトリ
object PetPhotoRepository {

    // ★新規追加：写真の上限枚数(チームで10枚と決定)。
    // どこか1箇所で数値を管理しておくことで、後で変更する時にここだけ直せば済むようにしている
    private const val MAX_PHOTOS_PER_PET = 10

    // 指定したpetSource + petIdに対して、複数枚の写真URLをまとめてINSERTする
    // 3つの登録Repository（Lost/Found/Rescued）全部からここを呼んでもらう共通処理
    fun insertPhotos(petSource: String, petId: Long, photoUrls: List<String>) = transaction {
        // ★新規追加：写真の一括保存時点(photoUrls配列がペット1匹分まとまって届くタイミング)で
        // 枚数をチェックする。Lost/Found/Rescuedの3つのRepositoryが全部ここを共通で通るため、
        // この1箇所に制限を書くだけで3つすべてに反映される
        if (photoUrls.size > MAX_PHOTOS_PER_PET) {
            throw IllegalArgumentException(
                "写真は${MAX_PHOTOS_PER_PET}枚までしか登録できません(現在${photoUrls.size}枚)"
            )
        }

        // 配列のインデックスをそのままsort_orderとして使う（0番目が代表写真）
        photoUrls.forEachIndexed { index, url ->
            PetPhotoTable.insert {
                it[PetPhotoTable.petSource] = petSource
                it[PetPhotoTable.petId] = petId
                it[photoUrl] = url
                it[sortOrder] = index
            }
        }
    }

    // 指定したpetSource + petIdに紐づく写真一覧を、sort_order昇順で取得する
    fun findByPet(petSource: String, petId: Long): List<PetPhotoItem> = transaction {
        PetPhotoTable.selectAll()
            .where { (PetPhotoTable.petSource eq petSource) and (PetPhotoTable.petId eq petId) }
            .orderBy(PetPhotoTable.sortOrder to SortOrder.ASC)
            .map { row ->
                PetPhotoItem(
                    photoUrl = row[PetPhotoTable.photoUrl],
                    sortOrder = row[PetPhotoTable.sortOrder]
                )
            }
    }
    
    // ★新規追加：N+1問題解消用の関数
    // 複数のpetIdをまとめて受け取り、「pet_id → 代表写真URL(sort_order=0のもの)」のMapを1回のクエリで作る
    // 呼び出し側(ShelterPetListRepository)は、1件ずつfindByPet()を呼ぶ代わりにこれを1回だけ呼べばよくなる
    //
    // 考え方：SQLのIN句(petId inList petIds)を使うことで、
    // 「WHERE pet_id = 1」を10回投げる代わりに「WHERE pet_id IN (1,2,3,...,10)」を1回投げるだけで済む。
    // 戻り値をMapにしてるのは、呼び出し側が「このpetIdの写真は？」と聞いた時に
    // 一覧を毎回線形探索(List.find)せず、Mapのキー検索(平均O(1))で一瞬で引けるようにするため
    fun findRepresentativePhotos(petSource: String, petIds: List<Long>): Map<Long, String> = transaction {
        // ★新規追加：petIdsが空の場合、inList()に空リストを渡すとSQL構文エラーになる環境があるため、
        // クエリを投げずに空のMapを返して早期リターンする(found側だけ0件、みたいなケースの安全対策)
        if (petIds.isEmpty()) return@transaction emptyMap()

        PetPhotoTable.selectAll()
            .where {
                (PetPhotoTable.petSource eq petSource) and
                (PetPhotoTable.petId inList petIds) and
                (PetPhotoTable.sortOrder eq 0) // 代表写真(0番目)のみに絞り込む
            }
            .associate { row -> row[PetPhotoTable.petId] to row[PetPhotoTable.photoUrl] }
    }
}