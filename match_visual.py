# 実行前に、準備として以下の2つを行ってください:
#   1. pip install openai python-dotenv
#   2. .env を作り、SAKURA_AI_TOKEN を記入
# 使い方:
#   python3 match_visual.py 迷子の写真1 [写真2 ...] [--min-score 70] [--top 5]
#   例: python3 match_visual.py lost_dog.jpg --min-score 70 --top 5
#
# match.py（毛色などのテキスト情報同士を文字列比較する方式）とは違い、
# こちらは迷子ペットの写真と、保護ペットそれぞれの写真をAIに直接見比べてもらい、
# 「同じ個体である可能性」をAI自身に判定させる方式です。
# 「茶色」「こげ茶色」のような表現のブレに強い一方、保護ペット1匹につき
# 1回ずつAIを呼び出すため、登録数が多いほど時間とAPI利用量がかかります。
# （このスクリプトはDBに何も登録しません。あくまで候補を調べるだけです）

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

SPECIES_SYSTEM_PROMPT = """あなたはペットの写真から動物の種類だけを判定するアシスタントです。
説明文やコードブロックの記号は一切付けず、以下のキーのみを持つJSONオブジェクトを出力してください。

{
  "animal_type": "犬 や 猫 など動物の種類（判別できない場合は \\"不明\\"）"
}
"""

COMPARE_SYSTEM_PROMPT = """あなたは2つの写真グループが同じ1匹の動物かどうかを判定する専門家です。
1つ目のグループは「行方不明のペット」の写真、2つ目のグループは「保護されたペット」の写真です。
毛色・模様・体格・顔立ち・耳や尻尾の形・首輪の特徴などを総合的に見て、
同一個体である可能性を判定してください。撮影角度や明るさの違いは考慮に入れて、
言葉の言い回しではなく見た目の特徴そのものを比較してください。

説明文やコードブロックの記号は一切付けず、以下のキーのみを持つJSONオブジェクトを出力してください。

{
  "similarity_score": 0から100の整数（同一個体である可能性が高いほど高い値）,
  "reason": "判断理由を日本語で一言（30文字程度）"
}
"""


def encode_image(path: str) -> str:
    mime_type, _ = mimetypes.guess_type(path)
    if mime_type is None:
        mime_type = "image/jpeg"
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime_type};base64,{b64}"


def call_ai(system_prompt: str, content: list) -> dict:
    try:
        response = client.chat.completions.create(
            model="preview/Kimi-K2.6",
            messages=[
                {"role": "system", "content": system_prompt},
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
        return json.loads(cleaned)
    except json.JSONDecodeError:
        sys.exit(f"AIの応答をJSONとして解析できませんでした。\n--- 応答内容 ---\n{raw_text}")


def detect_species(image_paths: list) -> str:
    content = [{"type": "text", "text": "この動物の種類を判定してください。"}]
    for path in image_paths:
        content.append({"type": "image_url", "image_url": {"url": encode_image(path)}})
    data = call_ai(SPECIES_SYSTEM_PROMPT, content)
    return (data.get("animal_type") or "不明").strip()


def compare_pets(lost_image_paths: list, candidate_image_paths: list) -> dict:
    content = [{"type": "text", "text": "【行方不明のペットの写真】"}]
    for path in lost_image_paths:
        content.append({"type": "image_url", "image_url": {"url": encode_image(path)}})
    content.append({"type": "text", "text": "【保護されたペットの写真】"})
    for path in candidate_image_paths:
        content.append({"type": "image_url", "image_url": {"url": encode_image(path)}})
    content.append({"type": "text", "text": "これらは同じ1匹の動物だと思いますか？JSON形式で回答してください。"})

    return call_ai(COMPARE_SYSTEM_PROMPT, content)


def main():
    parser = argparse.ArgumentParser(
        description="迷子ペットの写真と保護ペットの写真をAIに直接見比べさせて候補を探します（画像直接比較版）。"
    )
    parser.add_argument("images", nargs="+", help="迷子ペットの画像ファイルのパス（複数指定可）")
    parser.add_argument(
        "--min-score",
        type=int,
        default=70,
        help="この類似度未満の候補は表示しない（0〜100、デフォルト70）",
    )
    parser.add_argument("--top", type=int, default=5, help="表示する候補の最大件数（デフォルト5）")
    args = parser.parse_args()

    for path in args.images:
        if not os.path.isfile(path):
            sys.exit(f"画像ファイルが見つかりません: {path}")

    if not os.path.isfile(DB_PATH):
        sys.exit("pets.db が見つかりません。先に tag.py で保護ペットを登録してください。")

    print("迷子ペットの動物の種類を判定中...")
    lost_species = detect_species(args.images)
    print(f"  判定結果: {lost_species}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    protected_pets = conn.execute(
        "SELECT * FROM pets WHERE status = 'protected' ORDER BY id"
    ).fetchall()

    if not protected_pets:
        print("\n保護(protected)として登録されているペットがまだありません。")
        conn.close()
        return

    # 動物の種類が明確に違う場合は事前に除外し、無駄なAI呼び出しを減らす
    candidates = []
    for pet in protected_pets:
        pet_type = (pet["animal_type"] or "").strip()
        if lost_species not in ("不明", "") and pet_type not in ("不明", "") and lost_species != pet_type:
            continue
        candidates.append(pet)

    if not candidates:
        print("\n動物の種類が一致する候補が見つかりませんでした。")
        conn.close()
        return

    print(f"\n候補{len(candidates)}件について、写真を直接AIに見比べてもらいます...")

    results = []
    for i, pet in enumerate(candidates, 1):
        images = conn.execute(
            "SELECT image_path FROM pet_images WHERE pet_id = ? ORDER BY id",
            (pet["id"],),
        ).fetchall()
        candidate_paths = [os.path.join(BASE_DIR, img["image_path"]) for img in images]
        candidate_paths = [p for p in candidate_paths if os.path.isfile(p)]
        if not candidate_paths:
            continue

        print(f"  [{i}/{len(candidates)}] ペットID={pet['id']} を比較中...")
        comparison = compare_pets(args.images, candidate_paths)
        score = comparison.get("similarity_score", 0)
        reason = comparison.get("reason", "")
        results.append((score, pet, images, reason))

    conn.close()

    results.sort(key=lambda r: r[0], reverse=True)
    filtered_results = [r for r in results if r[0] >= args.min_score][: args.top]

    print(
        f"\n--- 候補一覧（比較対象{len(results)}件中、"
        f"類似度{args.min_score}以上の上位{args.top}件まで表示） ---"
    )
    if not filtered_results:
        print(f"類似度{args.min_score}以上の候補は見つかりませんでした。")
        print("ヒント: --min-score 0 --top 20 を試すと、全候補のスコアを確認できます。")
        return

    for score, pet, images, reason in filtered_results:
        collar = pet["collar_features"] if pet["has_collar"] else "なし"
        print(
            f"\n[候補] ペットID={pet['id']}  類似度スコア={score}/100\n"
            f"  種類={pet['animal_type']} / 品種={pet['breed']} / 毛色={pet['coat_color']} / 首輪={collar}\n"
            f"  AIの判断理由: {reason}"
        )
        for img in images:
            print(f"    画像: {img['image_path']}")

    print(
        "\n※ このスコアもあくまでAIによる目安です。上位の候補から実際の写真を見比べて、"
        "最終的な判断は人の目で行ってください。"
    )


if __name__ == "__main__":
    main()
