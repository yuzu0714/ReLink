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
    sentinelEl.innerHTML = '<div style="text-align:center;padding:16px 0;color:var(--gray,#888);font-size:.9rem;">読み込み中…</div>';
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