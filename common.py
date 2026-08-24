# tag.py と match_api.py で共通して使う処理をまとめたモジュール。
# AIによる特徴抽出はここに集約し、tag.py・match_api.py共通で使う。
# Supabaseとのやりとり（REST API経由）もここにまとめているが、
# 実際にSupabaseへアクセスするのはtag.pyのみ（match_api.pyは特徴抽出のみを行い、
# Supabaseへの直接アクセスは行わない）。
#
# 事前準備:
#   pip install openai python-dotenv requests
#   .env に SAKURA_AI_TOKEN を設定する。
#   （tag.pyを使う場合はさらに SUPABASE_URL / SUPABASE_KEY も設定する。match_api.pyには不要）
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


# --- 写真同士の類似度判定（POST /compare-photos で使用） ---
#
# 迷子側の写真群と、候補（保護側）の写真群を1回のAI呼び出しでまとめて見比べ、
# 「同じ1匹の可能性が高いか」を判定してもらう方式（match_visual.py方式）。
# 候補1件につきAI呼び出しは1回だけ（枚数が違っても、内側で全部まとめて渡すので
# 写真ごとにスコアを出して平均する、という処理は不要）。
#
# スコアは 0.0〜1.0 の小数（1.0に近いほど同一個体である可能性が高い）。
COMPARE_SYSTEM_PROMPT = """あなたは2つの写真グループが同じ1匹の動物かどうかを判定する専門家です。
1つ目のグループは「行方不明のペット」の写真、2つ目のグループは「保護されたペット」の写真です。
毛色・模様・体格・顔立ち・耳や尻尾の形・首輪の特徴などを総合的に見て、
同一個体である可能性を判定してください。撮影角度や明るさの違いは考慮に入れて、
言葉の言い回しではなく見た目の特徴そのものを比較してください。
それぞれのグループに複数枚の写真がある場合は、同じ1匹を別角度から撮影したものとして
まとめて扱い、判定は1つだけ出してください（写真ごとに別々の判定は不要です）。

説明文やコードブロックの記号は一切付けず、以下のキーのみを持つJSONオブジェクトを出力してください。

{
  "similarity_score": 0.0から1.0の小数（同一個体である可能性が高いほど1.0に近い値）,
  "reason": "判断理由を日本語で一言（30文字程度）"
}
"""


def download_image_as_data_url(url: str) -> str:
    """写真URL（Supabase Storageなどの公開URL）をダウンロードして、
    data URL（base64）に変換する。AIへは data URL の形で渡す。"""
    response = requests.get(url, timeout=30)
    if response.status_code >= 300:
        raise RuntimeError(f"写真のダウンロードに失敗しました (status={response.status_code}): {url}")
    filename = url.split("/")[-1].split("?")[0] or "photo.jpg"
    return encode_image_bytes(response.content, filename)


def compare_photo_urls(photo_urls: list, candidate_photo_urls: list) -> dict:
    """迷子側の写真URL群(photo_urls)と、候補側の写真URL群(candidate_photo_urls)を
    1回のAI呼び出しで直接見比べ、{"similarity_score": 0.0〜1.0, "reason": str} を返す。
    候補が複数いる場合は、この関数を候補ごとに1回ずつ呼ぶ想定（複数候補をまとめて渡さない）。"""
    content = [{"type": "text", "text": "【行方不明のペットの写真】"}]
    for url in photo_urls:
        content.append({"type": "image_url", "image_url": {"url": download_image_as_data_url(url)}})

    content.append({"type": "text", "text": "【保護されたペットの写真】"})
    for url in candidate_photo_urls:
        content.append({"type": "image_url", "image_url": {"url": download_image_as_data_url(url)}})

    content.append({"type": "text", "text": "これらは同じ1匹の動物だと思いますか？JSON形式で回答してください。"})

    try:
        response = client.chat.completions.create(
            model="preview/Kimi-K2.6",
            messages=[
                {"role": "system", "content": COMPARE_SYSTEM_PROMPT},
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

    # AIが万が一 0〜100 のスケールで返してしまった場合の保険（0.0〜1.0に補正する）
    score = data.get("similarity_score")
    if isinstance(score, (int, float)) and score > 1.0:
        data["similarity_score"] = score / 100.0

    return data


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
