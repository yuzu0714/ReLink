# 使い方: python3 list.py
# 登録されているペットの一覧表示

# /// script
# requires-python = ">=3.10"
# ///
import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "pets.db")


def main():
    if not os.path.isfile(DB_PATH):
        print("まだ pets.db が作成されていません。先に tag.py を実行してください。")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    cols = [row[1] for row in conn.execute("PRAGMA table_info(pets)").fetchall()]
    has_edited_col = "edited_at" in cols
    has_found_place_col = "found_place" in cols

    pets = conn.execute("SELECT * FROM pets ORDER BY id").fetchall()

    if not pets:
        print("登録されているペットはまだありません。")
        conn.close()
        return

    for pet in pets:
        images = conn.execute(
            "SELECT image_path FROM pet_images WHERE pet_id = ? ORDER BY id",
            (pet["id"],),
        ).fetchall()
        collar = pet["collar_features"] if pet["has_collar"] else "なし"
        status_label = "保護" if pet["status"] == "protected" else "迷子"
        edited_mark = ""
        if has_edited_col and pet["edited_at"]:
            edited_mark = f" [手動修正済み: {pet['edited_at']}]"
        place = pet["found_place"] if has_found_place_col and pet["found_place"] else "未入力"
        print(
            f"[{pet['id']}] {status_label} / 種類={pet['animal_type']} / "
            f"品種={pet['breed']} / 毛色={pet['coat_color']} / 首輪={collar} / "
            f"場所={place} / 登録日時={pet['created_at']} / 画像枚数={len(images)}{edited_mark}"
        )
        for img in images:
            print(f"    - {img['image_path']}")

    conn.close()


if __name__ == "__main__":
    main()
