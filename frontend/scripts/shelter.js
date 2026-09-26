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
              onchange="selectSpecie('${s.replace(/'/g, "\'")}')">
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
        onchange="toggleColor('${c.replace(/'/g, "\'")}', this.checked)">
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
    if (activeFilters.places.size > 0 && !activeFilters.places.has(pet.place)) return false;
    // 犬種（単一）
    if (activeFilters.specie && pet.specie !== activeFilters.specie) return false;
    // 毛色（複数選択・部分一致OR）
    if (activeFilters.colors.size > 0) {
      const petColors = new Set(splitColors(pet.color));
      const matched = [...activeFilters.colors].some(c => petColors.has(c));
      if (!matched) return false;
    }
    return true;
  });

  bodyEl.innerHTML = filtered.length
    ? filtered.map((item, i) => renderShelterCard(item, i)).join("")
    : "<div class=\"lede\" style=\"color:var(--magenta)\">該当するペットがいません。</div>";
}

// ---- フィルター機能 ここまで ----


// 注意: バックエンドにはまだ「照合状況」を表す項目が無いため、実データの一覧でも
// 元のデザイン通り4種類のタグを順番に割り当てて表示している(見た目優先の暫定対応)。
// // 実際の照合状況をAPIが返せるようになったら、ここをそのフィールドに置き換える。
const statusCycle = ['照合中', '新規', '一致', '完了'];
const statusPillClass = { '照合中': 'pill', '新規': 'pill mag', '一致': 'pill mag', '完了': 'pill' };

function petSwatch(id){ return petColors[Number(id) % petColors.length]; }

function renderShelterCard(item, index){
    const photoStyle = item.photoUrl
        ? `background-image:url('${item.photoUrl}');background-size:cover;background-position:center`
        : `background:${petSwatch(item.id)}`;
    const metaParts = [item.specie, item.color, item.place, item.date].filter(Boolean);
    const status = statusCycle[index % statusCycle.length];
    return `
        <div class="match-card" onclick="location.href='pet_detail.html?id=${item.id}&source=${item.source}&matchId=${item.matchId}&lostPetId=${item.lostPetId ?? ''}'">
            <div class="ph" style="${photoStyle}">${item.photoUrl ? '' : '🐕'}</div>
            <div style="min-width:0">
                <div class="name">${item.specie || '種類不明'}${item.color ? '・' + item.color : ''}</div>
                <div class="meta">${metaParts.join(' / ')}</div>
            </div>
            <span class="${statusPillClass[status]}">${status}</span>
        </div>`;
}

async function loadShelterList(){
    const countEl = document.getElementById('shelterCount');
    const bodyEl = document.getElementById('shelterListBody');
    const token = sessionStorage.getItem('authToken');

    if(!token){
        countEl.textContent = 'ログインが必要です。';
        bodyEl.innerHTML = '<div class="lede">ログイン画面からやり直してください。</div>';
        setTimeout(() => { window.location.href = 'login.html'; }, 1200);
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/shelter/pets`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if(!res.ok){
            if(res.status === 403){
                throw new Error('この画面には保護団体(shelter)権限が必要です。ログインし直してください。');
            }
            const body = await res.json().catch(()=>null);
            throw new Error((body && body.message) || ('一覧の取得に失敗しました。(status ' + res.status + ')'));
        }

        const data = await res.json();
        const pets = data.pets || [];

        if(pets.length === 0){
            countEl.textContent = '現在、登録されている保護ペットはいません。';
            bodyEl.innerHTML = '';
            return;
        }

        const waitingCount = pets.filter((_, i) => statusCycle[i % statusCycle.length] === '照合中').length;
        countEl.innerHTML = `現在の保護： <b style="color:var(--navy)">${pets.length}頭</b>／照合待ち： <b style="color:var(--magenta)">${waitingCount}頭</b>`;

        // フィルター初期化
        allPets = pets;
        renderFilters(pets);
        applyFilters();

        }catch (err) {
            console.error(err);
            countEl.textContent = '';
            bodyEl.innerHTML = `<div class="lede" style="color:var(--magenta)">${err.message || '一覧の取得中にエラーが発生しました。'}</div>`;
        }
    }

    //修正：pet_detail.htmlに対応させるため
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

  //正しいかデータか確認
  console.log('保護ペットID:', petId);
  console.log('保護元:', source);
  console.log('照合ID:', matchId);

  const token = sessionStorage.getItem('authToken');

  if (!token) {
    alert('ログインが必要です。');
    window.location.href = 'login.html';
    return;
  }

  try {
    // 照合IDがある場合だけ照合詳細を取得
    if (matchId && matchId !== 'null') {
      const res = await fetch(`${API_BASE}/matches/${matchId}/detail`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error(`照合詳細の取得に失敗しました。status: ${res.status}`);
      }

      const detail = await res.json();

      console.log('照合詳細:', detail);
      console.log('音声URL:', detail.pet?.voiceUrl);
    }

    // 音声を取得
    const voiceSection = document.getElementById('petVoiceSection');
    const voicePlayer = document.getElementById('petVoicePlayer');

    if (lostPetId) {
      const voiceRes = await fetch(`${API_BASE}/pets/${lostPetId}/voice`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!voiceRes.ok) {
        throw new Error(`音声取得に失敗しました。status: ${voiceRes.status}`);
      }

      const voiceData = await voiceRes.json();

      console.log('取得した音声URL:', voiceData.voiceUrl);

      if (voiceData.voiceUrl) {
        voicePlayer.src = voiceData.voiceUrl;
        voiceSection.style.display = 'block';
      } else {
        voiceSection.style.display = 'none';
      }
    } else {
      voiceSection.style.display = 'none';
    }

  } catch (err) {
      console.error('詳細・音声取得エラー:', err);
  }

  // Google Maps
  window.initMap = function () {
    const mapElement = document.getElementById('map');

    if (!mapElement) return;

    const map = new google.maps.Map(mapElement, {
      center: {
        lat: 34.0703,
        lng: 134.5548
      },
      zoom: 15
    });

    new google.maps.Marker({
      position: {
        lat: 34.0703,
        lng: 134.5548
      },
      map: map
    });
  };

  // 保護情報更新
  const updateButton = document.getElementById('updateButton');

  if (updateButton) {
    updateButton.addEventListener('click', () => {
      alert('保護情報の更新機能は準備中です。');
    });
  }
})();