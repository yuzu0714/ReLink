# debug_download.py（両方チェック版）
import common
from PIL import Image
import io
import base64

urls = {
    "迷子側(lost, id=20)": "https://cdjilctcmrzyijttaqnu.supabase.co/storage/v1/object/public/pet-photos/bf013db7-47e5-478f-8555-9efb19766c18_test.jpg",
    "発見側(found, id=21)": "https://cdjilctcmrzyijttaqnu.supabase.co/storage/v1/object/public/pet-photos/f08d9f66-fe11-47c1-b9d0-724e8970ef9a_test.jpg",
}

for label, url in urls.items():
    print(f"\n=== {label} ===")
    print("URL:", url)
    try:
        data_url = common.download_image_as_data_url(url)
        header, b64_part = data_url.split(",", 1)
        decoded = base64.b64decode(b64_part)
        img = Image.open(io.BytesIO(decoded))
        print(f"✅ OK！形式:{img.format} サイズ:{img.size}")
    except Exception as e:
        print(f"❌ NG：{e}")