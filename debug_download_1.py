# debug_download.py（追加バージョン）
import requests
from PIL import Image
import io
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# ↓もしrelink-apiフォルダの外(リポジトリルート)で実行するならこのパス調整は不要かも、
# common.pyがある場所に合わせて調整してね

import common  # ★common.pyのdownload_image_as_data_url()を直接呼んで確認する

url = "https://cdjilctcmrzyijttaqnu.supabase.co/storage/v1/object/public/pet-photos/f08d9f66-fe11-47c1-b9d0-724e8970ef9a_test.jpg"

# common.py側の関数をそのまま呼んでみる
data_url = common.download_image_as_data_url(url)

print("data URLの先頭100文字:", data_url[:100])
print("data URL全体の長さ:", len(data_url))

# data URLからbase64部分だけ取り出して、正しくデコードできるか確認
header, b64_part = data_url.split(",", 1)
import base64
decoded = base64.b64decode(b64_part)
print("デコード後のバイト数:", len(decoded))
print("デコード後の先頭16バイト:", decoded[:16])

# デコードしたものが画像として開けるか再確認
try:
    img = Image.open(io.BytesIO(decoded))
    print("✅ data URL経由でもPILで開けた！形式:", img.format)
except Exception as e:
    print("❌ data URL経由だと開けなかった:", e)