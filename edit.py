# 使い方: python3 edit.py ペットID
#   例: python3 edit.py 2
#   (IDは list.py で確認できます)
#
# AIが抽出したタグ（動物の種類・犬種猫種・毛色・首輪の有無と特徴）を
# 手動で修正するための対話式スクリプトです。
# 各項目で、そのままでよければ何も入力せずEnterを押してください。

# /// script
# requires-python = ">=3.10"
# ///
import os
import sqlite3
import sys
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "pets.db")


def ensure_edited_at_column(conn):
    cols = [row[1] for row in conn.execute("PRAGMA table_info(pets)").fetchall()]
    if "edited_at" not in cols:
        conn.execute("ALTER TABLE pets ADD COLUMN edited_at TEXT")
        conn.commit()


def ask(label: str, current, hint: str = "") -> str:
    current_display = current if current not in (None, "") else "(未設定)"
    new_value = input(f"{label} [現在: {current_display}]{hint}: ").strip()
    return new_value if new_value else current


def main():
    if len(sys.argv) != 2:
        sys.exit("使い方: python3 edit.py ペットID\n(IDは list.py で確認できます)")

    try:
        pet_id = int(sys.argv[1])
    except ValueError:
        sys.exit("ペットIDは数字で指定してください。")

    if not os.path.isfile(DB_PATH):
        sys.exit("pets.db が見つかりません。先に tag.py で登録してください。")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    ensure_edited_at_column(conn)

    pet = conn.execute("SELECT * FROM pets WHERE id = ?", (pet_id,)).fetchone()
    if pet is None:
        sys.exit(f"ID={pet_id} のペットは見つかりませんでした。list.py で確認してください。")

    images = conn.execute(
        "SELECT image_path FROM pet_images WHERE pet_id = ? ORDER BY id",
        (pet_id,),
    ).fetchall()

    print(f"--- ペットID {pet_id} の現在の登録内容 ---")
    print(f"区分: {'保護' if pet['status'] == 'protected' else '迷子'}")
    print(f"画像: {', '.join(img['image_path'] for img in images) if images else '(なし)'}")
    print()
    print("修正する項目だけ新しい値を入力してEnter、そのままでよければ何も入力せずEnterを押してください。")
    print()

    animal_type = ask("動物の種類（犬・猫など）", pet["animal_type"])
    breed = ask("犬種・猫種", pet["breed"])
    coat_color = ask("毛色", pet["coat_color"])

    collar_input = ask(
        "首輪の有無",
        "あり" if pet["has_collar"] else "なし",
        "（「あり」または「なし」）",
    )
    has_collar = 1 if collar_input.strip() in ("あり", "yes", "y", "true", "1") else 0

    if has_collar:
        collar_features = ask("首輪の特徴（色・柄など）", pet["collar_features"])
    else:
        collar_features = None

    conn.execute(
        """
        UPDATE pets
        SET animal_type = ?, breed = ?, coat_color = ?, has_collar = ?, collar_features = ?, edited_at = ?
        WHERE id = ?
        """,
        (
            animal_type,
            breed,
            coat_color,
            has_collar,
            collar_features,
            datetime.now().isoformat(timespec="seconds"),
            pet_id,
        ),
    )
    conn.commit()
    conn.close()

    print("\n更新しました。")
    print(f"  種類: {animal_type}")
    print(f"  犬種/猫種: {breed}")
    print(f"  毛色: {coat_color}")
    if has_collar:
        print(f"  首輪: あり - {collar_features}")
    else:
        print("  首輪: なし")


if __name__ == "__main__":
    main()
