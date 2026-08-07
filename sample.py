# 実行前に、準備として以下の2つを行ってください:
#   1. pip install openai python-dotenv
#   2. .env を作り、SAKURA_AI_TOKEN を記入
# 使い方:
#   画像なし: python sample.py
#   画像あり: python sample.py path/to/image.jpg "この画像について教えてください"
# (uv を使う場合は依存関係が自動解決されるので 1. は不要: uv run sample.py)

# /// script
# requires-python = ">=3.10"
# dependencies = ["openai", "python-dotenv"]
# ///
import base64
import mimetypes
import os
import sys

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


def encode_image(path: str) -> str:
    """画像ファイルをbase64エンコードし、data URL形式の文字列にして返す"""
    mime_type, _ = mimetypes.guess_type(path)
    if mime_type is None:
        mime_type = "image/jpeg"
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime_type};base64,{b64}"


# コマンドライン引数: 第1引数=画像パス（省略可）, 第2引数=質問文（省略可）
image_path = sys.argv[1] if len(sys.argv) > 1 else None
question = sys.argv[2] if len(sys.argv) > 2 else "ペットの画像を・動物の種類・犬種や猫種・毛色・首輪の特徴（色や柄）など、特徴を簡潔に説明してください。"

if image_path:
    if not os.path.isfile(image_path):
        sys.exit(f"画像ファイルが見つかりません: {image_path}")
    user_content = [
        {"type": "text", "text": question},
        {
            "type": "image_url",
            "image_url": {"url": encode_image(image_path)},
        },
    ]
else:
    user_content = "Pythonについて説明してください。"

try:
    response = client.chat.completions.create(
        model="preview/Kimi-K2.6",
        messages=[
            {
                "role": "system",
                "content": "あなたは簡潔に説明するアシスタントです。",
            },
            {
                "role": "user",
                "content": user_content,
            },
        ],
        temperature=0,
        max_tokens=1000,
    )
except OpenAIError as e:
    sys.exit(f"API リクエストに失敗しました: {e}")

print(response.choices[0].message.content)
