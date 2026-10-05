// ---- フィルター機能 ----

const REGION_MAP = [
  { name: "北海道", prefs: ["北海道"] },
  { name: "東北",   prefs: ["青森","岩手","宮城","秋田","山形","福島"] },
  { name: "関東",   prefs: ["茨城","栃木","群馬","埼玉","千葉","東京","神奈川"] },
  { name: "中部",   prefs: ["新潟","富山","石川","福井","山梨","長野","岐阜","静岡","愛知"] },
  { name: "近畿",   prefs: ["三重","滋賀","京都","大阪","兵庫","奈良","和歌山"] },
  { name: "中国",   prefs: ["鳥取","島根","岡山","広島","山口"] },
  { name: "四国",   prefs: ["徳島","香川","愛媛","高知"] },
  { name: "九州・沖縄", prefs: ["福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄"] },
];

let allPets = [];
// 地域: Set（複数選択）、犬種: string|null（単一）、毛色: Set（複数選択）
const activeFilters = { places: new Set(), specie: null, colors: new Set() };

function splitColors(colorStr) {
  if (!colorStr) return [];
  return colorStr.split(/[とと、,・\/\s]+/).map(s => s.trim()).filter(Boolean);
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

/* ---- 地域フィルター（都道府県チェックボックス・全47都道府県） ---- */
function renderPlaceFilter(pets) {
  const el = document.getElementById("filterPlace");
  if (!el) return;

  el.innerHTML = REGION_MAP.map(region => `
    <div class="filter-region">
      <div class="filter-region-name">${region.name}</div>
      <div class="filter-check-group">
        ${region.prefs.map(pref => `
          <label class="filter-check-label">
            <input type="checkbox" value="${pref}"
              ${activeFilters.places.has(pref) ? "checked" : ""}
              onchange="togglePlace('${pref}', this.checked)">
            <span>${pref}</span>
          </label>`).join("")}
      </div>
    </div>`).join("");
}

function togglePlace(pref, checked) {
  if (checked) activeFilters.places.add(pref);
  else activeFilters.places.delete(pref);
  applyFilters();
}

/* ---- 犬種フィルター（ラジオボタン・単一選択） ---- */
const SPECIE_MAP = [
  { group: "🐕 犬", items: [
    "柴犬","トイプードル","ドーベルマン","チワワ","ゴールデン・レトリバー",
    "ボーダー・コリー","ハスキー","パグ","秋田犬","雑種（中型）"
  ]},
  { group: "🐈 猫", items: [
    "アメリカン・ショートヘア","スコティッシュ・フォールド","マンチカン","ペルシャ",
    "ロシアン・ブルー","シャム","ノルウェージアン・フォレスト・キャット","メインクーン",
    "ラグドール","ブリティッシュ・ショートヘア","アビシニアン","ベンガル","猫（雑種）"
  ]},
];

function renderSpecieFilter(pets) {
  const el = document.getElementById("filterSpecie");
  if (!el) return;

  // DBにあるが固定リストにない種類を「その他」として追加
  const knownItems = SPECIE_MAP.flatMap(g => g.items);
  const extraItems = unique(pets.map(p => p.specie)).filter(s => s && !knownItems.includes(s));

  const groups = [...SPECIE_MAP];
  if (extraItems.length) groups.push({ group: "その他", items: extraItems });

  el.innerHTML = groups.map(group => `
    <div class="filter-specie-group">
      <div class="filter-specie-group-name">${group.group}</div>
      <div class="filter-radio-group">
        ${group.items.map(s => `
          <label class="filter-radio-label">
            <input type="radio" name="specieRadio" value="${s}"
              ${activeFilters.specie === s ? "checked" : ""}
              onchange="selectSpecie('${s.replace(/'/g, "\\'")}')">
            <span>${s}</span>
          </label>`).join("")}
      </div>
    </div>`).join("");
}

function selectSpecie(value) {
  activeFilters.specie = activeFilters.specie === value ? null : value;
  renderSpecieFilter(allPets);
  applyFilters();
}

/* ---- 毛色フィルター（チェックボックス・複数選択・部分一致） ---- */
function renderColorFilter(pets) {
  const el = document.getElementById("filterColor");
  if (!el) return;
  const allColors = unique(pets.flatMap(p => splitColors(p.color)));
  el.innerHTML = allColors.map(c => `
    <label class="filter-check-label">
      <input type="checkbox" value="${c}"
        ${activeFilters.colors.has(c) ? "checked" : ""}
        onchange="toggleColor('${c.replace(/'/g, "\\'")}', this.checked)">
      <span>${c}</span>
    </label>`).join("");
}

function toggleColor(color, checked) {
  if (checked) activeFilters.colors.add(color);
  else activeFilters.colors.delete(color);
  applyFilters();
}

/* ---- フィルター描画まとめ ---- */
function renderFilters(pets) {
  const filtersEl = document.getElementById("shelterFilters");
  if (filtersEl) filtersEl.style.display = "";
  renderPlaceFilter(pets);
  renderSpecieFilter(pets);
  renderColorFilter(pets);
}

/* ---- 絞り込み適用 ---- */
function applyFilters() {
  const bodyEl = document.getElementById("shelterListBody");
  if (!bodyEl) return;

  const filtered = allPets.filter(pet => {
    // 地域（複数選択・OR）
    if (activeFilters.places.size > 0 &&
        ![...activeFilters.places].some(pref => pet.place.includes(pref))) return false;
    // 犬種（単一）
    if (activeFilters.specie && pet.specie !== activeFilters.specie) return false;
    // 毛色（複数選択・部分一致OR）
    if (activeFilters.colors.size > 0) {
      const petColors = new Set(splitColors(pet.color));
      if (![...activeFilters.colors].some(c => petColors.has(c))) return false;
    }
    return true;
  });

  bodyEl.innerHTML = filtered.length
    ? filtered.map((item, i) => renderShelterCard(item, allPets.indexOf(item))).join("")
    : "<div class=\"lede\" style=\"color:var(--magenta)\">該当するペットがいません。</div>";

  // sentinelを常に末尾に戻す
  if (sentinelEl) bodyEl.appendChild(sentinelEl);
}

function hasActiveFilter() {
  return activeFilters.places.size > 0 || activeFilters.specie !== null || activeFilters.colors.size > 0;
}

/* ---- 条件をリセット ---- */
function resetShelterFilters() {
  activeFilters.places.clear();
  activeFilters.specie = null;
  activeFilters.colors.clear();
  renderFilters(allPets);
  applyFilters();
}

// ---- フィルター機能 ここまで ----


// 注意: バックエンドにはまだ「照合状況」を表す項目が無いため、実データの一覧でも
// 元のデザイン通り4種類のタグを順番に割り当てて表示している(見た目優先の暫定対応)。
// 実際の照合状況をAPIが返せるようになったら、ここをそのフィールドに置き換える。
const statusCycle = ['照合中', '新規', '一致', '完了'];
const statusPillClass = { '照合中': 'pill', '新規': 'pill mag', '一致': 'pill mag', '完了': 'pill' };

function petSwatch(id){ return petColors[Number(id) % petColors.length]; }

function openShelterPetDetail(item, status) {
    // matchIdがない場合に備えて、一覧で取得済みのデータをsessionStorageに保存
    try {
        sessionStorage.setItem('shelterPetFallback', JSON.stringify(item));
    } catch(e) { /* sessionStorage非対応環境は無視 */ }
    const matchId = item.matchId ?? '';
    const lostPetId = item.lostPetId ?? '';
    location.href = `pet_detail.html?id=${item.id}&source=${item.source}&matchId=${matchId}&lostPetId=${lostPetId}&status=${encodeURIComponent(status)}`;
}

function renderShelterCard(item, index){
    const photoStyle = item.photoUrl
        ? `background-image:url('${item.photoUrl}');background-size:cover;background-position:center`
        : `background:${petSwatch(item.id)}`;
    const metaParts = [item.specie, item.color, item.place, item.date].filter(Boolean);
    const status = statusCycle[index % statusCycle.length];
    //詳細画面と保護ペット一覧の照合状況を対応
    return `
        <div class="match-card" onclick="openShelterPetDetail(allPets.find(p=>p.id===${item.id}&&p.source==='${item.source}'), '${status}')">
            <div class="ph" style="${photoStyle}" loading="lazy">${item.photoUrl ? '' : '🐕'}</div>
            <div style="min-width:0">
                <div class="name">${item.specie || '種類不明'}${item.color ? '・' + item.color : ''}</div>
                <div class="meta">${metaParts.join(' / ')}</div>
            </div>
            <span class="${statusPillClass[status]}">${status}</span>
        </div>`;
}


// ---- 無限スクロール ・ ページネーション ----

const PAGE_SIZE = 12;
let currentOffset = 0;
let isFetching = false;
let noMorePages = false;
let sentinelEl = null;
let scrollObserver = null;

function updateCountEl() {
  const countEl = document.getElementById('shelterCount');
  if (!countEl) return;
  const waitingCount = allPets.filter((_, i) => statusCycle[i % statusCycle.length] === '照合中').length;
  countEl.innerHTML = `現在の保護： <b style="color:var(--navy)">${allPets.length}頭</b>／照合待ち： <b style="color:var(--magenta)">${waitingCount}頭</b>`;
}

async function fetchNextPage() {
  if (isFetching || noMorePages) return;
  isFetching = true;

  // ロード中表示
  if (sentinelEl) {
    sentinelEl.style.display = '';
    sentinelEl.innerHTML = currentOffset > 0
      ? '<div style="text-align:left;padding:0;color:var(--gray,#888);font-size:.9rem;">読み込み中…</div>'
      : '';
  }

  const token = sessionStorage.getItem('authToken');
  try {
    const res = await fetch(`${API_BASE}/shelter/pets?limit=${PAGE_SIZE}&offset=${currentOffset}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 403) throw new Error('この画面には保護団体(shelter)権限が必要です。ログインし直してください。');
      const body = await res.json().catch(() => null);
      throw new Error((body && body.message) || `一覧の取得に失敗しました。(status ${res.status})`);
    }

    const data = await res.json();
    const newPets = data.pets || [];
    // nextCursorがnullまたは未定義なら最終ページ
    noMorePages = data.nextCursor === null || data.nextCursor === undefined || newPets.length === 0;

    // 初回で0件
    if (newPets.length === 0 && currentOffset === 0) {
      const countEl = document.getElementById('shelterCount');
      if (countEl) countEl.textContent = '現在、登録されている保護ペットはいません。';
      if (sentinelEl) { sentinelEl.innerHTML = ''; sentinelEl.style.display = 'none'; }
      isFetching = false;
      return;
    }

    const prevLength = allPets.length;
    allPets.push(...newPets);
    currentOffset += newPets.length;

    // カウント更新
    updateCountEl();

    // 初回ページのみフィルターを初期化（選択肢が確定するタイミング）
    if (prevLength === 0) {
      renderFilters(allPets);
    }

    // カード描画
    const bodyEl = document.getElementById('shelterListBody');
    if (bodyEl) {
      if (hasActiveFilter()) {
        // フィルター適用中は全件再描画（applyFilters内でsentinelも戻す）
        applyFilters();
      } else {
        // フィルターなし：新規カードを sentinel の直前に追加（プログレッシブ表示）
        const frag = document.createDocumentFragment();
        newPets.forEach((item, i) => {
          const tmp = document.createElement('div');
          tmp.innerHTML = renderShelterCard(item, prevLength + i);
          frag.appendChild(tmp.firstElementChild);
        });
        if (sentinelEl && sentinelEl.parentNode === bodyEl) {
          bodyEl.insertBefore(frag, sentinelEl);
        } else {
          bodyEl.appendChild(frag);
          if (sentinelEl) bodyEl.appendChild(sentinelEl);
        }
      }
    }

    // sentinelの表示制御
    if (sentinelEl) {
      if (noMorePages) {
        sentinelEl.innerHTML = '';
        sentinelEl.style.display = 'none';
      } else {
        sentinelEl.innerHTML = '';
      }
    }
      // ★復元：fetchNextPage の続き(メインにあった catch と後始末)。マージで消えていたので戻した
  } catch (err) {
    console.error(err);
    const countEl = document.getElementById('shelterCount');
    if (countEl) countEl.textContent = '';
    const bodyEl = document.getElementById('shelterListBody');
    if (bodyEl && currentOffset === 0) {
      bodyEl.innerHTML = `<div class="lede" style="color:var(--magenta)">${err.message || '一覧の取得中にエラーが発生しました。'}</div>`;
    }
    if (sentinelEl) { sentinelEl.innerHTML = ''; }
  }

  isFetching = false;
}

// ★復元：保護ペット一覧の読み込み開始処理(メインの loadShelterList。迷子のコードが混ざっていたので元に戻した)
async function loadShelterList() {
  const countEl = document.getElementById('shelterCount');
  const bodyEl = document.getElementById('shelterListBody');
  if (!countEl || !bodyEl) return;

  const token = sessionStorage.getItem('authToken');
  if (!token) {
    countEl.textContent = 'ログインが必要です。';
    bodyEl.innerHTML = '<div class="lede">ログイン画面からやり直してください。</div>';
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
    return;
  }

  // sentinelを作成してbodyElに追加
  sentinelEl = document.createElement('div');
  sentinelEl.id = 'shelterLoadMoreSentinel';
  sentinelEl.style.height = '40px';
  bodyEl.appendChild(sentinelEl);

  // 最初のページを取得
  await fetchNextPage();

  // IntersectionObserverで無限スクロール
  if ('IntersectionObserver' in window) {
    scrollObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetching && !noMorePages) {
        fetchNextPage();
      }
    }, { rootMargin: '200px' });
    if (sentinelEl) scrollObserver.observe(sentinelEl);
  }
}

// 一覧ページでのみ実行
if (document.getElementById('shelterListBody')) {
  loadShelterList();
}

/* ---------------- ★新規追加：迷子ペット一覧(shelter-lost-list.html 専用) ---------------- */

// ★迷子一覧のデータと、選択中のフィルター条件
// 保護側の allPets / activeFilters とは別に持つ(同じ shelter.js を読んでいても干渉しないように)
// 地域・毛色は Set(複数選択)、犬種は string|null(単一選択)
let lostPets = [];
const lostFilters = { places: new Set(), specie: null, colors: new Set() };

/* ---- ★地域フィルター(チェックボックス)。地域の一覧は保護側の REGION_MAP を共用 ---- */
function renderLostPlaceFilter() {
  const el = document.getElementById("lostFilterPlace");
  if (!el) return;

  el.innerHTML = REGION_MAP.map(region => `
    <div class="filter-region">
      <div class="filter-region-name">${region.name}</div>
      <div class="filter-check-group">
        ${region.prefs.map(pref => `
          <label class="filter-check-label">
            <input type="checkbox" value="${pref}"
              ${lostFilters.places.has(pref) ? "checked" : ""}
              onchange="toggleLostPlace(this.value, this.checked)">
            <span>${pref}</span>
          </label>`).join("")}
      </div>
    </div>`).join("");
}

// ★チェックされたら Set に入れる/外す → すぐ絞り込み
function toggleLostPlace(pref, checked) {
  if (checked) lostFilters.places.add(pref);
  else lostFilters.places.delete(pref);
  applyLostFilters();
}

/* ---- ★犬種フィルター(ラジオボタン)。犬種の一覧は保護側の SPECIE_MAP を共用 ---- */
function renderLostSpecieFilter() {
  const el = document.getElementById("lostFilterSpecie");
  if (!el) return;

  // 固定リストに無い種類(飼い主が自由入力した犬種)は「その他」グループにまとめる
  const knownItems = SPECIE_MAP.flatMap(g => g.items);
  const extraItems = unique(lostPets.map(p => p.specie)).filter(s => !knownItems.includes(s));
  const groups = [...SPECIE_MAP];
  if (extraItems.length) groups.push({ group: "その他", items: extraItems });

  // ★value は escapeHtml して属性に入れる(自由入力の文字に " や ' があっても壊れないように)
  el.innerHTML = groups.map(group => `
    <div class="filter-specie-group">
      <div class="filter-specie-group-name">${group.group}</div>
      <div class="filter-radio-group">
        ${group.items.map(s => `
          <label class="filter-radio-label">
            <input type="radio" name="lostSpecieRadio" value="${escapeHtml(s)}"
              ${lostFilters.specie === s ? "checked" : ""}
              onchange="selectLostSpecie(this.value)">
            <span>${escapeHtml(s)}</span>
          </label>`).join("")}
      </div>
    </div>`).join("");
}

function selectLostSpecie(value) {
  lostFilters.specie = value;
  applyLostFilters();
}

/* ---- ★毛色フィルター(チェックボックス)。実際に登録されている毛色だけを選択肢にする ---- */
// ★新規追加：迷子側の毛色フィルターに常に表示する毛色の一覧
// 保護ペット一覧の毛色フィルターに出ている色と同じ並び順にしている
// (色を増やしたい時はここに足すだけでOK)
const LOST_COLOR_OPTIONS = [
  "こげ茶色", "茶色", "クリーム色", "黒白", "黒", "茶白",
  "黒茶", "白", "茶", "白茶", "白黒", "グレー"
];

// ★修正：選択肢を「登録されている毛色だけ」から「固定リスト＋登録済みの毛色」に変更
function renderLostColorFilter() {
  const el = document.getElementById("lostFilterColor");
  if (!el) return;

  // 登録されている毛色を1色ずつに分ける(「茶色・白」→「茶色」「白」。splitColorsは保護側と共用)
  const registeredColors = unique(lostPets.flatMap(p => splitColors(p.color)));

  // ★追加：固定リストに無い毛色(自由入力などで登録された色)だけを取り出す
  const extraColors = registeredColors.filter(c => !LOST_COLOR_OPTIONS.includes(c));

  // ★追加：固定リストを先に並べて、その後ろに「リストに無い色」を付け足す
  const allColors = [...LOST_COLOR_OPTIONS, ...extraColors];

  el.innerHTML = allColors.map(c => `
    <label class="filter-check-label">
      <input type="checkbox" value="${escapeHtml(c)}"
        ${lostFilters.colors.has(c) ? "checked" : ""}
        onchange="toggleLostColor(this.value, this.checked)">
      <span>${escapeHtml(c)}</span>
    </label>`).join("");
}

function toggleLostColor(color, checked) {
  if (checked) lostFilters.colors.add(color);
  else lostFilters.colors.delete(color);
  applyLostFilters();
}

/* ---- ★3つのフィルター画面をまとめて描画して、フィルター枠を表示する ---- */
function renderLostFilters() {
  const filtersEl = document.getElementById("lostFilters");
  if (filtersEl) filtersEl.style.display = "";
  renderLostPlaceFilter();
  renderLostSpecieFilter();
  renderLostColorFilter();
}

/* ---- ★条件のリセット：選択状態を空に戻して、画面を描き直す ---- */
function resetLostFilters() {
  lostFilters.places.clear();
  lostFilters.specie = null;
  lostFilters.colors.clear();
  renderLostFilters();
  applyLostFilters();
}

/* ---- ★絞り込みの本体：3条件すべてを満たすペットだけを残して描画する(AND条件) ---- */
function applyLostFilters() {
  const countEl = document.getElementById("lostCount");
  const bodyEl = document.getElementById("lostListBody");
  if (!bodyEl) return;

  const filtered = lostPets.filter(pet => {
    // 地域(複数選択・OR)：lostPlace が「徳島県 阿南市」形式なので、都道府県名(徳島)の部分一致で判定
    if (lostFilters.places.size > 0 &&
        ![...lostFilters.places].some(pref => (pet.lostPlace || "").includes(pref))) return false;

    // 犬種(単一)：完全一致
    if (lostFilters.specie && pet.specie !== lostFilters.specie) return false;

    // 毛色(複数選択・OR)：選んだ色のどれか1つでも持っていればOK
    if (lostFilters.colors.size > 0) {
      const petColors = new Set(splitColors(pet.color));
      if (![...lostFilters.colors].some(c => petColors.has(c))) return false;
    }
    return true;
  });

  // ★件数表示を「全体 → 絞り込み後」に更新する
  if (countEl) {
    countEl.innerHTML = `登録されている迷子ペット： <b style="color:var(--magenta)">${lostPets.length}頭</b>` +
      (filtered.length !== lostPets.length
        ? `／表示中： <b style="color:var(--navy)">${filtered.length}頭</b>`
        : "");
  }

  bodyEl.innerHTML = filtered.length
    ? filtered.map(renderLostCard).join("")
    : '<div class="lede" style="color:var(--magenta)">該当するペットがいません。</div>';
  // sentinelを末尾に戻す（IntersectionObserverが機能し続けるように）
  if (lostSentinelEl) bodyEl.appendChild(lostSentinelEl);
}

// ★新規追加：バックエンドの状態コード → 画面に出すラベルと色の対応表
// ラベルを変えたい時はここの label を書き換えるだけでOK
const lostStatusMap = {
  lost:       { label: '迷子',       cls: 'pill mag'  },   // ピンク
  candidate:  { label: '候補あり',   cls: 'pill warn' },   // オレンジ
  contacting: { label: '連絡中',     cls: 'pill'      },   // 青系
  confirmed:  { label: '引渡し待ち', cls: 'pill'      },   // 青系
  completed:  { label: '完了',       cls: 'pill ok'   },   // 緑
};

// ★迷子ペット1件分のカード(変更なし)。既存の .match-card を流用してデザインを揃えている
function renderLostCard(item) {
  // ★追加：状態コードからラベルと色を取り出す(未知のコードが来ても「迷子」にフォールバック)
  const st = lostStatusMap[item.status] || lostStatusMap.lost;
  
  const photoStyle = item.photoUrl
    ? `background-image:url('${item.photoUrl}');background-size:cover;background-position:center`
    : `background:${petSwatch(item.id)}`;
  // escapeHtml(common.js)で飼い主の入力文字をエスケープしてXSSを防ぐ
  const metaParts = [item.specie, item.color, item.lostPlace].filter(Boolean).map(escapeHtml);
  return `
    <!-- ★修正：クリックで詳細ページへ移動する(idは数値なのでそのまま埋め込んで安全) -->
    <div class="match-card" style="cursor:pointer" onclick="location.href='shelter-lost-detail.html?id=${item.id}'">
      <div class="ph" style="${photoStyle}">${item.photoUrl ? '' : '🐕'}</div>
      <div style="min-width:0">
        <div class="name">${escapeHtml(item.petName || item.specie || '名前未登録')}</div>
        <div class="meta">${metaParts.join(' / ')}</div>
        ${item.other ? `<div class="meta">${escapeHtml(item.other)}</div>` : ''}
        <!-- ★削除：電話番号の行(詳細ページだけで見せる) -->
      </div>
      <span class="${st.cls}">${st.label}</span>
    </div>`;
}

// ★GET /shelter/lost-pets を呼んで一覧を描画する
// ---- 迷子ペット一覧：無限スクロール・ページネーション ----

const LOST_PAGE_SIZE = 12;
let lostCurrentOffset = 0;
let lostIsFetching = false;
let lostNoMorePages = false;
let lostSentinelEl = null;
let lostScrollObserver = null;

function hasActiveLostFilter() {
  return lostFilters.places.size > 0 || lostFilters.specie !== null || lostFilters.colors.size > 0;
}

function updateLostCountEl() {
  const countEl = document.getElementById('lostCount');
  if (!countEl) return;
  const bodyEl = document.getElementById('lostListBody');
  if (!bodyEl) return;
  const filtered = lostPets.filter(pet => {
    if (lostFilters.places.size > 0 &&
        ![...lostFilters.places].some(pref => (pet.lostPlace || '').includes(pref))) return false;
    if (lostFilters.specie && pet.specie !== lostFilters.specie) return false;
    if (lostFilters.colors.size > 0) {
      const petColors = new Set(splitColors(pet.color));
      if (![...lostFilters.colors].some(c => petColors.has(c))) return false;
    }
    return true;
  });
  countEl.innerHTML = `登録されている迷子ペット： <b style="color:var(--magenta)">${lostPets.length}頭</b>` +
    (filtered.length !== lostPets.length
      ? ` <span style="color:var(--gray,#888);font-size:.85rem">（絞り込み後: ${filtered.length}頭）</span>`
      : '');
}

async function fetchNextLostPage() {
  if (lostIsFetching || lostNoMorePages) return;
  lostIsFetching = true;

  if (lostSentinelEl) {
    lostSentinelEl.style.display = '';
    lostSentinelEl.innerHTML = '<div style="text-align:center;padding:16px 0;color:var(--gray,#888);font-size:.9rem;">読み込み中…</div>';
  }

  const token = sessionStorage.getItem('authToken');
  try {
    const res = await fetch(`${API_BASE}/shelter/lost-pets?limit=${LOST_PAGE_SIZE}&offset=${lostCurrentOffset}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 403) throw new Error('この画面には保護団体(shelter)権限が必要です。ログインし直してください。');
      throw new Error('迷子ペット一覧の取得に失敗しました。(status ' + res.status + ')');
    }

    const data = await res.json();
    const newPets = data.pets || [];
    lostNoMorePages = data.nextCursor === null || data.nextCursor === undefined || newPets.length === 0;

    if (newPets.length === 0 && lostCurrentOffset === 0) {
      const countEl = document.getElementById('lostCount');
      if (countEl) countEl.textContent = '現在、登録されている迷子ペットはいません。';
      if (lostSentinelEl) { lostSentinelEl.innerHTML = ''; lostSentinelEl.style.display = 'none'; }
      lostIsFetching = false;
      return;
    }

    const prevLength = lostPets.length;
    lostPets.push(...newPets);
    lostCurrentOffset += newPets.length;

    updateLostCountEl();

    if (prevLength === 0) renderLostFilters();

    const bodyEl = document.getElementById('lostListBody');
    if (bodyEl) {
      if (hasActiveLostFilter()) {
        applyLostFilters();
      } else {
        const frag = document.createDocumentFragment();
        newPets.forEach(item => {
          const tmp = document.createElement('div');
          tmp.innerHTML = renderLostCard(item);
          frag.appendChild(tmp.firstElementChild);
        });
        if (lostSentinelEl && lostSentinelEl.parentNode === bodyEl) {
          bodyEl.insertBefore(frag, lostSentinelEl);
        } else {
          bodyEl.appendChild(frag);
          if (lostSentinelEl) bodyEl.appendChild(lostSentinelEl);
        }
      }
    }

    if (lostSentinelEl) {
      if (lostNoMorePages) {
        lostSentinelEl.innerHTML = '';
        lostSentinelEl.style.display = 'none';
      } else {
        lostSentinelEl.innerHTML = '';
      }
    }

  } catch (err) {
    console.error(err);
    const countEl = document.getElementById('lostCount');
    if (countEl) countEl.textContent = '';
    const bodyEl = document.getElementById('lostListBody');
    if (bodyEl && lostCurrentOffset === 0) {
      bodyEl.innerHTML = `<div class="lede" style="color:var(--magenta)">${escapeHtml(err.message)}</div>`;
    }
    if (lostSentinelEl) lostSentinelEl.innerHTML = '';
  }

  lostIsFetching = false;
}

async function loadLostList() {
  const countEl = document.getElementById('lostCount');
  const bodyEl = document.getElementById('lostListBody');
  if (!countEl || !bodyEl) return;

  const token = sessionStorage.getItem('authToken');
  if (!token) {
    countEl.textContent = 'ログインが必要です。';
    bodyEl.innerHTML = '<div class="lede">ログイン画面からやり直してください。</div>';
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
    return;
  }

  lostSentinelEl = document.createElement('div');
  lostSentinelEl.id = 'lostLoadMoreSentinel';
  lostSentinelEl.style.height = '40px';
  bodyEl.appendChild(lostSentinelEl);

  await fetchNextLostPage();

  if ('IntersectionObserver' in window) {
    lostScrollObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !lostIsFetching && !lostNoMorePages) {
        fetchNextLostPage();
      }
    }, { rootMargin: '200px' });
    if (lostSentinelEl) lostScrollObserver.observe(lostSentinelEl);
  }
}

// ★迷子一覧ページ(lostListBody がある時)だけ実行する。他のページでは何もしない
if (document.getElementById('lostListBody')) {
  loadLostList();
}


/* ---------------- pet detail ---------------- */
( async () => {
  const isPetDetailPage = document.getElementById('petPhoto');
  if (!isPetDetailPage) return;

  //追加：URLのペットのidを読み取る
  const params = new URLSearchParams(window.location.search);
  const petId = params.get('id');
  const source = params.get('source');
  const matchId = params.get('matchId');
  const lostPetId = params.get('lostPetId');
  const requestedStatus = params.get('status');
  const detailStatus = statusCycle.includes(requestedStatus) ? requestedStatus : null;

  //正しいかデータか確認
  console.log('保護ペットID:', petId);
  console.log('保護元:', source);
  console.log('照合ID:', matchId);
  console.log('LostPetID:', lostPetId);

  const token = sessionStorage.getItem('authToken');

  if (!token) {
    alert('ログインが必要です。');
    window.location.href = 'login.html';
    return;
  }

  // DOM更新ヘルパー
  function fillPetDetail({ nameText, specie, color, other, foundPlace, foundDate, statusText, photoUrl, voiceUrl }) {
    const petName = document.getElementById('petName');
    if (petName) petName.textContent = nameText || '保護ペット';

    const petBreed = document.getElementById('petBreed');
    if (petBreed) petBreed.textContent = specie || '種類不明';

    const petColor = document.getElementById('petColor');
    if (petColor) petColor.textContent = color || '色不明';

    const petCollar = document.getElementById('petCollar');
    if (petCollar) petCollar.textContent = other || '情報なし';

    const petLocation = document.getElementById('petLocation');
    if (petLocation) petLocation.textContent = foundPlace || '場所不明';

    const petDate = document.getElementById('petDate');
    if (petDate) petDate.textContent = foundDate || '日付不明';

    const petStatus = document.getElementById('petStatus');
    const resolvedStatus = statusPillClass[statusText] ? statusText : '照合中';
    if (petStatus) {
      petStatus.textContent = resolvedStatus;
      petStatus.className = statusPillClass[resolvedStatus];
    }

    const petPhoto = document.getElementById('petPhoto');
    if (petPhoto && photoUrl) {
      petPhoto.style.backgroundImage = `url("${photoUrl}")`;
      petPhoto.style.backgroundSize = 'cover';
      petPhoto.style.backgroundPosition = 'center';
      petPhoto.textContent = '';
    }

    const voiceSection = document.getElementById('petVoiceSection');
    const voicePlayer = document.getElementById('petVoicePlayer');
    if (voiceSection && voicePlayer) {
      if (voiceUrl) {
        voicePlayer.src = voiceUrl;
        voicePlayer.load(); // ブラウザに明示的にソース変更を通知
        voiceSection.style.display = 'block';

        // 音声ロード失敗時のフォールバック表示
        voicePlayer.onerror = () => {
          const errMsg = voiceSection.querySelector('.voice-error');
          if (!errMsg) {
            const msg = document.createElement('p');
            msg.className = 'lede voice-error';
            msg.style.color = 'var(--magenta)';
            msg.innerHTML = 'お使いのブラウザではWebM形式を再生できません。<br><a href="' + voiceUrl + '" download style="color:var(--magenta)">音声ファイルをダウンロード</a>';
            voiceSection.appendChild(msg);
          }
        };
      } else {
        voicePlayer.removeAttribute('src');
        voiceSection.style.display = 'none';
      }
    }
  }

  try {
    // 照合IDがある場合：照合詳細APIから取得
    if (matchId && matchId !== 'null' && matchId !== 'undefined' && matchId !== '') {
      const res = await fetch(`${API_BASE}/matches/${matchId}/detail`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`照合詳細の取得に失敗しました。status: ${res.status}`);
      }

      const detail = await res.json();
      console.log('照合詳細:', detail);

      const pet = detail.pet;
      if (pet) {
        fillPetDetail({
          nameText: `保護 #${detail.matchId}`,
          specie: pet.specie,
          color: pet.color,
          other: pet.other,
          foundPlace: pet.foundPlace,
          foundDate: pet.foundDate,
          statusText: detailStatus || '一致',
          photoUrl: pet.photoUrls && pet.photoUrls.length > 0 ? pet.photoUrls[0] : null,
          voiceUrl: pet.voiceUrl,
        });
      }

    } else {
      // 照合IDがない場合：一覧取得時にsessionStorageに保存したデータを使用
      console.log('matchIdなし → sessionStorageのフォールバックデータを使用');
      let fallback = null;
      try {
        const raw = sessionStorage.getItem('shelterPetFallback');
        if (raw) fallback = JSON.parse(raw);
      } catch(e) { /* 無視 */ }

      if (fallback && String(fallback.id) === String(petId) && fallback.source === source) {
        fillPetDetail({
          nameText: `保護 #${fallback.id}`,
          specie: fallback.specie,
          color: fallback.color,
          other: fallback.other,
          foundPlace: fallback.place,   // ShelterPetListItemではplaceという名前
          foundDate: fallback.date,     // ShelterPetListItemではdateという名前
          statusText: detailStatus || '照合中',
          photoUrl: fallback.photoUrl,  // ShelterPetListItemではphotoUrl（単数）
          voiceUrl: null,
        });
      } else {
        // フォールバックデータもない場合はデフォルト表示のまま
        console.warn('フォールバックデータが見つかりませんでした。id:', petId, 'source:', source);
        const petName = document.getElementById('petName');
        if (petName) petName.textContent = `保護 #${petId}`;
        const petStatus = document.getElementById('petStatus');
        const resolvedStatus = detailStatus || '照合中';
        if (petStatus) {
          petStatus.textContent = resolvedStatus;
          petStatus.className = statusPillClass[resolvedStatus];
        }
      }
    }

  } catch (err) {
      console.error('詳細情報の取得エラー:', err);
    }

  // 保護情報更新
  const updateButton = document.getElementById('updateButton');

  if (updateButton) {
    updateButton.addEventListener('click', () => {
      alert('保護情報の更新機能は準備中です。');
    });
  }
})();

/* ---------------- ★新規追加：迷子ペット詳細(shelter-lost-detail.html 専用) ---------------- */
(async () => {
  // 迷子詳細ページの時だけ動かす(他のページでは何もしない)
  const photoEl = document.getElementById('lostPetPhoto');
  if (!photoEl) return;

  // URLの ?id=123 から迷子ペットのIDを読み取る
  const id = new URLSearchParams(window.location.search).get('id');
  const token = sessionStorage.getItem('authToken');

  if (!token) {
    alert('ログインが必要です。');
    window.location.href = 'login.html';
    return;
  }

  // ★指定したIDの要素に、エスケープした文字を入れるヘルパー(空なら「未登録」)
  const setText = (elId, value, fallback = '未登録') => {
    const el = document.getElementById(elId);
    if (el) el.textContent = value || fallback;
  };

  try {
    const res = await fetch(`${API_BASE}/shelter/lost-pets/${encodeURIComponent(id)}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 403) throw new Error('この画面には保護団体(shelter)権限が必要です。ログインし直してください。');
      if (res.status === 404) throw new Error('迷子ペットが見つかりませんでした。');
      throw new Error('詳細の取得に失敗しました。(status ' + res.status + ')');
    }
    const d = await res.json();

    // --- 基本情報(textContentで入れるので、飼い主の入力した文字もそのまま安全に表示される) ---
    setText('lostPetName', d.petName || d.specie, '名前未登録');
    setText('lostPetNickname', d.nickname);
    setText('lostPetSpecie', d.specie);
    setText('lostPetColor', d.color);
    setText('lostPetPlace', d.lostPlace);
    setText('lostPetOther', d.other, '情報なし');

    // --- 状態ピル(一覧と同じ lostStatusMap を使うので表示が揃う) ---
    const st = lostStatusMap[d.status] || lostStatusMap.lost;
    const statusEl = document.getElementById('lostPetStatus');
    if (statusEl) { statusEl.className = st.cls; statusEl.textContent = st.label; }

    // --- ★電話番号：タップで電話できるリンクにする(数字・+ 以外は除いて安全にする) ---
    const phoneEl = document.getElementById('lostPetPhone');
    if (phoneEl) {
      if (d.phoneNumber) {
        const a = document.createElement('a');
        a.href = 'tel:' + d.phoneNumber.replace(/[^0-9+]/g, '');
        a.textContent = d.phoneNumber;
        phoneEl.textContent = '';
        phoneEl.appendChild(a);
      } else {
        phoneEl.textContent = '未登録';
      }
    }

        // --- ★修正：写真ギャラリー。上に大きい1枚、下に「他の写真」を3枚ずつ並べる ---
    const urls = d.photoUrls || [];
    const thumbsEl = document.getElementById('lostPetThumbs');
    let current = 0; // いま大きく表示している写真の番号(最初は0番目＝代表写真)

    // ★大きい写真と、それ以外の写真(グリッド)を描き直す関数
    const renderGallery = () => {
      if (urls.length === 0) return; // 写真が無い時は🐕のまま

      // 大きい写真：<img> を入れる。escapeHtml(common.js)でURLを属性に安全に埋め込む
      photoEl.innerHTML = `<img src="${escapeHtml(urls[current])}" alt="迷子ペットの写真">`;

      // 他の写真：いま大きく出している写真は除いて、残りを3列グリッドに並べる
      thumbsEl.innerHTML = urls
        .map((u, i) => i === current
          ? ''  // ← 大きく表示中の写真は、グリッドには出さない
          : `<img class="lost-thumb" data-i="${i}" src="${escapeHtml(u)}" alt="他の写真">`)
        .join('');
    };

    // ★グリッドの写真をクリックしたら、それを大きい写真に入れ替える
    // (入れ替わると、さっきまで大きかった写真がグリッド側に移る)
    thumbsEl.addEventListener('click', (e) => {
      const t = e.target.closest('.lost-thumb');
      if (!t) return;
      current = Number(t.dataset.i);
      renderGallery();
      photoEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); // 大きい写真が見える位置に戻す
    });

    renderGallery(); // 最初の描画

    // --- ★呼び声：voiceUrl があれば <audio> で再生できるようにする ---
    const player = document.getElementById('lostVoicePlayer');
    const msg = document.getElementById('lostVoiceMessage');
    if (d.voiceUrl) {
      player.src = d.voiceUrl;
      player.style.display = 'block';
      msg.textContent = '';
      // ブラウザが形式を再生できない時(例：WebMが苦手なSafari)の代わりに、ダウンロードリンクを出す
      player.onerror = () => {
        player.style.display = 'none';
        msg.innerHTML = 'この形式の音声は、お使いのブラウザでは再生できません。<br>' +
          `<a href="${encodeURI(d.voiceUrl)}" download style="color:var(--magenta)">音声ファイルをダウンロード</a>`;
      };
    } else {
      msg.textContent = '飼い主は音声を登録していません。';
    }

  } catch (err) {
    console.error(err);
    setText('lostPetName', '', '読み込みに失敗しました');
    const msg = document.getElementById('lostVoiceMessage');
    if (msg) msg.textContent = err.message || '詳細の取得中にエラーが発生しました。';
  }
})();