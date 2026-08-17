# tag.py と match_api.py で共通して使う処理をまとめたモジュール。
# AIによる特徴抽出、Supabaseとのやりとり（REST API経由）はここに集約する。
#
# 事前準備:
#   pip install openai python-dotenv requests
#   .env に SAKURA_AI_TOKEN / SUPABASE_URL / SUPABASE_KEY を設定する。
#
# 補足: SupabaseとのやりとりはPython公式SDK（supabaseパッケージ）を使わず、requestsで直接
# REST APIを呼んでいる。理由は、supabaseパッケージがSupabaseの新方式APIキー（sb_secret_...）を
# 使った際に、内部で Authorization: Bearer <secret key> というヘッダーも一緒に送ってしまい、
# Supabase側がそれをJWTとしてパースしようとして失敗 → 匿名ユーザー扱いになりRLS(Row Level
# Security)に弾かれる、という既知の不具合があるためです。Supabase公式も「新方式のキーは
# apikeyヘッダーのみで送り、Authorizationヘッダーには入れない」よう案内しています。

import base64
import json
import mimetypes
import os
import sys
import uuid

import requests
from dotenv import load_dotenv
from openai import OpenAI, OpenAIError

load_dotenv()

# --- Sakura AI (画像解析) ---

SAKURA_AI_TOKEN = os.environ.get("SAKURA_AI_TOKEN")
if not SAKURA_AI_TOKEN:
    sys.exit("SAKURA_AI_TOKEN が設定されていません。.env を用意してください（.env.example 参照）。")

client = OpenAI(
    api_key=SAKURA_AI_TOKEN,
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


def encode_image_bytes(data: bytes, filename: str) -> str:
    """画像バイト列を data URL (base64) に変換する。ファイルパス・アップロードファイルどちらにも使える。"""
    mime_type, _ = mimetypes.guess_type(filename)
    mime_type = mime_type or "image/jpeg"
    b64 = base64.b64encode(data).decode("utf-8")
    return f"data:{mime_type};base64,{b64}"


def encode_image_file(path: str) -> str:
    with open(path, "rb") as f:
        return encode_image_bytes(f.read(), path)


def extract_tags_from_encoded(encoded_images: list) -> tuple:
    """data URL形式にエンコード済みの画像リストをAIに渡し、(tags辞書, 生レスポンス文字列) を返す。
    tag.py（ファイルパスから）とmatch_api.py（アップロードされたバイト列から）の両方から共通で使う。"""
    content = [
        {
            "type": "text",
            "text": f"以下は同じ1匹のペットを撮影した{len(encoded_images)}枚の写真です。特徴をJSON形式で抽出してください。",
        }
    ]
    for encoded in encoded_images:
        content.append({"type": "image_url", "image_url": {"url": encoded}})

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
        raise RuntimeError(f"AI APIリクエストに失敗しました: {e}") from e

    message = response.choices[0].message
    finish_reason = response.choices[0].finish_reason

    if message.content is None:
        # 推論系モデルは思考過程(reasoning)を先に生成するため、
        # max_tokensが不足すると本文(content)が空のまま打ち切られることがある。
        reasoning = getattr(message, "reasoning_content", None)
        detail = f"finish_reason={finish_reason}"
        if reasoning:
            detail += f"\n--- reasoning_content (参考) ---\n{reasoning[:1000]}"
        raise RuntimeError(
            f"AIからの回答本文(content)が空でした。max_tokensが不足している可能性があります。\n{detail}"
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
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"AIの応答をJSONとして解析できませんでした。\n--- 応答内容 ---\n{raw_text}"
        ) from e

    return data, raw_text


def extract_tags_from_paths(image_paths: list) -> tuple:
    encoded = [encode_image_file(p) for p in image_paths]
    return extract_tags_from_encoded(encoded)


def extract_tags_from_uploads(files: list) -> tuple:
    """(filename, bytes) のタプルのリストを受け取るバージョン（API側のアップロードファイル用）。"""
    encoded = [encode_image_bytes(data, filename) for filename, data in files]
    return extract_tags_from_encoded(encoded)


# --- Supabase (REST API経由) ---

SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET", "pet-photos")

SUPABASE_ENABLED = bool(SUPABASE_URL and SUPABASE_KEY)


def require_supabase():
    if not SUPABASE_ENABLED:
        sys.exit(
            "SUPABASE_URL / SUPABASE_KEY が設定されていません。"
            "ローカルのデータベース保存は行わないため、.env にSupabaseの接続情報を設定してください。"
        )


def upload_photo_bytes_to_supabase(file_bytes: bytes, filename: str, status: str) -> str:
    """代表写真（1枚目）をSupabase Storageにアップロードし、公開URLを返す。
    foundpet_register/lostpet_registerはphoto_url列が1つしかないため、
    複数枚のうち1枚目だけを代表としてアップロードする。"""
    ext = os.path.splitext(filename)[1] or ".jpg"
    mime_type, _ = mimetypes.guess_type(filename)
    mime_type = mime_type or "image/jpeg"
    dest_path = f"{status}/{uuid.uuid4().hex}{ext}"

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


def upload_photo_to_supabase(image_path: str, status: str) -> str:
    with open(image_path, "rb") as f:
        file_bytes = f.read()
    return upload_photo_bytes_to_supabase(file_bytes, image_path, status)


def supabase_select(table: str, params: dict = None) -> list:
    """SupabaseのテーブルからGETで行を取得する（PostgREST経由）。"""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {"apikey": SUPABASE_KEY}
    response = requests.get(url, headers=headers, params=params or {"select": "*"}, timeout=30)
    if response.status_code >= 300:
        raise RuntimeError(f"取得失敗 (status={response.status_code}): {response.text}")
    return response.json()


def supabase_insert(table: str, payload: dict) -> None:
    insert_url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    response = requests.post(insert_url, headers=headers, json=payload, timeout=30)
    if response.status_code >= 300:
        raise RuntimeError(f"登録失敗 (status={response.status_code}): {response.text}")


def build_other_text(tags: dict) -> str:
    """Supabase側の"other"列（自由記述）用に、首輪の情報をまとめた文章を作る。"""
    if tags.get("has_collar"):
        return f"首輪あり（{tags.get('collar_features') or '詳細不明'}）"
    return "首輪なし"


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
