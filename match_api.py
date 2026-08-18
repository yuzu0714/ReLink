# 迷子ペットの写真をAIで解析し、特徴（動物の種類・犬種猫種・毛色・首輪）だけをJSONで返すAPIサーバー。
#
# 仕様変更（友達からの依頼）:
#   これまでは foundpet_register を直接検索して候補一覧まで返していたが、
#   「Supabaseへのデータアクセスは Kotlin サーバーに一本化する」という設計方針に合わせ、
#   このAPIサーバーの役割は「写真から特徴を抽出すること」のみに変更した。
#   候補の検索・絞り込み（旧 total_candidates / matched_count / matches）はKotlin側で行う。
#   Supabaseへの直接アクセス（common.require_supabase / supabase_select など）はこのファイルからは
#   一切呼び出していない（service_role相当のSupabase接続情報はこのAPIサーバーは持たない）。
#
# 事前準備:
#   pip install fastapi uvicorn python-multipart openai python-dotenv requests
#   .env に SAKURA_AI_TOKEN を設定する（tag.pyと共通。Supabase関連の設定はこのAPIには不要）。
#
# 起動方法:
#   uvicorn match_api:app --host 0.0.0.0 --port 8000
#
# 使い方（例. curl）:
#   curl -X POST http://localhost:8000/extract-features -F "photos=@lost_dog.jpg"
#   写真は複数枚まとめて送信可能（同じ1匹を別角度から撮ったものとして扱う）。
#
# レスポンス（JSON）:
#   {
#     "animal_type": "犬",
#     "breed": "秋田犬",
#     "coat_color": "茶色と白色",
#     "has_collar": false,
#     "collar_features": null
#   }

from typing import List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

import common

app = FastAPI(title="Pet Feature Extraction API", version="2.0.0")


class ExtractedFeatures(BaseModel):
    animal_type: Optional[str] = None
    breed: Optional[str] = None
    coat_color: Optional[str] = None
    has_collar: bool = False
    collar_features: Optional[str] = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/extract-features", response_model=ExtractedFeatures)
async def extract_features(photos: List[UploadFile] = File(...)):
    if not photos:
        raise HTTPException(status_code=400, detail="photos が1枚も指定されていません。")

    files = []
    for photo in photos:
        data = await photo.read()
        if not data:
            raise HTTPException(status_code=400, detail=f"{photo.filename} が空のファイルです。")
        files.append((photo.filename or "photo.jpg", data))

    try:
        tags, _raw_text = common.extract_tags_from_uploads(files)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return ExtractedFeatures(**tags)
