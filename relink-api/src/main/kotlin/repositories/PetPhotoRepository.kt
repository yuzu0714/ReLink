package com.repositories

import com.db.PetPhotoTable
import com.models.PetPhotoItem
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction

// ★新規追加：写真の複数枚INSERT・取得を担当するリポジトリ
// 他のRepositoryと同じくobject（シングルトン）として定義
object PetPhotoRepository {

    // ★新規追加：指定したpetSource + petIdに対して、複数枚の写真URLをまとめてINSERTする
    // 3つの登録Repository（Lost/Found/Rescued）全部からここを呼んでもらう共通処理として切り出した
    // （前回「委任先2人に同じ修正が伝わらなかった」学びを踏まえ、共通処理は1箇所にまとめる方針）
    fun insertPhotos(petSource: String, petId: Long, photoUrls: List<String>) = transaction {
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

    // ★新規追加：指定したpetSource + petIdに紐づく写真一覧を、sort_order昇順で取得する
    // （一覧・詳細表示APIから使う想定。今回はまだ呼び出し元は無いが、後続タスクのために先に用意しておく）
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