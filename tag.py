# 実行前に、準備として以下の2つを行ってください:
#   1. pip install openai python-dotenv
#   2. .env を作り、SAKURA_AI_TOKEN を記入
# 使い方:
#   python3 tag.py 写真1 [写真2 写真3 ...] [--status protected|lost]
#   例（1枚）: python3 tag.py dog.jpg --status protected
#   例（複数枚）: python3 tag.py front.jpg side.jpg collar.jpg --status protected
#   複数枚指定すると、AIが同じ1匹のペットの写真としてまとめて解析し、
#   1匹分のタグを抽出します（角度が増えるほど精度が上がりやすくなります）。
#
# 実行すると:
#   1. AI(Kimi-K2.6)が画像（複数可）を解析し、動物の種類・犬種猫種・毛色・首輪の特徴を抽出します。
#   2. すべての画像を images/protected/ または images/lost/ フォルダにコピーして保存します。
#   3. 抽出結果と画像パスを pets.db (SQLite) に保存します（1匹=pets 1行 + 画像は pet_images に複数行）。

# /// script
# requires-python = ">=3.10"
# dependencies = ["openai", "python-dotenv"]
# ///
import argparse
import base64
import json
import mimetypes
import os
import shutil
import sqlite3
import sys
import uuid
from datetime import datetime

from dotenv import load_dotenv
from openai import OpenAI, OpenAIError

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "pets.db")
IMAGES_DIR = os.path.join(BASE_DIR, "images")

token = os.environ.get("SAKURA_AI_TOKEN")
if not token:
    sys.exit("SAKURA_AI_TOKEN が設定されていません。.env を用意してください（.env.example 参照）。")

client = OpenAI(
    api_key=token,
    base_url="https://api.ai.sakura.ad.jp/v1",
)

SYSTEM_PROMPT = """あなたはペットの写真を分析して特徴をJSON形式で出力するアシスタントです。
写真が複数枚渡された場合は、それらすべてが同じ1匹のペットを別の角度から撮影したものとして扱い、
すべての写真から得られる情報を統合して1匹分の特徴を出力してください。

説明文やコードブロックの記号（```）は一切付けず、必ず以下のキーを持つJSONオブジェクトのみを出力してください。

{
  "animal_type": "犬 や 猫 など動物の種類（判別できない場合は \\"不明\\"）",
  "breed": "犬種・猫種（判別できない、または雑種の場合は \\"不明\\" または \\"雑種\\"）",
  "coat_color": "毛色（例: 茶色、白黒 など）",
  "has_collar": true または false（いずれかの写真で首輪が確認できるか）,
  "collar_features": "首輪の色や柄の説明（首輪がない場合は null）"
}
"""


def encode_image(path: str) -> str:
    mime_type, _ = mimetypes.guess_type(path)
    if mime_type is None:
        mime_type = "image/jpeg"
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime_type};base64,{b64}"


def extract_tags(image_paths: list):
    content = [
        {
            "type": "text",
            "text": f"以下は同じ1匹のペットを撮影した{len(image_paths)}枚の写真です。特徴をJSON形式で抽出してください。",
        }
    ]
    for path in image_paths:
        content.append({"type": "image_url", "image_url": {"url": encode_image(path)}})

    try:
        response = client.chat.completions.create(
            model="preview/Kimi-K2.6",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": content},
            ],
            temperature=0,
            max_tokens=4096,
        )
    except OpenAIError as e:
        sys.exit(f"API リクエストに失敗しました: {e}")

    message = response.choices[0].message
    finish_reason = response.choices[0].finish_reason

    if message.content is None:
        # 推論系モデルは思考過程(reasoning)を先に生成するため、
        # max_tokensが不足すると本文(content)が空のまま打ち切られることがある。
        reasoning = getattr(message, "reasoning_content", None)
        detail = f"finish_reason={finish_reason}"
        if reasoning:
            detail += f"\n--- reasoning_content (参考) ---\n{reasoning[:1000]}"
        sys.exit(
            "AIからの回答本文(content)が空でした。max_tokensが不足している可能性があります。"
            f"\n{detail}"
        )

    raw_text = message.content.strip()

    cleaned = raw_text
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else ""
    cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        sys.exit(f"AIの応答をJSONとして解析できませんでした。\n--- 応答内容 ---\n{raw_text}")

    return data, raw_text


def create_tables(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            status TEXT NOT NULL CHECK(status IN ('protected', 'lost')),
            animal_type TEXT,
            breed TEXT,
            coat_color TEXT,
            has_collar INTEGER,
            collar_features TEXT,
            raw_response TEXT,
            created_at TEXT NOT NULL,
            edited_at TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pet_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pet_id INTEGER NOT NULL REFERENCES pets(id),
            image_path TEXT NOT NULL
        )
        """
    )
    conn.commit()


def migrate_legacy_schema(conn):
    """1匹=1行=1画像だった旧バージョンのpets.dbを、
    pets(1匹1行) + pet_images(画像複数行)の新しい構造に移行する。"""
    cols = [row[1] for row in conn.execute("PRAGMA table_info(pets)").fetchall()]
    if "image_path" not in cols:
        return  # すでに新しい構造

    print("旧形式のデータベースを検出しました。新しい構造に移行します...")
    conn.execute("ALTER TABLE pets RENAME TO pets_old")
    create_tables(conn)

    old_rows = conn.execute("SELECT * FROM pets_old").fetchall()
    old_cols = [row[1] for row in conn.execute("PRAGMA table_info(pets_old)").fetchall()]

    for row in old_rows:
        row_dict = dict(zip(old_cols, row))
        cur = conn.execute(
            """
            INSERT INTO pets (status, animal_type, breed, coat_color, has_collar, collar_features, raw_response, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row_dict["status"],
                row_dict["animal_type"],
                row_dict["breed"],
                row_dict["coat_color"],
                row_dict["has_collar"],
                row_dict["collar_features"],
                row_dict["raw_response"],
                row_dict["created_at"],
            ),
        )
        new_pet_id = cur.lastrowid
        conn.execute(
            "INSERT INTO pet_images (pet_id, image_path) VALUES (?, ?)",
            (new_pet_id, row_dict["image_path"]),
        )

    conn.execute("DROP TABLE pets_old")
    conn.commit()
    print(f"移行が完了しました（{len(old_rows)}件）。")


def ensure_edited_at_column(conn):
    """edited_at列がまだ無い既存DB（このカラムを追加する前に作られたもの）に列を追加する。"""
    cols = [row[1] for row in conn.execute("PRAGMA table_info(pets)").fetchall()]
    if "edited_at" not in cols:
        conn.execute("ALTER TABLE pets ADD COLUMN edited_at TEXT")
        conn.commit()


def init_db():
    conn = sqlite3.connect(DB_PATH)
    create_tables(conn)
    migrate_legacy_schema(conn)
    ensure_edited_at_column(conn)
    return conn


def save_image(image_path: str, status: str) -> str:
    dest_dir = os.path.join(IMAGES_DIR, status)
    os.makedirs(dest_dir, exist_ok=True)
    ext = os.path.splitext(image_path)[1]
    new_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(dest_dir, new_name)
    shutil.copy2(image_path, dest_path)
    return os.path.relpath(dest_path, BASE_DIR)


def main():
    parser = argparse.ArgumentParser(description="ペット写真（複数可）からタグを抽出してDBに保存します。")
    parser.add_argument("images", nargs="+", help="画像ファイルのパス（スペース区切りで複数指定可）")
    parser.add_argument(
        "--status",
        choices=["protected", "lost"],
        default="protected",
        help="protected: 保護したペット / lost: 迷子のペット（デフォルト: protected）",
    )
    args = parser.parse_args()

    for path in args.images:
        if not os.path.isfile(path):
            sys.exit(f"画像ファイルが見つかりません: {path}")

    print(f"{len(args.images)}枚の画像をAIで解析中...")
    tags, raw_text = extract_tags(args.images)

    conn = init_db()
    cur = conn.execute(
        """
        INSERT INTO pets (status, animal_type, breed, coat_color, has_collar, collar_features, raw_response, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            args.status,
            tags.get("animal_type"),
            tags.get("breed"),
            tags.get("coat_color"),
            1 if tags.get("has_collar") else 0,
            tags.get("collar_features"),
            raw_text,
            datetime.now().isoformat(timespec="seconds"),
        ),
    )
    pet_id = cur.lastrowid

    saved_paths = []
    for path in args.images:
        saved_path = save_image(path, args.status)
        saved_paths.append(saved_path)
        conn.execute(
            "INSERT INTO pet_images (pet_id, image_path) VALUES (?, ?)",
            (pet_id, saved_path),
        )

    conn.commit()
    conn.close()

    print("登録が完了しました。")
    print(f"  ペットID: {pet_id}")
    print(f"  区分: {'保護 (protected)' if args.status == 'protected' else '迷子 (lost)'}")
    print(f"  種類: {tags.get('animal_type')}")
    print(f"  犬種/猫種: {tags.get('breed')}")
    print(f"  毛色: {tags.get('coat_color')}")
    if tags.get("has_collar"):
        print(f"  首輪: あり - {tags.get('collar_features')}")
    else:
        print("  首輪: なし")
    print(f"  保存した画像: {len(saved_paths)}枚")
    for saved_path in saved_paths:
        print(f"    - {saved_path}")


if __name__ == "__main__":
    main()
