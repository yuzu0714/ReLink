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
        <div class="match-card" onclick="location.href='pet_detail.html'">
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
        bodyEl.innerHTML = pets.map((item, i) => renderShelterCard(item, i)).join('');
        }catch (err) {
            console.error(err);
            countEl.textContent = '';
            bodyEl.innerHTML = `<div class="lede" style="color:var(--magenta)">${err.message || '一覧の取得中にエラーが発生しました。'}</div>`;
        }
    }

    loadShelterList();

/* ---------------- pet detail ---------------- */
(() => {
  const isPetDetailPage = document.getElementById('petPhoto');
  if (!isPetDetailPage) return;

  const token = sessionStorage.getItem('authToken');

  if (!token) {
    alert('ログインが必要です。');
    window.location.href = 'login.html';
    return;
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