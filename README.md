# Pet Matching API

`match.py`（ローカルの`pets.db`を参照するCLIスクリプト）を、Supabaseの`foundpet_register`テーブルを直接参照するJSON APIに書き換えたものです。`match_visual.py`は削除済みという前提で、`match.py`の「犬種・毛色が一致するものを一覧で返す」ロジックだけを引き継いでいます。

## ファイル構成

- `common.py` : AI呼び出し（Sakura AI）とSupabase REST APIまわりの共通処理。`tag.py`・`match_api.py`の両方から使う。
- `tag.py` : 写真から特徴を抽出し、Supabaseの`foundpet_register`（保護）または`lostpet_register`（迷子）に登録するCLI（従来通り）。
- `match_api.py` : 迷子ペットの写真を受け取り、`foundpet_register`の中から犬種・毛色が一致する候補をJSONで返すAPIサーバー（新規）。

## セットアップ

```
pip install fastapi uvicorn python-multipart openai python-dotenv requests
```

`.env`に以下を設定（`tag.py`と共通）:

```
SAKURA_AI_TOKEN=...
SUPABASE_URL=...
SUPABASE_KEY=...
```

## 起動

```
uvicorn match_api:app --host 0.0.0.0 --port 8000
```

## エンドポイント

### GET /health

疎通確認用。

```json
{"status": "ok", "supabase_enabled": true}
```

### POST /match

迷子ペットの写真（1枚以上、multipart/form-data、フィールド名`photos`）を受け取り、`foundpet_register`から犬種・毛色が一致する候補をJSONで返す。

```
curl -X POST http://localhost:8000/match -F "photos=@lost_dog.jpg"
```

複数枚送る場合は`-F "photos=@a.jpg" -F "photos=@b.jpg"`のように同じフィールド名で繰り返す。

## レスポンス構造

```json
{
  "query": {
    "animal_type": "犬",
    "breed": "秋田犬",
    "coat_color": "茶色と白色",
    "has_collar": false,
    "collar_features": null
  },
  "total_candidates": 12,
  "matched_count": 2,
  "matches": [
    {
      "pet_id": 21,
      "table": "foundpet_register",
      "specie": "秋田犬",
      "color": "茶色と白色",
      "other": "首輪なし",
      "photo_url": "https://xxxx.supabase.co/storage/v1/object/public/pet-photos/protected/xxxx.jpg",
      "found_place": "徳島県阿南市",
      "found_date": "2026-08-17T15:04:05.123456",
      "created_at": "2026-08-17T06:04:06.000000+00:00"
    }
  ]
}
```

## 友達（Kotlin担当）から聞かれた5点への回答

1. **キー名**: `match_score`のような数値のスコアキーは無い。マッチした候補は`matches`配列の要素として返り、各要素に`pet_id`, `specie`(犬種・猫種), `color`(毛色), `other`(首輪情報など), `photo_url`, `found_place`, `found_date`, `created_at`を持つ。
2. **数値範囲**: スコアという概念自体が無い（犬種・毛色が一致するかどうかの二択判定のみ）。ドキュメントにあった「0〜1の小数」という前提は今回のロジックには存在しない。
3. **候補数**: 上限なし。犬種・毛色が一致した候補は全件`matches`に入る（`matched_count`で件数が分かる）。
4. **レスポンス全体の構造**: 配列そのままではなく、`{"query": ..., "total_candidates": ..., "matched_count": ..., "matches": [...]}`というオブジェクトの中に配列が入る形。
5. **マッチ相手の特定**: `pet_id`はSupabaseの`foundpet_register`テーブルの主キー(`id`)。候補は常に`foundpet_register`（発見者側）のみが対象で、`lostpet_register`側や、それ以外の保健所管理テーブルは今回の判定には出てこない（そもそも保健所側のテーブル・データはまだこのパイプラインに存在しない）。
