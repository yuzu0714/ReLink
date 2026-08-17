# 実行前に、準備として以下を行ってください:
#   1. pip install openai python-dotenv requests
#   2. .env を作り、SAKURA_AI_TOKEN を記入
#   3. .env に SUPABASE_URL と SUPABASE_KEY（secret key）を追記する。
#      （ローカルのデータベース保存は行わないため、Supabaseへの登録が必須です）
#
# 使い方:
#   python3 tag.py 写真1 [写真2 写真3 ...] [--status protected|lost] [--found-place 場所] [--phone 電話番号]
#   例（保護ペット）: python3 tag.py dog.jpg --status protected --found-place "徳島県阿南市"
#   例（迷子ペット）: python3 tag.py dog.jpg --status lost --found-place "徳島県阿南市" --phone "090-xxxx-xxxx"
#   複数枚指定すると、AIが同じ1匹のペットの写真としてまとめて解析し、
#   1匹分のタグを抽出します（角度が増えるほど精度が上がりやすくなります）。
#
# 実行すると: AIが画像（複数可）を解析し、動物の種類・犬種猫種・毛色・首輪の特徴を抽出し、
# Supabaseの foundpet_register（保護） または lostpet_register（迷子）に登録します。
#
# 補足: AI呼び出し・Supabaseとのやりとりの共通処理は common.py にまとめてあります
# （match_api.py と共通利用するため）。

# /// script
# requires-python = ">=3.10"
# dependencies = ["openai", "python-dotenv", "requests"]
# ///
import argparse
import os
import sys
from datetime import datetime

import common

common.require_supabase()


def main():
    parser = argparse.ArgumentParser(description="ペット写真（複数可）からタグを抽出してSupabaseに保存します。")
    parser.add_argument("images", nargs="+", help="画像ファイルのパス（スペース区切りで複数指定可）")
    parser.add_argument(
        "--status",
        choices=["protected", "lost"],
        default="protected",
        help="protected: 保護したペット / lost: 迷子のペット（デフォルト: protected）",
    )
    parser.add_argument(
        "--found-place",
        default=None,
        help="保護された場所、または迷子になった場所（例: \"徳島県阿南市\"）。省略可。",
    )
    parser.add_argument(
        "--phone",
        default=None,
        help="--status lost の場合にSupabaseのlostpet_registerへ保存する飼い主の電話番号。",
    )
    args = parser.parse_args()

    for path in args.images:
        if not os.path.isfile(path):
            sys.exit(f"画像ファイルが見つかりません: {path}")

    if args.status == "lost" and not args.phone:
        sys.exit(
            "--status lost で登録するには --phone（飼い主の電話番号）が必須です"
            "（ローカル保存がないため、Supabaseへの登録が唯一の保存先です）。"
        )

    print(f"{len(args.images)}枚の画像をAIで解析中...")
    try:
        tags, _raw_text = common.extract_tags_from_paths(args.images)
    except RuntimeError as e:
        sys.exit(str(e))

    print(f"区分: {'保護 (protected)' if args.status == 'protected' else '迷子 (lost)'}")
    if args.found_place:
        print(f"場所: {args.found_place}")
    print(f"種類: {tags.get('animal_type')}")
    print(f"犬種/猫種: {tags.get('breed')}")
    print(f"毛色: {tags.get('coat_color')}")
    if tags.get("has_collar"):
        print(f"首輪: あり - {tags.get('collar_features')}")
    else:
        print("首輪: なし")

    # 写真のアップロードとテキスト情報の登録は互いに独立させる。
    # 写真アップロードが失敗しても、種類・毛色・電話番号などの情報は
    # 別途Supabaseに登録できるようにする（photo_urlは失敗時にNoneのまま送る）。
    photo_url = None
    try:
        print("Supabaseに代表写真をアップロード中...")
        photo_url = common.upload_photo_to_supabase(args.images[0], args.status)
    except Exception as e:
        print(
            f"警告: Supabaseへの写真アップロードに失敗しました。"
            f"写真なしでその他の情報だけをSupabaseに登録します: {e}\n"
            f"ヒント: Supabaseの「Storage」に \"{common.SUPABASE_BUCKET}\" という名前の"
            f"公開(Public)バケットが作成されているか確認してください。"
        )

    other_text = common.build_other_text(tags)
    try:
        if args.status == "protected":
            table = "foundpet_register"
            payload = {
                "photo_url": photo_url,
                "found_place": args.found_place,
                "found_date": datetime.now().isoformat(),
                "specie": tags.get("breed"),
                "color": tags.get("coat_color"),
                "other": other_text,
            }
        else:
            table = "lostpet_register"
            payload = {
                "photo_url": photo_url,
                "phone_number": args.phone,
                "specie": tags.get("breed"),
                "color": tags.get("coat_color"),
                "other": other_text,
                "lost_place": args.found_place,
            }
        common.supabase_insert(table, payload)
        print(f"Supabaseの{table}に登録しました。")
    except Exception as e:
        sys.exit(f"Supabaseへの保存に失敗しました（他に保存先がないため中断します）: {e}")


if __name__ == "__main__":
    main()
