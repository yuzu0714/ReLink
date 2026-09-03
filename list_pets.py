# 使い方: python3 list_pets.py
# pets.db に登録されているペット一覧を表示する確認用スクリプトです。

# /// script
# requires-python = ">=3.10"
# ///
import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "pets.db")


def main():
    if not os.path.isfile(DB_PATH):
        print("まだ pets.db が作成されていません。先に tag_pet.py を実行してください。")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM pets ORDER BY id").fetchall()
    conn.close()

    if not rows:
        print("登録されているペットはまだありません。")
        return

    for row in rows:
        collar = row["collar_features"] if row["has_collar"] else "なし"
        status_label = "保護" if row["status"] == "protected" else "迷子"
        print(
            f"[{row['id']}] {status_label} / 種類={row['animal_type']} / "
            f"品種={row['breed']} / 毛色={row['coat_color']} / 首輪={collar} / "
            f"画像={row['image_path']} / 登録日時={row['created_at']}"
        )


if __name__ == "__main__":
    main()
