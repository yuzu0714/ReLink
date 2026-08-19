/* ---------------- ReLINK demo — state & router ---------------- */
const S = {
  role: null,
  regPhotos: [],
  regColor: null,
  cancelMatch: false,
};

const isLoginPage = document.body && document.body.dataset.page === 'login';
const screen = document.getElementById('screen');
let templates = {};

function initLoginPage(){
  const roleButtons = Array.from(document.querySelectorAll('.role'));
  const roleChip = document.getElementById('roleChip');
  const loginButton = document.getElementById('loginButton');
  let selectedUrl = null;

  const roleLabels = {
    owner: '飼い主',
    finder: '発見者',
    shelter: '保護団体'
  };

  function selectRole(button) {
    roleButtons.forEach((item) => item.classList.remove('on'));
    button.classList.add('on');
    selectedUrl = button.getAttribute('data-url');
    roleChip.textContent = `選択中：${roleLabels[button.getAttribute('data-role')]}`;
  }

  roleButtons.forEach((button) => {
    button.addEventListener('click', () => selectRole(button));
  });

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault(); // 画面全体の勝手なリロードを防止
      if (!selectedUrl) {
        alert('利用者の種類（飼い主・発見者・保護団体）を選択してください。');
        return; 
      }
      // 1. 入力値と選択ロールの取得
      const email = loginForm.email.value;
      const password = loginForm.password.value;
      const selectedRole = document.querySelector('.role.on')?.getAttribute('data-role');

      // 2. ボタンを連打防止＆ローディング表示に変更
      loginButton.disabled = true;

      try {
        // 3. バックエンドAPI呼び出し（※現在はデモ用関数を実行）
        const result = await apiLogin(email, password, selectedRole);

        if (result.success) {
          // ログイン成功したら指定の画面へ移動
          window.location.href = selectedUrl;
        }
      } catch (error) {
        alert(error.message);
      } finally {
        // 4. ボタンの状態を元に戻す
        loginButton.disabled = false;
      }
    });
  }
}

async function apiLogin(email, password, role) {
  // 【デモ用】0.6秒だけ通信しているフリ（待ち時間）をする
  await new Promise(resolve => setTimeout(resolve, 600));

  /* ----------------------------------------------------
     本番コード例
     ----------------------------------------------------
     const response = await fetch('/api/login', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ email, password, role })
     });
     if (!response.ok) throw new Error('メールアドレスまたはパスワードが違います');
     return await response.json();
  ---------------------------------------------------- */

  // 正解として認めるメールアドレスとパスワードを定義(デモ用)
  const CORRECT_EMAIL = "demo@relink.jp";
  const CORRECT_PASS  = "demodemo";

  // 入力された値が合っているか判定
  if (email === CORRECT_EMAIL && password === CORRECT_PASS) {
    return { success: true };
  } else {
    throw new Error("メールアドレスまたはパスワードが正しくありません。");
  }
}

const roleLabel = {owner:'飼い主', finder:'発見者', shelter:'保護団体'};
const petColors = ['#c8935f','#e8c9a0','#7a5230','#3d3d3d','#e5e5e5','#f0f0f0'];

function petSwatch(i){return petColors[i%petColors.length];}

function renderTemplate(id, data = {}){
  if (!templates[id]) throw new Error(`Template not found: ${id}`);
  return templates[id]
    .replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (_match, key) => {
      const value = data[key];
      return value == null ? '' : String(value);
    })
    .replace(/__([A-Za-z0-9_]+)__/g, (_match, key) => {
      const value = data[key];
      return value == null ? '' : String(value);
    });
}

async function loadTemplates(){
  const response = await fetch('relink-demo-templates.html');
  if (!response.ok) throw new Error('テンプレートの読み込みに失敗しました。');
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('template[id]').forEach((template) => {
    templates[template.id] = template.innerHTML;
  });
}

function buildAppbar(title, backTo, role){
  const backButton = backTo !== null ? `<button class="back" onclick="go('${backTo}')">‹</button>` : '';
  const roleChip = role ? `<span class="role-chip">${roleLabel[role]}</span>` : '';
  return renderTemplate('appbar-template', { backButton, title, roleChip });
}

function renderRoleCard(key, emoji, title, desc){
  return renderTemplate('role-card-template', {
    state: S.role === key ? 'on' : '',
    key,
    emoji,
    title,
    desc,
  });
}

function renderNavCard(scr, icon, title, desc){
  return renderTemplate('nav-card-template', { scr, icon, title, desc });
}

function renderThumb(index){
  return renderTemplate('thumb-template', { color: petSwatch(index), index });
}

function renderSwatches(){
  return petColors.map((color, index) => {
    const on = S.regColor === index ? 'on' : '';
    return `<div class="sw ${on}" style="background:${color}" onclick="pickColor(${index})"></div>`;
  }).join('');
}

function renderMatchCard(item){
  return renderTemplate('match-card-template', {
    color: petSwatch(item.c),
    name: item.n,
    meta: item.meta,
    score: item.m,
  });
}

function renderShelterCard(item){
  const tagColor = { '照合中':'pill', '新規':'pill mag', '一致':'pill mag', '完了':'pill' };
  return renderTemplate('shelter-card-template', {
    color: petSwatch(item.c),
    name: item.n,
    meta: item.meta,
    tag: item.tag,
    tagClass: tagColor[item.tag] || 'pill',
  });
}

function renderNotifItem(item){
  const onclickAttr = item.to ? `onclick="go('${item.to}')" style="cursor:pointer"` : '';
  return renderTemplate('notif-template', {
    readClass: item.read ? 'read' : '',
    onclickAttr,
    title: item.t,
    body: item.b,
    time: item.tm,
  });
}

function buildNavActions(){
  if (S.role === 'owner') {
    return renderNavCard('register','📷','ペット情報を登録','迷子のペットの写真をアップして照合を開始')
      + renderNavCard('notify','🔔','通知を確認','似たペットが保護されたらここに届きます');
  }
  if (S.role === 'finder') {
    return renderNavCard('register','📸','ペットを保護・撮影','全体像と首輪を撮って自動マッチング')
      + renderNavCard('notify','🔔','受け渡し記録','引き渡したペットの記録を確認');
  }
  return renderNavCard('shelterList','📋','保護ペット一覧','現在保護中のペットを確認・照合')
    + renderNavCard('register','📷','新規保護を登録','保護したペットを撮影して登録')
    + renderNavCard('notify','🔔','お知らせ','マッチング結果と受け渡し通知');
}

function renderThumbs(){
  return S.regPhotos.map((_, index) => renderThumb(index)).join('');
}

/* ---------------- Screens ---------------- */
const screens = {
  login(){
    const roleCards = [
      renderRoleCard('owner','🧑','飼い主として使う','迷子のペットを登録・通知を受け取る'),
      renderRoleCard('finder','🙋','発見者として使う','保護したペットを撮影して照合する'),
      renderRoleCard('shelter','🏥','保護団体として使う','保護中のペット一覧を管理する'),
    ].join('');
    return renderTemplate('login-template', { roleCards });
  },

  home(){
    return renderTemplate('home-template', {
      appbar: buildAppbar('ホーム', null, S.role),
      roleName: roleLabel[S.role] || '',
      actions: buildNavActions(),
    });
  },

  register(){
    const finder = S.role !== 'owner';
    const extraField = finder
      ? `<div class="field"><label>発見場所</label><input class="input" value="石川県 輪島市 ○○町" placeholder="市区町村"></div><div class="field"><label>発見日時</label><input class="input" type="datetime-local" value="2026-07-07T09:30"></div>`
      : `<div class="field"><label>連絡先電話番号</label><input class="input" type="tel" value="090-1234-5678" placeholder="090-0000-0000"></div>`;

    return renderTemplate('register-template', {
      appbar: buildAppbar(finder ? 'ペットを保護・登録' : 'ペット情報を登録', 'home', S.role),
      heading: finder ? '保護したペットを撮る' : '手持ちの写真をアップ',
      thumbs: renderThumbs(),
      extraField,
      swatches: renderSwatches(),
    });
  },

  matching(){
    const paw = ['t1','t2','t3','t4'].map((className) => `<div class="pad-shape toe ${className}"><div class="fill" style="height:0%"></div></div>`).join('')
      + '<div class="pad-shape heel"><div class="fill" style="height:0%"></div></div>';
    return renderTemplate('matching-template', { paw });
  },

  results(){
    const data = [
      {n:'ぽん太',  m:95, c:0, meta:'柴犬・オス / ○○保健所で保護 / 首輪：赤い革'},
      {n:'候補 2',  m:93, c:1, meta:'柴犬・推定オス / △△市で発見 / 首輪：赤系'},
      {n:'候補 3',  m:91, c:2, meta:'柴系雑種 / □□町で保護 / 首輪あり'},
      {n:'候補 4',  m:89, c:3, meta:'柴犬・不明 / 発見者宅で一時保護'},
      {n:'候補 5',  m:87, c:4, meta:'中型犬 / ○○市 / 首輪：色不明'},
      {n:'候補 6',  m:86, c:5, meta:'柴系 / △△市で保護'},
    ];
    return renderTemplate('results-template', {
      appbar: buildAppbar('マッチング結果', 'register', S.role),
      rows: data.map(renderMatchCard).join(''),
    });
  },

  petDetail(){
    return renderTemplate('petDetail-template', {
      appbar: buildAppbar('保護ペットの詳細', 'results', S.role),
      petColor: petSwatch(0),
    });
  },

  contactDone(){
    return renderTemplate('contactDone-template', {
      appbar: buildAppbar('連絡を送信', 'petDetail', S.role),
    });
  },

  shelterList(){
    const data = [
      {n:'保護 #A21',c:0,meta:'柴犬 / ○○保健所 / 照合待ち 2件',tag:'照合中'},
      {n:'保護 #A20',c:3,meta:'トイプードル / 発見者から受入',tag:'新規'},
      {n:'保護 #A18',c:2,meta:'雑種 / 飼い主候補 95%',tag:'一致'},
      {n:'保護 #A15',c:5,meta:'柴系 / 引き渡し済み',tag:'完了'},
    ];
    return renderTemplate('shelterList-template', {
      appbar: buildAppbar('保護ペット一覧', 'home', S.role),
      rows: data.map(renderShelterCard).join(''),
    });
  },

  notify(){
    const items = [
      {t:'似たペットが保護されました', b:'マッチ率95%：柴犬「ぽん太」が○○保健所で保護されました。詳細を確認してください。', tm:'たった今', read:false, to:'petDetail'},
      {t:'AIマッチングが完了', b:'登録したペットについて6件の候補が見つかりました。', tm:'5分前', read:false, to:'results'},
      {t:'受け渡し記録の共有', b:'発見者から飼い主へ直接引き渡された記録が保健所に共有されました。', tm:'2時間前', read:true, to:null},
      {t:'新しい保護情報', b:'△△市でトイプードルが保護されました。登録内容と照合中です。', tm:'昨日', read:true, to:null},
    ];
    return renderTemplate('notify-template', {
      appbar: buildAppbar('お知らせ', 'home', S.role),
      rows: items.map(renderNotifItem).join(''),
    });
  },
};

/* ---------------- Router & actions ---------------- */
function go(name){
  screen.scrollTop = 0;
  screen.innerHTML = screens[name]();
  if (name === 'matching') startMatch();
}

function setRole(role){ S.role = role; go('login'); }
function login(){ if (!S.role) { shake(); return; } go('home'); }
function switchRole(){ S.role = null; go('login'); }

function shake(){
  const roles = document.querySelector('.roles');
  if (!roles) return;
  roles.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:260});
}

/* register helpers */
function addPhoto(){
  S.regPhotos.push(S.regPhotos.length);
  const thumbs = document.getElementById('thumbs');
  if (thumbs) thumbs.innerHTML = renderThumbs();
}

function rmPhoto(index){
  S.regPhotos.splice(index, 1);
  const thumbs = document.getElementById('thumbs');
  if (thumbs) thumbs.innerHTML = renderThumbs();
}

function pickColor(index){
  S.regColor = index;
  document.querySelectorAll('#swatches .sw').forEach((element, currentIndex) => {
    element.classList.toggle('on', currentIndex === index);
  });
}

/* matching animation */
let matchTimer = null;
function startMatch(){
  S.cancelMatch = false;
  let progress = 0;
  const bar = document.getElementById('bar');
  const pct = document.getElementById('pct');
  const fills = document.querySelectorAll('#paw .fill');
  matchTimer = setInterval(() => {
    if (S.cancelMatch) { clearInterval(matchTimer); return; }
    progress += Math.random() * 7 + 3;
    if (progress >= 100) progress = 100;
    bar.style.width = progress + '%';
    pct.textContent = Math.round(progress) + '%';
    fills.forEach((fill) => { fill.style.height = progress + '%'; });
    if (progress >= 100) {
      clearInterval(matchTimer);
      setTimeout(() => { if (!S.cancelMatch) go('results'); }, 420);
    }
  }, 220);
}

function cancelMatch(){
  S.cancelMatch = true;
  if (matchTimer) clearInterval(matchTimer);
  go('register');
}

if (isLoginPage) {
  initLoginPage();
} else if (screen) {
  loadTemplates()
    .then(() => {
      const pageRole = document.body.dataset.page || sessionStorage.getItem('selectedRole') || 'owner';
      S.role = pageRole;
      go(pageRole); 
      })
    .catch((error) => {
      console.error(error);
      screen.innerHTML = '<div class="pad"><p>テンプレートの読み込みに失敗しました。</p></div>';
    });
}

// 保護ペットの情報
const petData = {

  id: "A21",

  name: "保護 #A21",

  status: "照合中",

  breed: "柴犬 / オス",

  color: "薄い茶色・白",

  collar: "赤い革製",

  location: "○○市○○町",

  date: "2026/07/06"

};



// 保護ペット詳細画面
const petName = document.getElementById("petName");

if (petName) {

  // 名前
  petName.textContent = petData.name;

  // 状態
  const petStatus =
    document.getElementById("petStatus");

  petStatus.textContent = petData.status;


  // 種類
  document.getElementById("petBreed").textContent =
    petData.breed;


  // 毛色
  document.getElementById("petColor").textContent =
    petData.color;


  // 首輪
  document.getElementById("petCollar").textContent =
    petData.collar;


  // 発見場所
  document.getElementById("petLocation").textContent =
    petData.location;


  // 保護日
  document.getElementById("petDate").textContent =
    petData.date;

  // 状態によってラベルの見た目を変更

  if (
    petData.status === "新規" ||
    petData.status === "一致"
  ) {

    petStatus.className = "pill mag";

  } else {

    petStatus.className = "pill";

  }

}

// Google Maps

function initMap() {

  // 仮の発見場所
  const location = {
    lat: 34.0703,
    lng: 134.5549
  };

  const map = new google.maps.Map(
    document.getElementById("map"),
    {
      center: location,
      zoom: 15
    }
  );

  new google.maps.Marker({
    position: location,
    map: map,
    title: "保護ペットの発見場所"
  });
}