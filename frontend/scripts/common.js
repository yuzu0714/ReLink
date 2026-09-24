/* ---------------- ReLINK 共通処理 ---------------- */

// Kotlinバックエンド(relink-api)のURL。
// ローカルで `./gradlew run` した状態だとデフォルトで8080番なのでこれで動く。
// どこかにデプロイしたら、ここをそのURLに書き換える。


/* ---------------- 共通データ ---------------- */

const roleLabel = {
  owner: '飼い主',
  finder: '発見者',
  shelter: '保護団体'
};

const petColors = [
  '#c8935f',
  '#e8c9a0',
  '#7a5230',
  '#3d3d3d',
  '#e5e5e5',
  '#f0f0f0'
];

// petColors と同じ順番の色名。
// バックエンドに送るcolorはテキストなのでここから引く。
const colorNames = [
  '茶色',
  'クリーム色',
  'こげ茶色',
  '黒',
  '白',
  'グレー'
];

function petSwatch(i) {
  return petColors[i % petColors.length];
}


/* ---------------- AI特徴抽出(共通) ----------------
   写真をKotlinバックエンド経由でAI特徴抽出サーバー(match_api.py)に送り、
   まだ入力していない項目だけを自動入力するための共通ヘルパー。

   決定事項:

     ・ブラウザからPython側を直接呼ばない(Kotlinの/pets/extract-featuresを経由する)

     ・フロント側の固定UI(セレクトボックス・色スウォッチ)自体は変更しない。
       AIの自由な出力は「そのほか」欄にそのまま残し、情報を失わないようにする。

     ・すでに入力済みの項目は上書きしない。

   owner/finderのどちらの画面でも使えるように共通関数にしている。 */


/*
 * AI特徴抽出
 *
 * 写真をKotlinバックエンド経由でAI特徴抽出サーバー(match_api.py)に送り、
 * AIが解析した特徴を受け取る。
 *
 * 戻り値:
 * {
 *   animalType,
 *   breed,
 *   coatColor,
 *   hasCollar,
 *   collarFeatures
 * }
 */
async function callAiExtractFeatures(photoFiles) {
  const token = sessionStorage.getItem('authToken');

  if (!token) {
    throw new Error(
      'ログインが必要です。ログイン画面からやり直してください。'
    );
  }

  if (!photoFiles || photoFiles.length === 0) {
    throw new Error('先に写真を1枚以上追加してください。');
  }

  const form = new FormData();

  photoFiles.forEach((file) => {
    form.append('photo', file);
  });

  const res = await fetch(`${API_BASE}/pets/extract-features`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: form
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);

    throw new Error(
      (body && body.message) ||
      ('AI解析に失敗しました。(status ' + res.status + ')')
    );
  }

  return res.json();
  // {
  //   animalType,
  //   breed,
  //   coatColor,
  //   hasCollar,
  //   collarFeatures
  // }
}


/* ---------------- 写真アップロード(共通) ---------------- */

// 複数枚の写真を /pets/photos に1枚ずつアップロードし、
// 返ってきたphotoUrlを配列で集める。
//
// バックエンドのpet_photosテーブル移行(backend_contacts_mergeの統合)により、
// /pets/lost・/pets/found・/pets/rescued は photoUrl(単数) ではなく
// photoUrls: List<String>(複数)を必須で受け取るようになったため、
// 登録時はこの関数でまとめてアップロードしてから配列として渡す。

const MAX_PHOTOS_PER_PET = 10;

async function uploadPhotos(files, token) {
  if (!files || files.length === 0) {
    throw new Error('写真を1枚以上追加してください。');
  }

  if (files.length > MAX_PHOTOS_PER_PET) {
    throw new Error(
      `写真は${MAX_PHOTOS_PER_PET}枚までしか登録できません(現在${files.length}枚)。`
    );
  }

  const photoUrls = [];

  for (const file of files) {
    const form = new FormData();

    form.append('photo', file);

    const uploadRes = await fetch(`${API_BASE}/pets/photos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: form
    });

    if (!uploadRes.ok) {
      throw new Error(
        '写真のアップロードに失敗しました。(status ' +
        uploadRes.status +
        ')'
      );
    }

    const { photoUrl } = await uploadRes.json();

    photoUrls.push(photoUrl);
  }

  return photoUrls;
}


/* ---------------- AI結果 → 種類・犬種 ---------------- */

// 犬種・動物種のフリーテキストを、
// 固定セレクトの選択肢に近いものへざっくり寄せる。
//
// 判別できない場合は自動選択しない(ユーザーに選んでもらう)。
// 細かい犬種名は呼び出し側で「そのほか」欄に残すので、
// ここでの選択が多少ざっくりでも情報は失われない。

function guessSpecieOption(animalType, breed) {
  const text = `${animalType || ''} ${breed || ''}`;

  // 犬
  if (/柴/.test(text)) return '柴犬';
  if (/プードル/.test(text)) return 'トイプードル';
  if (/ドーベルマン/.test(text)) return 'ドーベルマン';
  if (/チワワ/.test(text)) return 'チワワ';
  if (/ゴールデン・レトリバー/.test(text)) {
    return 'ゴールデン・レトリバー';
  }
  if (/ボーダー・コリー/.test(text)) {
    return 'ボーダー・コリー';
  }
  if (/ハスキー/.test(text)) return 'ハスキー';
  if (/パグ/.test(text)) return 'パグ';
  if (/秋田犬/.test(text)) return '秋田犬';

  // 猫の品種
  // 先に具体的な品種を判定し、最後に雑種にフォールバック
  if (/アメリカン.?ショートヘア|アメショ/.test(text)) {
    return 'アメリカン・ショートヘア';
  }

  if (/スコティッシュ.?フォールド|スコ折/.test(text)) {
    return 'スコティッシュ・フォールド';
  }

  if (/マンチカン/.test(text)) {
    return 'マンチカン';
  }

  if (/ペルシャ/.test(text)) {
    return 'ペルシャ';
  }

  if (/ロシアン.?ブルー/.test(text)) {
    return 'ロシアン・ブルー';
  }

  if (/シャム/.test(text)) {
    return 'シャム';
  }

  if (/ノルウェージアン/.test(text)) {
    return 'ノルウェージアン・フォレスト・キャット';
  }

  if (/メインクーン/.test(text)) {
    return 'メインクーン';
  }

  if (/ラグドール/.test(text)) {
    return 'ラグドール';
  }

  if (/ブリティッシュ.?ショートヘア|ブリショ/.test(text)) {
    return 'ブリティッシュ・ショートヘア';
  }

  if (/アビシニアン/.test(text)) {
    return 'アビシニアン';
  }

  if (/ベンガル/.test(text)) {
    return 'ベンガル';
  }

  if (/猫/.test(text)) {
    return '猫（雑種）';
  }

  if (/雑種/.test(text)) {
    return '雑種（中型）';
  }

  return '';
}


/* ---------------- AI結果 → 毛色 ---------------- */

// 毛色のフリーテキストから、
// 色見本(petColors/colorNames)に近いインデックスを探す。

function colorKeywordIndex(text) {
  for (let i = 0; i < colorNames.length; i++) {
    if (text.includes(colorNames[i])) {
      return i;
    }
  }

  if (/黒/.test(text)) return 3;
  if (/白/.test(text)) return 4;
  if (/(グレー|灰)/.test(text)) return 5;
  if (/茶/.test(text)) return 0;

  return -1;
}
function escapeHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
