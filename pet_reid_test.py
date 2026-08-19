# MegaDescriptor-L-384を使って、2枚以上の写真が同じ個体(同じペット)かどうかを
# 埋め込みベクトルの類似度で比較する検証スクリプト。
#
# 事前準備:
#   pip install torch timm pillow
#   (初回実行時に、Hugging Faceからモデル本体(数百MB)が自動でダウンロードされます)
#
# 使い方:
#   python3 pet_reid_test.py 写真1 写真2 [写真3 ...]
#   → 指定した写真すべての組み合わせについて、類似度(コサイン類似度)を一覧表示します。
#
# 見方:
#   コサイン類似度は -1〜1 の値で、1に近いほど「似ている(同じ個体っぽい)」ことを示します。
#   同じ個体を撮った写真同士のペアで高いスコア、違う個体同士のペアで低いスコアになっていれば、
#   このモデルが個体識別(同じ子かどうかの判定)に使えそうだ、と判断する材料になります。
#   目安として、まずは「明らかに同じ子の写真2枚」と「別の子の写真」を混ぜて試してみてください。

import itertools
import sys

import torch
import timm
from PIL import Image

MODEL_NAME = "hf-hub:BVRA/MegaDescriptor-L-384"


def load_model():
    # num_classes=0: 分類用の最終層を外し、特徴ベクトル(embedding)だけを出力するようにする
    model = timm.create_model(MODEL_NAME, pretrained=True, num_classes=0)
    model.eval()
    config = timm.data.resolve_data_config({}, model=model)
    transform = timm.data.create_transform(**config)
    return model, transform


def embed_image(model, transform, path: str) -> torch.Tensor:
    img = Image.open(path).convert("RGB")
    tensor = transform(img).unsqueeze(0)
    with torch.no_grad():
        feat = model(tensor)
    feat = feat.squeeze(0)
    feat = feat / feat.norm()  # コサイン類似度を単純な内積で計算できるように正規化しておく
    return feat


def main():
    if len(sys.argv) < 3:
        sys.exit("使い方: python3 pet_reid_test.py 写真1 写真2 [写真3 ...]（2枚以上を指定してください）")

    paths = sys.argv[1:]

    print("MegaDescriptor-L-384を読み込み中(初回はモデルのダウンロードが発生するため時間がかかります)...")
    model, transform = load_model()

    embeddings = {}
    for path in paths:
        print(f"  解析中: {path}")
        embeddings[path] = embed_image(model, transform, path)

    print("\n--- ペアごとの類似度(コサイン類似度。1.0に近いほど「似ている」) ---")
    results = []
    for a, b in itertools.combinations(paths, 2):
        score = torch.dot(embeddings[a], embeddings[b]).item()
        results.append((score, a, b))

    # 似ている順(スコアが高い順)に並べて表示
    for score, a, b in sorted(results, reverse=True):
        print(f"  {score:.4f}   {a}  vs  {b}")


if __name__ == "__main__":
    main()