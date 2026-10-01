#!/usr/bin/env python3
"""
徳島県動物愛護管理センター 保護犬データ 自動登録スクリプト
----------------------------------------------------------
データ取得元: https://douai-tokushima.com
登録先: ReLink Supabase データベース

実行方法:
  pip3 install psycopg2-binary
  python3 tokushima_register.py

注意: インターネット接続（Supabase接続）が必要です。
"""

import psycopg2
import psycopg2.extras
from datetime import datetime, timezone

# ---- 接続設定 ----
DB_URL = "postgresql://postgres.cdjilctcmrzyijttaqnu:ReLinkDataBase@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

# ---- スクレイピング済み データ（2026年9月21日取得）----
# 徳島県動物愛護管理センター 収容中の犬（list1）
STRAY_DOGS = [
    {
        "found_place": "徳島県阿波市阿波町下喜来南",
        "found_date": "2026-09-18T00:00:00",
        "specie": "雑種",
        "color": "黒白",
        "other": "【徳島県動物愛護管理センター 収容】近隣住民の方からご連絡を受け、18日センターに収容。推定年齢：若犬 体格：小型",
        "photos": [
            "https://douai-tokushima.com/animalinfo/list1_1/photo/photo2-17897180980.JPG",
        ],
    },
    {
        "found_place": "徳島県三好市三野町勢力",
        "found_date": "2026-09-18T00:00:00",
        "specie": "雑種",
        "color": "黒",
        "other": "【徳島県動物愛護管理センター 収容】14日近隣住民よりご連絡、警察が収容→保健所→センター収容（18日）。推定年齢：成犬 体格：小型 赤の布首輪・チェーン付き",
        "photos": [
            "https://douai-tokushima.com/animalinfo/list1_1/photo/photo2-17897094880.JPG",
        ],
    },
    {
        "found_place": "徳島県板野郡板野町犬伏字平山",
        "found_date": "2026-09-17T00:00:00",
        "specie": "雑種",
        "color": "茶色",
        "other": "【徳島県動物愛護管理センター 収容】近隣住民よりご連絡、役場が収容→17日センター収容。複数頭：左4匹オス・右1匹メス。推定年齢：若犬 体格：小型",
        "photos": [
            "https://douai-tokushima.com/animalinfo/list1_1/photo/photo2-17896308840.JPG",
        ],
    },
    {
        "found_place": "徳島県（保健所保護）",
        "found_date": "2026-09-15T00:00:00",
        "specie": "雑種",
        "color": "茶白",
        "other": "【徳島県動物愛護管理センター 収容】保健所から収容依頼。推定年齢：成犬 体格：中型",
        "photos": [
            "https://douai-tokushima.com/animalinfo/list1_2/photo/photo2-17810694790.JPG",
        ],
    },
    {
        "found_place": "徳島県（保健所保護）",
        "found_date": "2026-09-05T00:00:00",
        "specie": "雑種",
        "color": "黒茶",
        "other": "【徳島県動物愛護管理センター 収容】保健所から収容依頼。推定年齢：成犬",
        "photos": [
            "https://douai-tokushima.com/animalinfo/list1_2/photo/photo2-17785610980.jpg",
        ],
    },
]

# 徳島県動物愛護管理センター 譲渡可能な犬（list4）
TRANSFER_DOGS = [
    {
        "found_place": "徳島県（動物愛護管理センター）",
        "found_date": "2025-07-01T00:00:00",
        "specie": "雑種",
        "color": "白",
        "other": "【徳島県 譲渡可能犬】管理番号 D250299 愛称：グル。メス（避妊手術済）。譲渡可能日：2026年9月19日以降。真っ白の毛並みが特徴的なとっても怖がりな女の子。慣れると全力で喜びを表現してくれる。お散歩大好き。愛嬌★★☆ やんちゃさ★★☆ 慎重さ★★★",
        "photos": [
            "https://douai-tokushima.com/animalinfo/list4_1/photo/photo2-17888502530.JPG",
            "https://douai-tokushima.com/animalinfo/list4_1/photo/photo3-17888502530.JPG",
            "https://douai-tokushima.com/animalinfo/list4_1/photo/photo4-17888502530.JPG",
        ],
    },
    {
        "found_place": "徳島県（動物愛護管理センター）",
        "found_date": "2026-01-25T00:00:00",
        "specie": "雑種",
        "color": "茶",
        "other": "【徳島県 譲渡可能犬】管理番号 D260010 愛称：璃大（りた）。オス（去勢手術済）。譲渡可能日：2026年9月19日以降。毛並みが柔らかく艶があり耳がピンと立った怖がりな男の子。慣れると足にくっついて甘えてくる。愛嬌★★☆ やんちゃさ★★☆ 慎重さ★★★",
        "photos": [
            "https://douai-tokushima.com/animalinfo/list4_1/photo/photo2-17888501290.JPG",
            "https://douai-tokushima.com/animalinfo/list4_1/photo/photo3-17888501290.JPG",
        ],
    },
    {
        "found_place": "徳島県（動物愛護管理センター）",
        "found_date": "2026-05-15T00:00:00",
        "specie": "雑種",
        "color": "茶白",
        "other": "【徳島県 譲渡可能犬】管理番号 D260149 愛称：ソフィー。メス（避妊手術済）。譲渡可能日：2026年9月8日以降。ちょっと怖がりだが色んなことに興味津々の元気いっぱいな女の子。環境変化への順応力あり。愛嬌★★★ やんちゃさ★★☆ 人懐こさ★★★",
        "photos": [
            "https://douai-tokushima.com/animalinfo/list4_1/photo/photo2-17882423620.JPG",
            "https://douai-tokushima.com/animalinfo/list4_1/photo/photo3-17882423620.JPG",
        ],
    },
    {
        "found_place": "徳島県（動物愛護管理センター）",
        "found_date": "2026-07-01T00:00:00",
        "specie": "雑種",
        "color": "黒白",
        "other": "【徳島県 譲渡可能犬】管理番号 D260201。譲渡可能日：2026年9月19日以降。",
        "photos": [
            "https://douai-tokushima.com/animalinfo/list4_2/photo/photo2-17894543740.JPG",
            "https://douai-tokushima.com/animalinfo/list4_2/photo/photo3-17894543740.JPG",
        ],
    },
    {
        "found_place": "徳島県（動物愛護管理センター）",
        "found_date": "2026-08-01T00:00:00",
        "specie": "雑種",
        "color": "茶",
        "other": "【徳島県 譲渡可能犬】管理番号 D260250。譲渡可能日：2026年9月19日以降。",
        "photos": [
            "https://douai-tokushima.com/animalinfo/list4_2/photo/photo2-17894544410.JPG",
        ],
    },
    {
        "found_place": "徳島県（動物愛護管理センター）",
        "found_date": "2026-09-01T00:00:00",
        "specie": "雑種",
        "color": "白茶",
        "other": "【徳島県 譲渡可能犬】管理番号 D260301。譲渡可能日：2026年9月19日以降。",
        "photos": [
            "https://douai-tokushima.com/animalinfo/list4_2/photo/photo2-17899694830.JPG",
        ],
    },
]

ALL_DOGS = STRAY_DOGS + TRANSFER_DOGS


def insert_pet(cur, dog):
    """rescued_pet を1件登録し、IDを返す"""
    cur.execute(
        """
        INSERT INTO rescuedpet_register
            (found_place, found_date, specie, color, other, created_at)
        VALUES (%s, %s::timestamp, %s, %s, %s, NOW())
        RETURNING id
        """,
        (
            dog["found_place"],
            dog["found_date"],
            dog["specie"],
            dog["color"],
            dog["other"],
        ),
    )
    return cur.fetchone()[0]


def insert_photos(cur, pet_id, photo_urls):
    """pet_photos に写真URLを登録する"""
    for i, url in enumerate(photo_urls):
        cur.execute(
            """
            INSERT INTO pet_photos (pet_source, pet_id, photo_url, sort_order)
            VALUES ('rescued', %s, %s, %s)
            """,
            (pet_id, url, i),
        )


def main():
    print("=" * 60)
    print("徳島県 保護犬データ登録スクリプト")
    print("=" * 60)
    print(f"登録予定件数: {len(ALL_DOGS)} 件")
    print()

    try:
        con = psycopg2.connect(DB_URL, connect_timeout=15)
        con.autocommit = False
        cur = con.cursor()
        print("✅ Supabase 接続成功")
    except Exception as e:
        print(f"❌ 接続失敗: {e}")
        print("\n--- ヒント ---")
        print("インターネット接続を確認し、もう一度試してください。")
        return

    try:
        registered = []
        for i, dog in enumerate(ALL_DOGS, 1):
            pet_id = insert_pet(cur, dog)
            insert_photos(cur, pet_id, dog["photos"])
            label = dog["other"][:40]
            print(f"  [{i}/{len(ALL_DOGS)}] ID={pet_id} 登録済 → {label}…")
            registered.append(pet_id)

        con.commit()
        print()
        print(f"✅ {len(registered)} 件の登録が完了しました！")
        print(f"   登録されたID: {registered}")
        print()
        print("→ ReLink の「保護ペット一覧」を開くと表示されます。")
        print("  （バックエンドを起動してから確認してください）")

    except Exception as e:
        con.rollback()
        print(f"\n❌ 登録失敗（ロールバック済）: {e}")
    finally:
        cur.close()
        con.close()


if __name__ == "__main__":
    main()
