# 実行前に、準備として以下の2つを行ってください:
#   1. pip install openai python-dotenv
#   2. .env を作り、SAKURA_AI_TOKEN を記入
# 使い方:
#   python3 tag_pet.py 写真のパス [--status protected|lost]
#   例: python3 tag_pet.py dog.jpg --status protected
#   (--status を省略すると protected（保護したペット）として登録されます)
#
# 実行すると:
#   1. AI(Kimi-K2.6)が画像を解析し、動物の種類・犬種猫種・毛色・首輪の特徴を抽出します。
#   2. 画像を images/protected/ または images/lost/ フォルダにコピーして保存します。
#   3. 抽出結果を pets.db (SQLite) に保存します。

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
説明文やコードブロックの記号（```）は一切付けず、必ず以下のキーを持つJSONオブジェクトのみを出力してください。

{
  "animal_type": "犬 や 猫 など動物の種類（判別できない場合は \\"不明\\"）",
  "breed": "犬種・猫種（判別できない、または雑種の場合は \\"不明\\" または \\"雑種\\"）",
  "coat_color": "毛色（例: 茶色、白黒 など）",
  "has_collar": true または false（首輪をしているかどうか）,
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


def extract_tags(image_path: str):
    try:
        response = client.chat.completions.create(
            model="preview/Kimi-K2.6",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "この画像のペットの特徴をJSON形式で抽出してください。"},
                        {"type": "image_url", "image_url": {"url": encode_image(image_path)}},
                    ],
                },
            ],
            temperature=0,
            max_tokens=500,
        )
    except OpenAIError as e:
        sys.exit(f"API リクエストに失敗しました: {e}")

    raw_text = response.choices[0].message.content.strip()

    # ```json ... ``` のようにコードブロックで返ってきた場合に備えて除去する
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


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            status TEXT NOT NULL CHECK(status IN ('protected', 'lost')),
            image_path TEXT NOT NULL,
            animal_type TEXT,
            breed TEXT,
            coat_color TEXT,
            has_collar INTEGER,
            collar_features TEXT,
            raw_response TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def save_image(image_path: str, status: str) -> str:
    dest_dir = os.path.join(IMAGES_DIR, status)
    os.makedirs(dest_dir, exist_ok=True)
    ext = os.path.splitext(image_path)[1]
    new_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(dest_dir, new_name)
    shutil.copy2(image_path, dest_path)
    # DBにはプロジェクトルートからの相対パスで保存する
    return os.path.relpath(dest_path, BASE_DIR)


def main():
    parser = argparse.ArgumentParser(description="ペット写真からタグを抽出してDBに保存します。")
    parser.add_argument("image", help="画像ファイルのパス")
    parser.add_argument(
        "--status",
        choices=["protected", "lost"],
        default="protected",
        help="protected: 保護したペット / lost: 迷子のペット（デフォルト: protected）",
    )
    args = parser.parse_args()

    if not os.path.isfile(args.image):
        sys.exit(f"画像ファイルが見つかりません: {args.image}")

    print("AIで画像を解析中...")
    tags, raw_text = extract_tags(args.image)

    saved_image_path = save_image(args.image, args.status)

    conn = init_db()
    conn.execute(
        """
        INSERT INTO pets (status, image_path, animal_type, breed, coat_color, has_collar, collar_features, raw_response, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            args.status,
            saved_image_path,
            tags.get("animal_type"),
            tags.get("breed"),
            tags.get("coat_color"),
            1 if tags.get("has_collar") else 0,
            tags.get("collar_features"),
            raw_text,
            datetime.now().isoformat(timespec="seconds"),
        ),
    )
    conn.commit()
    conn.close()

    print("登録が完了しました。")
    print(f"  区分: {'保護 (protected)' if args.status == 'protected' else '迷子 (lost)'}")
    print(f"  種類: {tags.get('animal_type')}")
    print(f"  犬種/猫種: {tags.get('breed')}")
    print(f"  毛色: {tags.get('coat_color')}")
    if tags.get("has_collar"):
        print(f"  首輪: あり - {tags.get('collar_features')}")
    else:
        print("  首輪: なし")
    print(f"  保存先画像: {saved_image_path}")


if __name__ == "__main__":
    main()
