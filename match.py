# 実行前に、準備として以下の2つを行ってください:
#   1. pip install openai python-dotenv
#   2. .env を作り、SAKURA_AI_TOKEN を記入
# 使い方:
#   python3 match.py 迷子のペットの写真1 [写真2 写真3 ...]
#   例: python3 match.py lost_dog.jpg
#
# 迷子のペットの写真をAIで解析し、pets.db に登録されている「保護(protected)」
# ペットの一覧と特徴を比較して、似ている候補をペットIDのランキングで表示します。
# （このスクリプトはDBに何も登録しません。あくまで候補を調べるだけです）

# /// script
# requires-python = ">=3.10"
# dependencies = ["openai", "python-dotenv"]
# ///
import base64
import difflib
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


def text_similarity(a, b) -> float:
    """簡易的な文字列の類似度（0.0〜1.0）。どちらかが空なら0.5（判断材料なし）を返す。"""
    a = (a or "").strip()
    b = (b or "").strip()
    if not a or not b or a == "不明" or b == "不明":
        return 0.5
    if a == b:
        return 1.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def score_pet(lost_tags: dict, pet_row) -> float:
    lost_type = (lost_tags.get("animal_type") or "").strip()
    pet_type = (pet_row["animal_type"] or "").strip()

    # 動物の種類が両方はっきり分かっていて、かつ違う場合は候補から除外する
    if lost_type and pet_type and lost_type not in ("不明", "") and pet_type not in ("不明", ""):
        if lost_type != pet_type:
            return -1.0  # 除外マーカー

    breed_score = text_similarity(lost_tags.get("breed"), pet_row["breed"])
    color_score = text_similarity(lost_tags.get("coat_color"), pet_row["coat_color"])

    lost_has_collar = bool(lost_tags.get("has_collar"))
    pet_has_collar = bool(pet_row["has_collar"])
    collar_bool_score = 1.0 if lost_has_collar == pet_has_collar else 0.3

    collar_text_score = text_similarity(lost_tags.get("collar_features"), pet_row["collar_features"])

    # 重み付け合計（毛色・犬種を重視、首輪は情報として弱め）
    total = (
        breed_score * 0.35
        + color_score * 0.35
        + collar_bool_score * 0.10
        + collar_text_score * 0.20
    )
    return total


def main():
    if len(sys.argv) < 2:
        sys.exit("使い方: python3 match.py 写真1 [写真2 写真3 ...]")

    image_paths = sys.argv[1:]
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

    results = []
    for pet in protected_pets:
        score = score_pet(lost_tags, pet)
        if score < 0:
            continue  # 動物の種類が明確に異なる
        images = conn.execute(
            "SELECT image_path FROM pet_images WHERE pet_id = ? ORDER BY id",
            (pet["id"],),
        ).fetchall()
        results.append((score, pet, images))

    conn.close()

    results.sort(key=lambda r: r[0], reverse=True)

    MIN_SCORE = 0.8  # 類似度80%以上のみを候補とする
    MAX_RESULTS = 5  # 上位5件まで表示する
    filtered_results = [r for r in results if r[0] >= MIN_SCORE][:MAX_RESULTS]

    print(
        f"\n--- 候補一覧（保護ペット {len(protected_pets)}件中、"
        f"類似度{int(MIN_SCORE * 100)}%以上の上位{MAX_RESULTS}件まで表示） ---"
    )
    if not filtered_results:
        print(f"類似度{int(MIN_SCORE * 100)}%以上の候補は見つかりませんでした。")
        return

    for score, pet, images in filtered_results:
        collar = pet["collar_features"] if pet["has_collar"] else "なし"
        print(
            f"\n[候補] ペットID={pet['id']}  類似度スコア={score:.2f}\n"
            f"  種類={pet['animal_type']} / 品種={pet['breed']} / 毛色={pet['coat_color']} / 首輪={collar}"
        )
        for img in images:
            print(f"    画像: {img['image_path']}")

    print(
        "\n※ スコアはあくまで目安です。上位の候補から実際の写真を見比べて、"
        "最終的な判断は人の目で行ってください。"
    )


if __name__ == "__main__":
    main()
