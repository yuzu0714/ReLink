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
}