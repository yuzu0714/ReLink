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
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
import mimetypes
import os
import random
import sys
import time
import io
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import BoundedSemaphore, Lock

import requests
from dotenv import load_dotenv
from io import BytesIO as _BytesIO  # SigLIP2で使用（既存のioインポートと区別）
from PIL import Image
from openai import OpenAI, OpenAIError, RateLimitError

load_dotenv()

# --- Sakura AI (画像解析) ---

SAKURA_AI_TOKEN = os.environ.get("SAKURA_AI_TOKEN")
if not SAKURA_AI_TOKEN:
    sys.exit("SAKURA_AI_TOKEN が設定されていません。.env を用意してください（.env.example 参照）。")

client = OpenAI(
    api_key=SAKURA_AI_TOKEN,
    base_url="https://api.ai.sakura.ad.jp/v1",
    max_retries=0,
)

# AI呼び出し・写真ダウンロード・候補処理に別々の上限を設け、処理を重ねつつ過負荷を防ぐ。
MAX_CONCURRENT_AI_REQUESTS = 2
MAX_CONCURRENT_PHOTO_DOWNLOADS = 4
MAX_CONCURRENT_MATCH_COMPARISONS = 4
AI_REQUEST_SEMAPHORE = BoundedSemaphore(MAX_CONCURRENT_AI_REQUESTS)
PHOTO_DOWNLOAD_SEMAPHORE = BoundedSemaphore(MAX_CONCURRENT_PHOTO_DOWNLOADS)
MATCH_COMPARISON_SEMAPHORE = BoundedSemaphore(MAX_CONCURRENT_MATCH_COMPARISONS)


def _call_ai_with_rate_limit_retry(request):
    max_attempts = 3
    for attempt in range(max_attempts):
        try:
            with AI_REQUEST_SEMAPHORE:
                return request()
        except RateLimitError as e:
            if attempt == max_attempts - 1:
                raise RuntimeError(f"AI APIリクエストに失敗しました: {e}") from e

            response = getattr(e, "response", None)
            headers = response.headers if response is not None else {}
            retry_after = headers.get("retry-after")
            try:
                wait = max(0.0, float(headers.get("retry-after-ms")) / 1000.0)
            except (TypeError, ValueError):
                try:
                    wait = max(0.0, float(retry_after))
                except (TypeError, ValueError):
                    try:
                        retry_at = parsedate_to_datetime(retry_after)
                        wait = max(0.0, (retry_at - datetime.now(timezone.utc)).total_seconds())
                    except (TypeError, ValueError, OverflowError):
                        wait = None

            if wait is None:
                wait = min(60.0, 5.0 * (2**attempt)) + random.uniform(0.0, 1.0)

            print(
                f"[AI] レート制限(429)。{wait:.1f}秒後にリトライ "
                f"({attempt + 1}/{max_attempts})",
                flush=True,
            )
            time.sleep(wait)
        except OpenAIError as e:
            raise RuntimeError(f"AI APIリクエストに失敗しました: {e}") from e


SYSTEM_PROMPT = """あなたはペットの写真を分析して特徴をJSON形式で出力するアシスタントです。
写真が複数枚渡された場合は、それらすべてが同じ1匹のペットを別の角度から撮影したものとして扱い、
すべての写真から得られる情報を統合して1匹分の特徴を出力してください。

説明文やコードブロックの記号（```）は一切付けず、必ず以下のキーを持つJSONオブジェクトのみを出力してください。

{
  "animal_type": "犬 や 猫 など動物の種類（判別できない場合は \\"不明\\"）",
  "breed": "犬種・猫種（判別できない、または雑種の場合は \\"不明\\" または \\"雑種\\"）",
  "coat_color": "毛色。必ず次の6つの中から一番近いものを選ぶこと（複数色の場合はカンマ区切りで2つまで）: 茶色, クリーム色, こげ茶色, 黒, 白, グレー",
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

    response = _call_ai_with_rate_limit_retry(
        lambda: client.chat.completions.create(
            model="preview/Kimi-K2.6",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": content},
            ],
            temperature=0,
            max_tokens=4096,
        )
    )

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
# SigLIP2-Base（AvitoTech/SigLIP2-Base-for-animal-identification）を使い、
# 2組の写真群から画像埋め込みベクトルを取得してコサイン類似度を計算する。
# LLMによる比較から置き換えたため、判定理由（reason）は返さない。
#
# 追加で必要なパッケージ:
#   pip install transformers torch

import importlib as _importlib

_siglip_processor = None
_siglip_model = None
_siglip_lock = Lock()


def _get_siglip():
    """SigLIP2モデルを遅延ロードして返す。初回呼び出し時のみHuggingFaceからダウンロードされる。"""
    global _siglip_processor, _siglip_model
    if _siglip_model is not None:
        return _siglip_processor, _siglip_model

    with _siglip_lock:
        if _siglip_model is not None:
            return _siglip_processor, _siglip_model

        try:
            _importlib.import_module("torch")
            transformers = _importlib.import_module("transformers")
        except ImportError as e:
            raise RuntimeError(
                f"SigLIP2の実行に必要なパッケージが見つかりません: {e}\n"
                "pip install transformers torch を実行してください。"
            ) from e

        model_name = "AvitoTech/SigLIP2-Base-for-animal-identification"
        print(f"[SigLIP2] モデルをロード中: {model_name}", flush=True)
        processor = transformers.AutoImageProcessor.from_pretrained(model_name)
        model = transformers.AutoModel.from_pretrained(model_name)
        model.eval()
        _siglip_processor = processor
        _siglip_model = model
        print("[SigLIP2] モデルのロード完了", flush=True)
        return _siglip_processor, _siglip_model


def _get_image_embedding(image_bytes: bytes):
    """画像バイト列から正規化済みの埋め込みベクトル（768次元）を返す。"""
    import torch
    import torch.nn.functional as F

    processor, model = _get_siglip()
    image = Image.open(_BytesIO(image_bytes)).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        outputs = model.get_image_features(**inputs)
    return F.normalize(outputs.pooler_output, dim=-1)  # shape: (1, 768)


def _average_embeddings(embeddings: list):
    """複数の埋め込みベクトルを平均して再正規化する（同一個体の複数枚写真に対応）。"""
    import torch
    import torch.nn.functional as F

    stacked = torch.stack(embeddings)          # (N, 1, 768)
    avg = stacked.mean(dim=0)                  # (1, 768)
    return F.normalize(avg, dim=-1)


def compare_photo_urls(photo_urls: list, candidate_photo_urls: list) -> dict:
    """迷子側の写真URL群と候補側の写真URL群からSigLIP2で埋め込みを取得し、
    コサイン類似度を similarity_score（0.0〜1.0）として返す。
    reason は使用しない（空文字を返す）。"""
    import torch

    def _download(url: str) -> bytes:
        resp = requests.get(url, timeout=60)
        if resp.status_code >= 300:
            raise RuntimeError(f"写真のダウンロードに失敗しました (status={resp.status_code}): {url}")
        return resp.content

    all_urls = list(photo_urls) + list(candidate_photo_urls)
    n_lost = len(photo_urls)

    # 全写真を並列ダウンロード（順序を保ったまま）
    with ThreadPoolExecutor(max_workers=min(len(all_urls), 8)) as executor:
        all_bytes = list(executor.map(_download, all_urls))

    lost_bytes = all_bytes[:n_lost]
    cand_bytes = all_bytes[n_lost:]

    # 埋め込みを取得して複数枚分を平均化
    lost_emb = _average_embeddings([_get_image_embedding(b) for b in lost_bytes])
    cand_emb = _average_embeddings([_get_image_embedding(b) for b in cand_bytes])

    # コサイン類似度（[-1, 1] → [0, 1] にスケーリング）
    cos_sim = float(torch.dot(lost_emb.squeeze(), cand_emb.squeeze()).item())
    score = max(0.0, min(1.0, (cos_sim + 1.0) / 2.0))

    return {"similarity_score": score, "reason": ""}


def download_photo_urls(photo_urls: list):
    """迷子ペットの写真URLをダウンロードし、SigLIP2の平均埋め込みベクトルを返す。
    バッチ比較の際に迷子側写真を一度だけダウンロード・計算して使い回すために使う。
    戻り値は _average_embeddings が返す Tensor（shape: (1, 768)）。"""

    def _download(url: str) -> bytes:
        with PHOTO_DOWNLOAD_SEMAPHORE:
            resp = requests.get(url, timeout=60)
        if resp.status_code >= 300:
            raise RuntimeError(
                f"写真のダウンロードに失敗しました (status={resp.status_code}): {url}"
            )
        return resp.content

    with ThreadPoolExecutor(max_workers=min(len(photo_urls), 8)) as executor:
        all_bytes = list(executor.map(_download, photo_urls))

    return _average_embeddings([_get_image_embedding(b) for b in all_bytes])


def compare_photo_urls_with_encoded_lost(lost_emb, candidate_photo_urls: list) -> dict:
    """事前計算済みの迷子ペット埋め込みベクトル（download_photo_urls の戻り値）と
    候補写真URLからコサイン類似度を返す。
    バッチ比較の際に迷子側の再ダウンロード・再計算を省くために使う。"""
    import torch

    def _download(url: str) -> bytes:
        with PHOTO_DOWNLOAD_SEMAPHORE:
            resp = requests.get(url, timeout=60)
        if resp.status_code >= 300:
            raise RuntimeError(
                f"写真のダウンロードに失敗しました (status={resp.status_code}): {url}"
            )
        return resp.content

    with ThreadPoolExecutor(max_workers=min(len(candidate_photo_urls), 8)) as executor:
        cand_bytes = list(executor.map(_download, candidate_photo_urls))

    cand_emb = _average_embeddings([_get_image_embedding(b) for b in cand_bytes])

    cos_sim = float(torch.dot(lost_emb.squeeze(), cand_emb.squeeze()).item())
    score = max(0.0, min(1.0, (cos_sim + 1.0) / 2.0))

    return {"similarity_score": score, "reason": ""}


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
    response = requests.post(upload_url, headers=headers, data=file_bytes, timeout=60)
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
    response = requests.post(insert_url, headers=headers, json=payload, timeout=60)
    if response.status_code >= 300:
        raise RuntimeError(f"登録失敗 (status={response.status_code}): {response.text}")


def build_other_text(tags: dict) -> str:
    """Supabase側の"other"列（自由記述）用に、首輪の情報をまとめた文章を作る。"""
    if tags.get("has_collar"):
        return f"首輪あり（{tags.get('collar_features') or '詳細不明'}）"
    return "首輪なし"