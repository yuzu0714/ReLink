# 実行前に、準備として以下を行ってください:
#   1. pip install openai python-dotenv requests
#   2. .env を作り、SAKURA_AI_TOKEN を記入
#   3. .env に SUPABASE_URL と SUPABASE_KEY（secret key）を追記する。
#      （ローカルのデータベース保存は行わないため、Supabaseへの登録が必須です）

# 使い方:
#   python3 tag.py 写真1 [写真2 写真3 ...] [--status protected|lost] [--found-place 場所] [--phone 電話番号]
#   例（保護ペット）: python3 tag.py dog.jpg --status protected --found-place "徳島県阿南市"
#   例（迷子ペット）: python3 tag.py dog.jpg --status lost --found-place "徳島県阿南市" --phone "090-xxxx-xxxx"
#   複数枚指定すると、AIが同じ1匹のペットの写真としてまとめて解析し、
#   1匹分のタグを抽出します（角度が増えるほど精度が上がりやすくなります）。
#
# 実行すると: AIが画像（複数可）を解析し、動物の種類・犬種猫種・毛色・首輪の特徴を抽出します。
#
# 補足: SupabaseとのやりとりはPython公式SDK（supabaseパッケージ）を使わず、requestsで直接
# REST APIを呼んでいます。理由は、supabaseパッケージがSupabaseの新方式APIキー（sb_secret_...）を
# 使った際に、内部で Authorization: Bearer <secret key> というヘッダーも一緒に送ってしまい、
# Supabase側がそれをJWTとしてパースしようとして失敗 → 匿名ユーザー扱いになりRLS(Row Level
# Security)に弾かれる、という既知の不具合があるためです。Supabase公式も「新方式のキーは
# apikeyヘッダーのみで送り、Authorizationヘッダーには入れない」よう案内しています。

# /// script
# requires-python = ">=3.10"
# dependencies = ["openai", "python-dotenv", "requests"]
# ///
import argparse
import base64
import json
import mimetypes
import os
import sys
import uuid
from datetime import datetime

import requests
from dotenv import load_dotenv
from openai import OpenAI, OpenAIError

load_dotenv()

token = os.environ.get("SAKURA_AI_TOKEN")
if not token:
    sys.exit("SAKURA_AI_TOKEN が設定されていません。.env を用意してください（.env.example 参照）。")

client = OpenAI(
    api_key=token,
    base_url="https://api.ai.sakura.ad.jp/v1",
)

SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET", "pet-photos")

SUPABASE_ENABLED = bool(SUPABASE_URL and SUPABASE_KEY)
if not SUPABASE_ENABLED:
    sys.exit(
        "SUPABASE_URL / SUPABASE_KEY が設定されていません。"
        "ローカルのデータベース保存は行わないため、.env にSupabaseの接続情報を設定してください。"
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


def upload_photo_to_supabase(image_path: str, status: str) -> str:
    """代表写真（1枚目）をSupabase Storageにアップロードし、公開URLを返す。
    foundpet_register/lostpet_registerはphoto_url列が1つしかないため、
    複数枚のうち1枚目だけを代表としてアップロードする。

    supabaseパッケージ（公式SDK）は使わず、requestsで直接REST APIを呼ぶ。
    Authorizationヘッダーは付けず、apikeyヘッダーのみで認証する
    （Supabase新方式キーでの既知の不具合を避けるため。ファイル冒頭のコメント参照）。"""
    ext = os.path.splitext(image_path)[1] or ".jpg"
    mime_type, _ = mimetypes.guess_type(image_path)
    mime_type = mime_type or "image/jpeg"
    dest_path = f"{status}/{uuid.uuid4().hex}{ext}"

    with open(image_path, "rb") as f:
        file_bytes = f.read()

    upload_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{dest_path}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Content-Type": mime_type,
        "x-upsert": "true",
    }
    response = requests.post(upload_url, headers=headers, data=file_bytes, timeout=30)
    if response.status_code >= 300:
        raise RuntimeError(
            f"アップロード失敗 (status={response.status_code}): {response.text}"
        )

    return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{dest_path}"


def build_other_text(tags: dict) -> str:
    """Supabase側の"other"列（自由記述）用に、首輪の情報をまとめた文章を作る。"""
    if tags.get("has_collar"):
        return f"首輪あり（{tags.get('collar_features') or '詳細不明'}）"
    return "首輪なし"


def save_to_supabase(status: str, tags: dict, photo_url: str, place, phone) -> None:
    """foundpet_register（保護）またはlostpet_register（迷子）に1行登録する。
    ここが唯一の保存先のため、失敗時は例外を再送出して呼び出し元に伝える。"""
    other_text = build_other_text(tags)

    try:
        if status == "protected":
            table = "foundpet_register"
            payload = {
                    "photo_url": photo_url,
                    "found_place": place,
                    "found_date": datetime.now().isoformat(),
                    "specie": tags.get("breed"),
                    "color": tags.get("coat_color"),                        
                    "other": other_text,
                }
        else:
            table = "lostpet_register"
            payload = {
                "photo_url": photo_url,
                "phone_number": phone,
                "specie": tags.get("breed"),
                "color": tags.get("coat_color"),
                "other": other_text,
                "lost_place": place,
            }

        insert_url = f"{SUPABASE_URL}/rest/v1/{table}"
        headers = {
            "apikey": SUPABASE_KEY,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        response = requests.post(insert_url, headers=headers, json=payload, timeout=30)
        if response.status_code >= 300:
            raise RuntimeError(f"登録失敗 (status={response.status_code}): {response.text}")
        print(f"Supabaseの{table}に登録しました。")
    except Exception as e:
        sys.exit(f"Supabaseへの保存に失敗しました（他に保存先がないため中断します）: {e}")


def main():
    parser = argparse.ArgumentParser(description="ペット写真（複数可）からタグを抽出してSupabaseに保存します。")
    parser.add_argument("images", nargs="+", help="画像ファイルのパス（スペース区切りで複数指定可）")
    parser.add_argument(
        "--status",
        choices=["protected", "lost"],
        default="protected",
        help="protected: 保護したペット / lost: 迷子のペット（デフォルト: protected）",
    )
    parser.add_argument(
        "--found-place",
        default=None,
        help="保護された場所、または迷子になった場所（例: \"徳島県阿南市\"）。省略可。",
    )
    parser.add_argument(
        "--phone",
        default=None,
        help="--status lost の場合にSupabaseのlostpet_registerへ保存する飼い主の電話番号。",
    )
    args = parser.parse_args()

    for path in args.images:
        if not os.path.isfile(path):
            sys.exit(f"画像ファイルが見つかりません: {path}")

    if args.status == "lost" and not args.phone:
        sys.exit(
            "--status lost で登録するには --phone（飼い主の電話番号）が必須です"
            "（ローカル保存がないため、Supabaseへの登録が唯一の保存先です）。"
        )

    print(f"{len(args.images)}枚の画像をAIで解析中...")
    tags, raw_text = extract_tags(args.images)

    print(f"区分: {'保護 (protected)' if args.status == 'protected' else '迷子 (lost)'}")
    if args.found_place:
        print(f"場所: {args.found_place}")
    print(f"種類: {tags.get('animal_type')}")
    print(f"犬種/猫種: {tags.get('breed')}")
    print(f"毛色: {tags.get('coat_color')}")
    if tags.get("has_collar"):
        print(f"首輪: あり - {tags.get('collar_features')}")
    else:
        print("首輪: なし")

    # 写真のアップロードとテキスト情報の登録は互いに独立させる。
    # 写真アップロードが失敗しても、種類・毛色・電話番号などの情報は
    # 別途Supabaseに登録できるようにする（photo_urlは失敗時にNoneのまま送る）。
    photo_url = None
    try:
        print("Supabaseに代表写真をアップロード中...")
        photo_url = upload_photo_to_supabase(args.images[0], args.status)
    except Exception as e:
        print(
            f"警告: Supabaseへの写真アップロードに失敗しました。"
            f"写真なしでその他の情報だけをSupabaseに登録します: {e}\n"
            f"ヒント: Supabaseの「Storage」に \"{SUPABASE_BUCKET}\" という名前の"
            f"公開(Public)バケットが作成されているか確認してください。"
        )

    save_to_supabase(args.status, tags, photo_url, args.found_place, args.phone)


if __name__ == "__main__":
    main()