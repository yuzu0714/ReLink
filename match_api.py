# 迷子ペットの写真から、Supabaseの foundpet_register（保護ペット）の中から
# 犬種・毛色が一致する候補をJSONで返すAPIサーバー。
# 旧 match.py（ローカルのpets.dbを参照するCLIスクリプト）を置き換えるもの。
#
# 事前準備:
#   pip install fastapi uvicorn python-multipart openai python-dotenv requests
#   .env に SAKURA_AI_TOKEN / SUPABASE_URL / SUPABASE_KEY を設定する（tag.pyと共通）。
#
# 起動方法:
#   uvicorn match_api:app --host 0.0.0.0 --port 8000
#
# 使い方（例. curl）:
#   curl -X POST http://localhost:8000/match -F "photos=@lost_dog.jpg"
#   写真は複数枚まとめて送信可能（同じ1匹を別角度から撮ったものとして扱う）。
#
# レスポンス（JSON）の構造は、このファイル末尾のコメント、またはREADME側の説明を参照。

from typing import List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

import common

app = FastAPI(title="Pet Matching API", version="1.0.0")


class QueryTags(BaseModel):
    animal_type: Optional[str] = None
    breed: Optional[str] = None
    coat_color: Optional[str] = None
    has_collar: bool = False
    collar_features: Optional[str] = None


class MatchCandidate(BaseModel):
    pet_id: int
    table: str = "foundpet_register"
    specie: Optional[str] = None      # 犬種・猫種（tag.py側で "specie" 列に保存している値）
    color: Optional[str] = None       # 毛色
    other: Optional[str] = None       # 首輪の情報など自由記述
    photo_url: Optional[str] = None
    found_place: Optional[str] = None
    found_date: Optional[str] = None
    created_at: Optional[str] = None


class MatchResponse(BaseModel):
    query: QueryTags
    total_candidates: int
    matched_count: int
    matches: List[MatchCandidate]


@app.get("/health")
def health():
    return {"status": "ok", "supabase_enabled": common.SUPABASE_ENABLED}


@app.post("/match", response_model=MatchResponse)
async def match_pet(photos: List[UploadFile] = File(...)):
    if not photos:
        raise HTTPException(status_code=400, detail="photos が1枚も指定されていません。")

    common.require_supabase()

    files = []
    for photo in photos:
        data = await photo.read()
        if not data:
            raise HTTPException(status_code=400, detail=f"{photo.filename} が空のファイルです。")
        files.append((photo.filename or "photo.jpg", data))

    try:
        lost_tags, _raw_text = common.extract_tags_from_uploads(files)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    try:
        # foundpet_register（保護ペット）を全件取得し、breed・coat_colorが一致するものだけに絞り込む。
        # 件数の上限・足切り（閾値）は無く、一致した分だけすべて返す（旧match.pyと同じ方針）。
        found_rows = common.supabase_select("foundpet_register", params={"select": "*"})
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    matches = []
    for row in found_rows:
        breed_ok = common.values_match(lost_tags.get("breed"), row.get("specie"))
        color_ok = common.values_match(lost_tags.get("coat_color"), row.get("color"))
        # foundpet_registerには動物の種類(animal_type)を保存する列が無いため、
        # 犬種・猫種(specie)と毛色(color)の一致だけで候補を判定する。
        if breed_ok and color_ok:
            matches.append(
                MatchCandidate(
                    pet_id=row["id"],
                    specie=row.get("specie"),
                    color=row.get("color"),
                    other=row.get("other"),
                    photo_url=row.get("photo_url"),
                    found_place=row.get("found_place"),
                    found_date=row.get("found_date"),
                    created_at=row.get("created_at"),
                )
            )

    return MatchResponse(
        query=QueryTags(**lost_tags),
        total_candidates=len(found_rows),
        matched_count=len(matches),
        matches=matches,
    )


# --- レスポンスのJSON構造（friend向け参考） ---
#
# {
#   "query": {
#     "animal_type": "犬",
#     "breed": "秋田犬",
#     "coat_color": "茶色と白色",
#     "has_collar": false,
#     "collar_features": null
#   },
#   "total_candidates": 12,      # foundpet_registerの全件数
#   "matched_count": 2,          # 犬種・毛色が一致した件数
#   "matches": [
#     {
#       "pet_id": 21,            # foundpet_register.id（このAPIが候補として返すのは常にfoundpet_register側のみ）
#       "table": "foundpet_register",
#       "specie": "秋田犬",
#       "color": "茶色と白色",
#       "other": "首輪なし",
#       "photo_url": "https://xxxx.supabase.co/storage/v1/object/public/pet-photos/protected/xxxx.jpg",
#       "found_place": "徳島県阿南市",
#       "found_date": "2026-08-17T15:04:05.123456",
#       "created_at": "2026-08-17T06:04:06.000000+00:00"
#     }
#   ]
# }
#
# 数値のスコア（match_score / similarity など）は無い。犬種・毛色が一致するかどうかの
# 二択判定のみで、一致した候補をすべて（件数上限なし）返す。
