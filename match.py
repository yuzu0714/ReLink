# 実行前に、準備として以下の2つを行ってください:
#   1. pip install openai python-dotenv
#   2. .env を作り、SAKURA_AI_TOKEN を記入
# 使い方:
#   python3 match.py 迷子のペットの写真（複数枚可能）
#   例: python3 match.py lost_dog.jpg lost_dog_2.jpg
#
# 迷子のペットの写真をAIで解析し、pets.db に登録されている「保護(protected)」
# ペットの中から、動物の種類・犬種猫種・毛色が一致する候補を一覧表示します。
# （スコアによるランキングではなく、一致するものだけを表示するシンプルな方式です）

# /// script
# requires-python = ">=3.10"
# dependencies = ["openai", "python-dotenv"]
# ///
import argparse
import base64
import json
import mimetypes
import os
import sqlite3
import sys

from dotenv import load_dotenv
from openai import OpenAI, OpenAIError

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "pets.db")

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

    return data


def values_match(a, b) -> bool:
    """ゆるやかな一致判定。前後の空白を除いたうえで、
    完全一致、またはどちらかがもう一方を文字列として含んでいれば一致とみなす。
    どちらかが空・不明の場合は「一致」とはみなさない（判断材料が無いため）。"""
    a = (a or "").strip()
    b = (b or "").strip()
    if not a or not b or a in ("不明", "") or b in ("不明", ""):
        return False
    if a == b:
        return True
    return a in b or b in a


def is_candidate(lost_tags: dict, pet_row) -> bool:
    lost_type = (lost_tags.get("animal_type") or "").strip()
    pet_type = (pet_row["animal_type"] or "").strip()

    # 動物の種類が両方はっきり分かっていて、かつ違う場合は候補から除外する
    if lost_type and pet_type and lost_type not in ("不明", "") and pet_type not in ("不明", ""):
        if lost_type != pet_type:
            return False

    breed_ok = values_match(lost_tags.get("breed"), pet_row["breed"])
    color_ok = values_match(lost_tags.get("coat_color"), pet_row["coat_color"])

    # 犬種・猫種と毛色の両方が一致するものだけを候補とする
    return breed_ok and color_ok


def main():
    parser = argparse.ArgumentParser(
        description="迷子ペットの写真から、犬種・猫種と毛色が一致する保護ペットを探します。"
    )
    parser.add_argument("images", nargs="+", help="迷子ペットの画像ファイルのパス（複数指定可）")
    args = parser.parse_args()

    image_paths = args.images
    for path in image_paths:
        if not os.path.isfile(path):
            sys.exit(f"画像ファイルが見つかりません: {path}")

    if not os.path.isfile(DB_PATH):
        sys.exit("pets.db が見つかりません。先に tag.py で保護ペットを登録してください。")

    print(f"{len(image_paths)}枚の画像をAIで解析中...")
    lost_tags = extract_tags(image_paths)

    print("\n--- 入力した迷子ペットの特徴（AI抽出） ---")
    print(f"  種類: {lost_tags.get('animal_type')}")
    print(f"  犬種/猫種: {lost_tags.get('breed')}")
    print(f"  毛色: {lost_tags.get('coat_color')}")
    if lost_tags.get("has_collar"):
        print(f"  首輪: あり - {lost_tags.get('collar_features')}")
    else:
        print("  首輪: なし")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    protected_pets = conn.execute(
        "SELECT * FROM pets WHERE status = 'protected' ORDER BY id"
    ).fetchall()

    if not protected_pets:
        print("\n保護(protected)として登録されているペットがまだありません。")
        conn.close()
        return

    candidates = []
    for pet in protected_pets:
        if is_candidate(lost_tags, pet):
            images = conn.execute(
                "SELECT image_path FROM pet_images WHERE pet_id = ? ORDER BY id",
                (pet["id"],),
            ).fetchall()
            candidates.append((pet, images))

    conn.close()

    print(
        f"\n--- 候補一覧（保護ペット {len(protected_pets)}件中、"
        f"犬種・毛色が一致した{len(candidates)}件） ---"
    )
    if not candidates:
        print("犬種・毛色が一致する候補は見つかりませんでした。")
        return

    for pet, images in candidates:
        collar = pet["collar_features"] if pet["has_collar"] else "なし"
        pet_cols = pet.keys()
        place = pet["found_place"] if "found_place" in pet_cols and pet["found_place"] else "未入力"
        print(
            f"\n[候補] ペットID={pet['id']}\n"
            f"  種類={pet['animal_type']} / 品種={pet['breed']} / 毛色={pet['coat_color']} / "
            f"首輪={collar} / 場所={place}"
        )
        for img in images:
            print(f"    画像: {img['image_path']}")

    print(
        "\n※ 犬種・毛色の一致だけを見ています。上位の候補から実際の写真を見比べて、"
        "最終的な判断は人の目で行ってください。"
    )


if __name__ == "__main__":
    main()
