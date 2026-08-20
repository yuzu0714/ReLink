/* ---------------- ReLINK demo — state & router ---------------- */
// Kotlinバックエンド(relink-api)のURL。
// ローカルで `./gradlew run` した状態だとデフォルトで8080番なのでこれで動く。
// どこかにデプロイしたら、ここをそのURLに書き換える。
const API_BASE = 'http://localhost:8080';

const S = {
  role: null,
  regPhotos: [],
  regColor: null,
  cancelMatch: false,
};

const isLoginPage = document.body && document.body.dataset.page === 'login';
const isOwnerPage = document.body && document.body.dataset.page === 'owner';
const isFinderPage = document.body && document.body.dataset.page === 'finder';
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
        // 3. バックエンドAPI呼び出し（/auth/test-loginを実際に叩く）
        const result = await apiLogin(email, password, selectedRole);

        if (result.success) {
          // ログインで受け取ったトークンとroleを保存(ページ遷移しても使えるように)
          sessionStorage.setItem('authToken', result.token);
          sessionStorage.setItem('selectedRole', selectedRole);
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
  // 注意: /auth/test-login は「roleを渡したらトークンが返ってくる」だけの
  // 動作確認用エンドポイントで、email/passwordの照合はまだしていない
  // (本物のログイン機能がバックエンド側にできたら、ここをそのAPIに差し替える)
  if (!email || !password) {
    throw new Error('メールアドレスとパスワードを入力してください。');
  }

  const response = await fetch(`${API_BASE}/auth/test-login?role=${encodeURIComponent(role)}`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('ログインに失敗しました。バックエンド(relink-api)が起動しているか確認してください。');
  }

  const data = await response.json();
  return { success: true, token: data.token };
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
async function callAiExtractFeatures(photoFiles){
  const token = sessionStorage.getItem('authToken');
  if(!token){
    throw new Error('ログインが必要です。ログイン画面からやり直してください。');
  }
  if(!photoFiles || photoFiles.length === 0){
    throw new Error('先に写真を1枚以上追加してください。');
  }

  const form = new FormData();
  photoFiles.forEach(f => form.append('photo', f));

  const res = await fetch(`${API_BASE}/pets/extract-features`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  });

  if(!res.ok){
    const body = await res.json().catch(()=>null);
    throw new Error((body && body.message) || ('AI解析に失敗しました。(status ' + res.status + ')'));
  }

  return res.json(); // { animalType, breed, coatColor, hasCollar, collarFeatures }
}

// 犬種・動物種のフリーテキストを、固定セレクトの選択肢に近いものへざっくり寄せる。
// 判別できない場合は自動選択しない(ユーザーに選んでもらう)。細かい犬種名は
// 呼び出し側で「そのほか」欄に残すので、ここでの選択が多少ざっくりでも情報は失われない。
function guessSpecieOption(animalType, breed){
  const text = `${animalType || ''} ${breed || ''}`;
  if(/柴/.test(text)) return '柴犬';
  if(/プードル/.test(text)) return 'トイプードル';
  if(/猫/.test(text)) return '猫（雑種）';
  if(/雑種/.test(text)) return '雑種（中型）';
  if(/犬/.test(text)) return 'その他';
  return '';
}

// 毛色のフリーテキストから、色見本(petColors/colorNames)に近いインデックスを探す
function colorKeywordIndex(text){
  for(let i=0;i<colorNames.length;i++){
    if(text.includes(colorNames[i])) return i;
  }
  if(/黒/.test(text)) return 3;
  if(/白/.test(text)) return 4;
  if(/(グレー|灰)/.test(text)) return 5;
  if(/茶/.test(text)) return 0;
  return -1;
}

const roleLabel = {owner:'飼い主', finder:'発見者', shelter:'保護団体'};
const petColors = ['#c8935f','#e8c9a0','#7a5230','#3d3d3d','#e5e5e5','#f0f0f0'];
// petColors と同じ順番の色名。バックエンドに送るcolorはテキストなのでここから引く。
const colorNames = ['茶色','クリーム色','こげ茶色','黒','白','グレー'];

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
  const response = await fetch('relink-demo.html');
  if (!response.ok) throw new Error('テンプレートの読み込みに失敗しました。');
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('template[id]').forEach((template) => {
    templates[template.id] = template.innerHTML;
  });
}

function buildAppbar(title, backTo, role){
  const backButton = backTo !== null
    ? `<button class="back" onclick="go('${backTo}')">‹</button>`
    : '';

  const roleChip = role
    ? `<span class="role-chip">${roleLabel[role]}</span>`
    : '';

  const accountButtons = role
    ? `
      <button class="appbar-btn" onclick="logout()">ログアウト</button>
      <button class="appbar-btn" onclick="switchRole()">役割を切り替える</button>
    `
    : '';

  return renderTemplate('appbar-template', {
    backButton,
    title,
    roleChip,
    accountButtons
  });
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

function setRole(role){
  S.role = role;
  go('login');
}

function login(){
  if (!S.role) {
    shake();
    return;
  }

  go('home');
}

function logout(){
  go('login');
}

function switchRole(){
  S.role = null;
  go('login');
}

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

function initOwnerPage(){
  const ownerScreen = document.querySelector('.screen');
  if (!ownerScreen) return;

  const homeMarkup = ownerScreen.innerHTML;
  let ownerMatchTimer = null;

  // 登録フォームの入力値をここにまとめる(showRegister()を開くたびに初期化される)
  let ownerState = { photos: [], color: null, specie: '', other: '', phone: '', lostPlace: '' };

  function ownerAppbar(title){
    return `<div class="appbar"><button class="back" type="button" data-owner-action="home">‹</button><h1>${title}</h1><div class="spacer"></div><span class="role-chip">Owner</span></div>`;
  }

  function showRegister(){
    ownerState = { photos: [], color: null, specie: '', other: '', phone: '', lostPlace: '' };
    ownerScreen.innerHTML = `${ownerAppbar('ペット情報を登録')}
      <div class="pad stack fade">
        <div><div class="eyebrow">STEP 1 / 撮影</div><h2 class="title">手持ちの写真をアップ</h2><div class="lede">全体像と、首輪がはっきり写った写真があるほど精度が上がります。</div></div>
        <input type="file" id="ownerFileInput" accept="image/*" multiple hidden>
        <div class="imgbox" data-owner-file><div class="big">📸</div><div class="cap"><b style="color:var(--navy)">タップして写真を追加</b><br>全体像 ＋ 首輪アップがおすすめ</div></div>
        <div class="owner-thumbs" id="ownerThumbs"></div>
        <button class="btn btn-ghost btn-sm" id="ownerAiFillBtn" type="button" style="width:100%" data-owner-action="ai-fill">🤖 写真からAIで自動入力（未入力の項目のみ）</button>
        <div class="footnote" style="padding:0 0 4px">写真を追加した後に押すと、種類・毛色・そのほか欄のうち、まだ入力していない項目だけをAIが推定して埋めます。すでに入力した項目は変更しません。</div>
        <div class="field"><label>連絡先電話番号</label><input class="input" id="ownerPhone" type="tel" placeholder="090-0000-0000" value="${ownerState.phone}"></div>
        <div class="field"><label>紛失場所</label><input class="input" id="ownerLostPlace" placeholder="市区町村" value="${ownerState.lostPlace}"></div>
        <div class="field"><label>種類・犬種</label><select class="input" id="ownerSpecie"><option value="" selected>選択してください</option><option>柴犬</option><option>トイプードル</option><option>雑種（中型）</option><option>猫（雑種）</option><option>その他</option></select></div>
        <div class="field"><label>毛色（1色選択）</label><div class="swatches" id="ownerSwatches">${petColors.map((color, index) => `<div class="sw" style="background:${color}" data-owner-color="${index}"></div>`).join('')}</div></div>
        <div class="field"><label>そのほか（アレルギー・伝えたいこと）</label><textarea class="input" id="ownerOther" placeholder="例）左耳が欠けている。人懐っこい。"></textarea></div>
        <button class="btn btn-magenta" type="button" id="ownerSubmitBtn" data-owner-action="submit-lost">🐾 登録情報を登録してAIマッチングを開始</button>
        <div class="footnote">まず迷子情報をバックエンドに登録し、そのあと条件で絞り込んで照合します。</div>
      </div>`;
    const fileInput = document.getElementById('ownerFileInput');
    fileInput.addEventListener('change', (event) => {
      const files = Array.from(event.target.files || []);
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          ownerState.photos.push({ file, dataUrl: loadEvent.target.result });
          const thumb = document.createElement('div');
          thumb.className = 'owner-thumb';
          thumb.style.backgroundImage = `url('${loadEvent.target.result}')`;
          document.getElementById('ownerThumbs').appendChild(thumb);
        };
        reader.readAsDataURL(file);
      });
      event.target.value = '';
    });
    document.getElementById('ownerPhone').addEventListener('input', (e) => { ownerState.phone = e.target.value; });
    document.getElementById('ownerLostPlace').addEventListener('input', (e) => { ownerState.lostPlace = e.target.value; });
    document.getElementById('ownerSpecie').addEventListener('change', (e) => { ownerState.specie = e.target.value; });
    document.getElementById('ownerOther').addEventListener('input', (e) => { ownerState.other = e.target.value; });
  }

  // 種類・毛色・そのほか欄のうち、まだ入力していない項目だけをAIの解析結果で埋める
  function applyOwnerAiTags(tags){
    const notes = [];
    const breedOrType = tags.breed || tags.animalType;

    if(!ownerState.specie){
      const guess = guessSpecieOption(tags.animalType, tags.breed);
      if(guess){
        ownerState.specie = guess;
        const sel = document.getElementById('ownerSpecie');
        if(sel) sel.value = guess;
      }
    }
    if(breedOrType) notes.push(`AI推定: ${breedOrType}`);

    if(ownerState.color === null && tags.coatColor){
      const idx = colorKeywordIndex(tags.coatColor);
      if(idx !== -1) pickOwnerColor(idx);
    }
    if(tags.coatColor) notes.push(`毛色: ${tags.coatColor}`);

    if(tags.hasCollar){
      notes.push(`首輪あり${tags.collarFeatures ? '（' + tags.collarFeatures + '）' : ''}`);
    }

    if(!ownerState.other && notes.length > 0){
      ownerState.other = notes.join(' / ');
      const ta = document.getElementById('ownerOther');
      if(ta) ta.value = ownerState.other;
    }
  }

  function pickOwnerColor(index){
    ownerState.color = index;
    document.querySelectorAll('#ownerSwatches .sw').forEach((el) => {
      el.classList.toggle('on', Number(el.dataset.ownerColor) === index);
    });
  }

  async function aiAutoFillOwner(){
    const btn = document.getElementById('ownerAiFillBtn');
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'AI解析中…';
    try {
      const tags = await callAiExtractFeatures(ownerState.photos.map(p => p.file));
      applyOwnerAiTags(tags);
    } catch (err) {
      console.error(err);
      if(err.message && err.message.includes('ログイン')){
        alert(err.message);
        window.location.href = 'login.html';
        return;
      }
      alert(err.message || 'AI解析中にエラーが発生しました。手動で入力してください。');
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }

  // 迷子情報をrelink-apiに実際に登録する処理
  // 1. ログイン時にもらったトークンを確認
  // 2. 写真を /pets/photos にアップロードしてphoto_urlをもらう
  // 3. /pets/lost に迷子情報を送って登録する
  async function submitLost(){
    const token = sessionStorage.getItem('authToken');
    if(!token){
      alert('ログインが必要です。ログイン画面からやり直してください。');
      window.location.href = 'login.html';
      return;
    }
    if(ownerState.photos.length === 0){
      alert('写真を1枚以上追加してください。');
      return;
    }
    if(!ownerState.phone){
      alert('連絡先電話番号を入力してください。');
      return;
    }
    if(!ownerState.lostPlace){
      alert('紛失場所を入力してください。');
      return;
    }
    if(!ownerState.specie){
      alert('種類・犬種を選択してください。');
      return;
    }
    if(ownerState.color === null){
      alert('毛色を選択してください。');
      return;
    }

    const submitBtn = document.getElementById('ownerSubmitBtn');
    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = '登録中…';

    try {
      const firstPhoto = ownerState.photos[0].file;
      const form = new FormData();
      form.append('photo', firstPhoto);

      const uploadRes = await fetch(`${API_BASE}/pets/photos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form,
      });
      if(!uploadRes.ok){
        throw new Error('写真のアップロードに失敗しました。(status ' + uploadRes.status + ')');
      }
      const { photoUrl } = await uploadRes.json();

      const lostRes = await fetch(`${API_BASE}/pets/lost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          photoUrl,
          phoneNumber: ownerState.phone,
          specie: ownerState.specie,
          color: colorNames[ownerState.color],
          other: ownerState.other || null,
          lostPlace: ownerState.lostPlace,
        }),
      });

      if(!lostRes.ok){
        if(lostRes.status === 403){
          throw new Error('この操作には飼い主(owner)権限が必要です。ログインし直してください。');
        }
        const body = await lostRes.json().catch(()=>null);
        throw new Error((body && body.message) || ('登録に失敗しました。(status ' + lostRes.status + ')'));
      }

      // 登録できたら、そのままAIマッチングのアニメーションへ(マッチング自体は未実装)
      showMatching();
    } catch (err) {
      console.error(err);
      alert(err.message || '登録中にエラーが発生しました。');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  }

  function showNotify(){
    ownerScreen.innerHTML = `${ownerAppbar('お知らせ')}
      <div class="pad stack fade">
        <div class="notif"><div class="dot"></div><div><div class="nt">似たペットが保護されました</div><div class="nb">マッチ率95%：柴犬「ぽん太」が○○保健所で保護されました。</div><div class="tm">たった今</div></div></div>
        <div class="notif"><div class="dot"></div><div><div class="nt">AIマッチングが完了</div><div class="nb">登録したペットについて候補が見つかりました。</div><div class="tm">5分前</div></div></div>
        <div class="notif read"><div class="dot"></div><div><div class="nt">受け渡し記録の共有</div><div class="nb">発見者から飼い主へ引き渡された記録が共有されました。</div><div class="tm">2時間前</div></div></div>
      </div>`;
  }

  function showMatching(){
    ownerScreen.innerHTML = `${ownerAppbar('AIマッチング')}
      <div class="loader-wrap fade"><div class="eyebrow">AI MATCHING</div><div class="paw-container"><svg class="paw-svg" viewBox="0 0 100 100"><defs><mask id="owner-paw-mask"><g transform="translate(3.8, 90) scale(0.018, -0.018)"><path d="M1799 4626 c-124 -45 -260 -153 -360 -284 -199 -263 -298 -687 -230 -987 29 -128 67 -247 96 -305 56 -110 206 -235 330 -272 54 -17 95 -22 175 -21 93 0 116 4 195 33 118 42 168 72 237 143 126 128 169 279 172 602 1 234 -14 369 -64 555 -49 186 -87 278 -150 368 -57 81 -103 122 -179 158 -79 37 -141 40 -222 10z" fill="white"/><path d="M3085 4626 c-183 -58 -269 -174 -373 -501 -71 -224 -71 -225 -86 -370 -22 -204 0 -521 43 -635 68 -178 192 -281 411 -341 110 -30 256 -32 348 -5 120 36 273 159 326 263 58 115 108 353 107 507 -2 235 -79 512 -206 736 -100 177 -230 291 -389 339 -77 24 -123 25 -181 7z" fill="white"/><path d="M598 3326 c-95 -34 -187 -115 -261 -231 -59 -92 -92 -173 -122 -298 -71 -292 -73 -593 -4 -800 61 -183 158 -302 305 -373 145 -71 296 -89 439 -52 66 17 205 99 272 162 140 130 212 392 169 618 -44 235 -199 552 -381 782 -98 124 -166 172 -273 195 -67 14 -98 13 -144 -3z" fill="white"/><path d="M4290 3327 c-106 -25 -164 -66 -260 -187 -191 -240 -356 -583 -390 -815 -30 -200 31 -437 145 -563 56 -62 101 -94 210 -151 106 -55 217 -70 349 -48 112 20 236 78 307 144 218 202 285 590 183 1053 -47 211 -127 367 -244 473 -104 93 -188 120 -300 94z" fill="white"/><path d="M2379 2616 c-120 -36 -168 -64 -262 -155 -108 -104 -132 -137 -242 -326 -130 -224 -228 -366 -298 -432 -64 -60 -219 -181 -342 -268 -114 -81 -221 -189 -255 -259 -49 -100 -65 -177 -64 -311 0 -229 70 -368 242 -479 246 -159 527 -170 888 -35 170 64 229 71 511 67 269 -5 268 -5 479 -81 334 -122 624 -103 856 54 84 57 133 109 166 176 58 115 67 157 66 303 0 119 -3 145 -27 215 -32 96 -68 156 -133 219 -48 46 -74 66 -308 242 -184 138 -244 199 -339 342 -46 70 -114 181 -152 247 -93 165 -139 227 -238 322 -96 92 -147 121 -273 158 -106 31 -175 31 -275 1z" fill="white"/></g></mask></defs><g mask="url(#owner-paw-mask)"><rect x="0" y="0" width="100" height="100" fill="var(--line)"/><rect id="owner-paw-fill" x="0" y="100" width="100" height="100" fill="url(#owner-paw-gradient)"/></g><defs><linearGradient id="owner-paw-gradient" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="var(--magenta)"/><stop offset="100%" stop-color="var(--cyan)"/></linearGradient></defs></svg></div><div class="mm">マッチング中…</div><div class="barwrap"><div class="bar"><i id="ownerBar" style="width:0%"></i></div><div class="pct" id="ownerPct">0%</div></div><div class="lede" style="max-width:260px">保護中のペットの中から、外見と首輪の特徴が近い子を探しています。</div><button class="cancel-link" type="button" data-owner-action="register">時間がかかる場合はキャンセル</button></div>`;
    let progress = 0;
    ownerMatchTimer = setInterval(() => {
      progress = Math.min(100, progress + 10);
      const bar = document.getElementById('ownerBar');
      const pct = document.getElementById('ownerPct');
      const fill = document.getElementById('owner-paw-fill');
      if (bar) bar.style.width = `${progress}%`;
      if (pct) pct.textContent = `${progress}%`;
      if (fill) fill.setAttribute('y', 85 - (progress / 100) * 78);
      if (progress >= 100) { clearInterval(ownerMatchTimer); ownerMatchTimer = null; setTimeout(showResults, 420); }
    }, 120);
  }

  function showResults(){
    ownerScreen.innerHTML = `${ownerAppbar('マッチング結果')}
      <div class="pad stack fade"><div class="card" style="background:#f2f4ff;border-color:#d8ddfb"><b style="color:var(--navy)">6件ヒットしました</b><div class="lede">マッチ率が高い順に表示しています。</div></div>
        ${[['ぽん太',95,'#c8935f','柴犬・オス / ○○保健所で保護 / 首輪：赤い革'],['候補 2',93,'#e8c9a0','柴犬・推定オス / △△市で発見 / 首輪：赤系'],['候補 3',91,'#7a5230','柴系雑種 / □□町で保護 / 首輪あり'],['候補 4',89,'#3d3d3d','柴犬・不明 / 発見者宅で一時保護'],['候補 5',87,'#e5e5e5','中型犬 / ○○市 / 首輪：色不明'],['候補 6',86,'#f0f0f0','柴系 / △△市で保護']].map(([name, score, color, meta]) => `<div class="match-card" data-owner-action="pet-detail"><div class="ph" style="background:${color}">🐕</div><div><div class="name">${name}</div><div class="meta">${meta}</div></div><div class="score"><b>${score}%</b><span>マッチ率</span></div></div>`).join('')}
      </div>`;
  }

  function showPetDetail(){
    ownerScreen.innerHTML = `${ownerAppbar('保護ペットの詳細')}
      <div class="pad stack fade"><div class="owner-pet-photo" style="background:#c8935f">🐕</div><div class="owner-pet-title"><h2 class="title">ぽん太</h2><span class="pill mag">マッチ率 95%</span></div><div class="card owner-info-card"><div><span>種類</span><b>柴犬 / オス</b></div><div><span>毛色</span><b>薄い茶色・白</b></div><div><span>首輪</span><b>赤い革製</b></div><div><span>保護場所</span><b>○○保健所</b></div></div><button class="btn btn-magenta" type="button" data-owner-action="home">この子について保健所に連絡する</button></div>`;
  }

  ownerScreen.addEventListener('click', (event) => {
    const action = event.target.closest('[data-owner-action]');
    if (action) {
      const name = action.dataset.ownerAction;
      if (ownerMatchTimer && name !== 'matching') { clearInterval(ownerMatchTimer); ownerMatchTimer = null; }
      if (name === 'register') showRegister();
      if (name === 'notify' || name === 'notice-list') showNotify();
      if (name === 'submit-lost') submitLost();
      if (name === 'ai-fill') aiAutoFillOwner();
      if (name === 'pet-detail') showPetDetail();
      if (name === 'home' && ownerScreen.innerHTML !== homeMarkup) ownerScreen.innerHTML = homeMarkup;
      if (name === 'switch-role') {
        sessionStorage.removeItem('selectedRole');
        window.location.href = 'login.html';
      }
      return;
    }
    const imageBox = event.target.closest('.imgbox');
    if (imageBox) document.getElementById('ownerFileInput')?.click();
    const swatch = event.target.closest('.sw[data-owner-color]');
    if (swatch) pickOwnerColor(Number(swatch.dataset.ownerColor));
  });
}

if (!isFinderPage && isLoginPage) {
  initLoginPage();
} else if (!isFinderPage && isOwnerPage) {
  initOwnerPage();
} else if (!isFinderPage && screen) {
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

/* ---------------- finder feature set ---------------- */
(() => {
const S = {
  role: 'finder',
  regPhotos: [],
  regColors: [],
  cancelMatch: false,
  foundPlace: '',
  foundDate: '',
  specie: '',
  other: '',
};

const screen = document.getElementById('screen');
const $ = (h)=>{const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstElementChild;};

// hidden file input for photo uploads
const fileInput = (()=>{
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.multiple = true;
  inp.style.display = 'none';
  inp.id = 'file-input';
  document.body.appendChild(inp);
  inp.addEventListener('change', (e)=>{
    const files = Array.from(inp.files || []);
    files.forEach(f=>{
      const src = URL.createObjectURL(f);
      S.regPhotos.push({file: f, src});
    });
    const t = document.getElementById('thumbs');
    if(t) t.innerHTML = renderThumbs();
    inp.value = '';
  });
  return inp;
})();

const roleLabel = {owner:'飼い主', finder:'発見者', shelter:'保護団体'};
const roleChip = (r)=> r ? `<span class="role-chip">${roleLabel[r]}</span>` : '';
const petColors = ['#c8935f','#e8c9a0','#7a5230','#3d3d3d','#e5e5e5','#f0f0f0'];
// petColors と同じ順番の色名。/pets/found に送る色(color)はテキストなのでここから引く。
const colorNames = ['茶色','クリーム色','こげ茶色','黒','白','グレー'];

function petSwatch(i){return petColors[i%petColors.length];}

function appbar(title, backTo, role){
  const action = backTo !== null ? `go('${backTo}')` : 'window.history.back()';
  return `<div class="appbar">
    <button class="back" onclick="${action}">‹</button>
    <h1>${title}</h1><div class="spacer"></div>${roleChip(role)}
  </div>`;
}

const screens = {
  register(){
    const finder = S.role!=='owner';
    return `
    ${appbar(finder?'ペットを保護・登録':'ペット情報を登録','finder',S.role)}
    <div class="pad stack fade">
      <div>
        <div class="eyebrow">STEP 1 / 撮影</div>
        <h2 class="title" style="font-size:19px">${finder?'保護したペットを撮る':'手持ちの写真をアップ'}</h2>
        <div class="lede">全体像と、首輪がはっきり写った写真があるほど精度が上がります。事前登録は不要です。</div>
      </div>

      <div class="imgbox" onclick="addPhoto()">
        <div class="big">📸</div>
        <div class="cap"><b style="color:var(--navy)">タップして写真を追加</b><br>全体像 ＋ 首輪アップがおすすめ</div>
      </div>
      <div class="thumbs" id="thumbs">${renderThumbs()}</div>

      <button class="btn btn-ghost btn-sm" id="aiFillBtn" style="width:100%" onclick="aiAutoFill()">
        🤖 写真からAIで自動入力（未入力の項目のみ）
      </button>
      <div class="footnote" style="padding:0 0 4px">写真を追加した後に押すと、種類・毛色・そのほか欄のうち、まだ入力していない項目だけをAIが推定して埋めます。すでに入力した項目は変更しません。</div>

      ${finder ? `
      <div class="field"><label>発見場所</label>
        <input class="input" id="foundPlace" value="${S.foundPlace||''}" placeholder="市区町村" oninput="S.foundPlace=this.value"></div>
      <div class="field"><label>発見日時</label>
        <input class="input" id="foundDate" type="datetime-local" value="${S.foundDate||''}" oninput="S.foundDate=this.value"></div>
      ` : `
      <div class="field"><label>連絡先電話番号</label>
        <input class="input" type="tel" value="090-1234-5678" placeholder="090-0000-0000"></div>
      `}

      <div class="field"><label>種類・犬種</label>
        <select class="input" id="specie" onchange="S.specie=this.value">
          <option value="">選択してください</option>
          <option>柴犬</option><option>トイプードル</option><option>雑種（中型）</option>
          <option>猫（雑種）</option><option>その他</option>
        </select></div>

      <div class="field"><label>毛色（複数選択可）</label>
        <div class="swatches" id="swatches">
          ${petColors.map((c,i)=>`<div class="sw ${S.regColors.includes(i)?'on':''}" style="background:${c}" onclick="pickColor(${i})"></div>`).join('')}
        </div></div>

      <div class="field"><label>そのほか（アレルギー・伝えたいこと）</label>
        <textarea class="input" id="other" placeholder="例）左耳が欠けている。人懐っこい。" oninput="S.other=this.value">${S.other||''}</textarea></div>

      <button class="btn btn-magenta" onclick="go('step2')">
        🐾 登録
      </button>
      <div class="footnote">条件で絞り込んだ後、画像識別モデルが特徴を照合します。</div>
    </div>`;
  },

  step2(){
    return `
    ${appbar('STEP 2 / 保護方法の登録','register',S.role)}
    <div class="pad stack fade">
      <div>
        <div class="eyebrow">STEP 2 / 保護方法</div>
        <h2 class="title" style="font-size:19px">保護方法を選択してください</h2>
        <div class="lede">この情報は受け渡し記録に含まれます。適切な保護方法を選んでください。</div>
      </div>

      <div class="card">
        <div class="field"><label>保護方法</label>
          <div style="display:flex;flex-direction:column;gap:12px">
            <label style="display:flex;align-items:center;gap:10px;font-weight:700;line-height:1.2"><input type="radio" name="method" value="temporary" checked style="width:18px;height:18px;margin:0"> <span>自宅保護</span></label>
            <label style="display:flex;align-items:center;gap:10px;font-weight:700;line-height:1.2"><input type="radio" name="method" value="shelter" style="width:18px;height:18px;margin:0"> <span>保護団体・シェルターへ連絡・引き渡し</span></label>
            <label style="display:flex;align-items:center;gap:10px;font-weight:700;line-height:1.2"><input type="radio" name="method" value="healthcenter" style="width:18px;height:18px;margin:0"> <span>保健所へ引き渡す</span></label>
          </div>
        </div>
        <div id="handoverFields" style="display:none">
          <div class="field" style="margin-top:12px"><label>引き渡し予定日時</label><input id="handoverDatetime" class="input" type="datetime-local"></div>
          <div class="field" style="margin-top:12px"><label>引き渡し先（任意）</label><input id="handoverTo" class="input" placeholder="例: ○○保健所 / 山田様"></div>
        </div>
      </div>

      <div class="card">
        <div class="eyebrow">補足・注意事項</div>
        <div style="margin-top:12px;padding:12px 14px;border-radius:12px;background:#f8fafc;border:1px solid var(--line);line-height:1.6;color:var(--ink)">
          必要に応じて写真や連絡先を確認し、適切な保護方法を選んでください。
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" id="submitFoundBtn" onclick="submitFound()">登録して完了</button>
        <button class="btn btn-ghost" onclick="go('register')">戻る</button>
      </div>

    </div>`;
  },


  results(){
    return `
    ${appbar('マッチング結果','register',S.role)}
    <div class="pad stack fade">
      <div class="card" style="background:#f2f4ff;border-color:#d8ddfb">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:22px">✨</span>
          <div><b style="color:var(--navy)">マッチング完了！</b>
          <div class="lede" style="margin-top:2px">候補のペットが見つかりました。</div></div>
        </div>
      </div>
      <div style="text-align:center;padding:20px;background:#e6f7ff;border-radius:14px">
        <div style="font-size:40px">🐕</div>
        <div style="font-weight:800;font-size:16px;margin-top:8px">次のステップ</div>
        <div class="lede" style="margin-top:6px">マッチ率が高い候補を確認して連絡してください。</div>
      </div>
    </div>`;
  },

  handoverList(){
    return `
    ${appbar('受け渡し記録', 'finder', S.role)}
    <div class="pad stack fade">
      <div class="card" style="background:linear-gradient(135deg,#edf5ff,#eefbf9);border-color:#dfe9ff">
        <div class="eyebrow" style="color:var(--navy)">HISTORY</div>
        <h2 class="title" style="font-size:20px;margin-bottom:8px">引き渡し記録</h2>
        <div class="lede" style="margin-top:0">以下の記録一覧から詳細を確認できます。</div>
      </div>

      <div class="role-item" style="cursor:pointer;padding:16px;border-radius:14px;border:1px solid var(--line);background:#fff;transition:background .15s" onclick="go('handoverDetail')" onmouseover="this.style.background='#f8fafb'" onmouseout="this.style.background='#fff'">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
            <div style="width:60px;height:60px;border-radius:14px;background:linear-gradient(135deg,#d9f99d,#86efac);display:grid;place-items:center;font-size:28px;flex-shrink:0">🐕</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:800;color:var(--navy)">柴犬・メス（約3歳）</div>
              <div class="lede" style="margin-top:4px;font-size:12px">2026/08/17 14:35 保護</div>
              <div style="margin-top:4px">
                <span style="display:inline-block;padding:3px 8px;border-radius:999px;background:#eafaf3;color:#0f7a4b;font-size:10px;font-weight:800">引渡し完了</span>
              </div>
            </div>
          </div>
          <div style="font-size:18px;color:var(--muted)">›</div>
        </div>
      </div>

      <div class="role-item" style="cursor:pointer;padding:16px;border-radius:14px;border:1px solid var(--line);background:#fff;transition:background .15s" onclick="alert('選択可能な情報がサンプルのみです');" onmouseover="this.style.background='#f8fafb'" onmouseout="this.style.background='#fff'">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
            <div style="width:60px;height:60px;border-radius:14px;background:linear-gradient(135deg,#fca5a5,#f87171);display:grid;place-items:center;font-size:28px;flex-shrink:0">🐈</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:800;color:var(--navy)">猫・オス（推定2歳）</div>
              <div class="lede" style="margin-top:4px;font-size:12px">2026/08/15 09:20 保護</div>
              <div style="margin-top:4px">
                <span style="display:inline-block;padding:3px 8px;border-radius:999px;background:#fef0e7;color:#b45309;font-size:10px;font-weight:800">調査中</span>
              </div>
            </div>
          </div>
          <div style="font-size:18px;color:var(--muted)">›</div>
        </div>
      </div>

      <div class="role-item" style="padding:16px;border-radius:14px;border:1px solid var(--line);background:#f9fafb;opacity:0.6">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
            <div style="width:60px;height:60px;border-radius:14px;background:linear-gradient(135deg,#ddd6fe,#c4b5fd);display:grid;place-items:center;font-size:28px;flex-shrink:0">🐕</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:800;color:var(--navy)">トイプードル・メス</div>
              <div class="lede" style="margin-top:4px;font-size:12px">2026/08/10 16:45 保護</div>
              <div style="margin-top:4px">
                <span style="display:inline-block;padding:3px 8px;border-radius:999px;background:#e0e7ff;color:#3730a3;font-size:10px;font-weight:800">飼い主確認完了</span>
              </div>
            </div>
          </div>
          <div style="font-size:18px;color:var(--muted)">›</div>
        </div>
      </div>
    </div>`;
  },

  notificationList(){
    return `
    ${appbar('お知らせ', 'finder', S.role)}
    <div class="pad stack fade">
      <div class="card" style="background:linear-gradient(135deg,#fef3c7,#fef08a);border-color:#fde68a">
        <div class="eyebrow" style="color:#b45309">NOTIFICATIONS</div>
        <h2 class="title" style="font-size:20px;margin-bottom:8px">お知らせ</h2>
        <div class="lede" style="margin-top:0">以下の通知一覧から詳細を確認できます。</div>
      </div>

      <div class="role-item" style="cursor:pointer;padding:16px;border-radius:14px;border:1px solid var(--line);background:#fff;transition:background .15s" onclick="go('notificationDetail')" onmouseover="this.style.background='#f8fafb'" onmouseout="this.style.background='#fff'">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="display:flex;align-items:flex-start;gap:12px;flex:1;min-width:0">
            <div style="font-size:24px;margin-top:2px;flex-shrink:0">✨</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:800;color:var(--navy)">マッチング完了のお知らせ</div>
              <div class="lede" style="margin-top:4px;font-size:13px">保護したペットの照合が完了しました。候補のペット情報をご確認ください。</div>
              <div style="margin-top:8px;font-size:11px;color:var(--muted)">2026年8月17日 15:45</div>
            </div>
          </div>
          <div style="font-size:18px;color:var(--muted)">›</div>
        </div>
      </div>

      <div class="role-item" style="cursor:pointer;padding:16px;border-radius:14px;border:1px solid var(--line);background:#fff;transition:background .15s" onclick="alert('選択可能な情報がサンプルのみです');" onmouseover="this.style.background='#f8fafb'" onmouseout="this.style.background='#fff'">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="display:flex;align-items:flex-start;gap:12px;flex:1;min-width:0">
            <div style="font-size:24px;margin-top:2px;flex-shrink:0">🤝</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:800;color:var(--navy)">引き渡し完了のお知らせ</div>
              <div class="lede" style="margin-top:4px;font-size:13px">保護したペットが飼い主様へ正式に引き渡されました。記録が保健所に共有されました。</div>
              <div style="margin-top:8px;font-size:11px;color:var(--muted)">2026年8月17日 18:20</div>
            </div>
          </div>
          <div style="font-size:18px;color:var(--muted)">›</div>
        </div>
      </div>

      <div class="role-item" style="cursor:pointer;padding:16px;border-radius:14px;border:1px solid var(--line);background:#fff;transition:background .15s" onclick="alert('選択可能な情報がサンプルのみです');" onmouseover="this.style.background='#f8fafb'" onmouseout="this.style.background='#fff'">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="display:flex;align-items:flex-start;gap:12px;flex:1;min-width:0">
            <div style="font-size:24px;margin-top:2px;flex-shrink:0">📞</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:800;color:var(--navy)">飼い主様からのご連絡</div>
              <div class="lede" style="margin-top:4px;font-size:13px">飼い主様からペットの状況についてのご連絡をいただきました。メッセージをご確認ください。</div>
              <div style="margin-top:8px;font-size:11px;color:var(--muted)">2026年8月16日 10:15</div>
            </div>
          </div>
          <div style="font-size:18px;color:var(--muted)">›</div>
        </div>
      </div>

      <div class="role-item" style="padding:16px;border-radius:14px;border:1px solid var(--line);background:#f9fafb;opacity:0.6">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="display:flex;align-items:flex-start;gap:12px;flex:1;min-width:0">
            <div style="font-size:24px;margin-top:2px;flex-shrink:0">ℹ️</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:800;color:var(--navy)">システムからのお知らせ</div>
              <div class="lede" style="margin-top:4px;font-size:13px">ReLINKサービスに関する重要なお知らせです。ご確認ください。</div>
              <div style="margin-top:8px;font-size:11px;color:var(--muted)">2026年8月14日 09:00</div>
            </div>
          </div>
          <div style="font-size:18px;color:var(--muted)">›</div>
        </div>
      </div>
    </div>`;
  },

  notificationDetail(){
    return `
    ${appbar('お知らせ', 'notificationList', S.role)}
    <div class="pad stack fade">
      <div class="card" style="background:linear-gradient(135deg,#fef3c7,#fef08a);border-color:#fde68a">
        <div class="eyebrow" style="color:#b45309">NOTIFICATION</div>
        <h2 class="title" style="font-size:20px;margin-bottom:8px">マッチング完了のお知らせ</h2>
        <div class="lede" style="margin-top:0">受信日時: 2026年8月17日 15:45</div>
      </div>

      <div class="card" style="background:#fef9f3;border-color:#fed7aa">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:32px">✨</div>
          <div>
            <div style="font-weight:800;color:var(--navy);font-size:15px">マッチング処理が完了いたしました</div>
            <div class="lede" style="margin-top:2px;font-size:13px">ご保護いただいたペットの照合結果をご確認ください。</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="eyebrow">本文</div>
        <div style="margin-top:12px;padding:12px 14px;border-radius:12px;background:#f8fafc;border:1px solid var(--line);line-height:1.8;color:var(--ink);font-size:13px">
          いつも ReLINK をご利用いただきありがとうございます。<br><br>
          
          保護中のペット情報の照合が完了しました。以下の候補が見つかりました：<br><br>
          
          <strong>📋 マッチング候補</strong><br>
          • 柴犬・メス（推定3歳）<br>
          • マッチ率: 92%<br>
          • 首輪の特徴が一致<br><br>
          
          飼い主様と連絡を取り、ペットの返却手続きをご進めください。ご不明な点はいつでもお気軽にお問い合わせください。
        </div>
      </div>

      <div class="card">
        <div class="eyebrow">アクション</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
          <button class="btn btn-primary" onclick="alert('マッチング結果ページへ遷移します')">
            📊 マッチング結果を確認
          </button>
          <button class="btn btn-ghost" onclick="alert('飼い主様の連絡先情報を表示します')">
            📞 飼い主様の連絡先
          </button>
        </div>
      </div>

      <button class="btn btn-ghost" onclick="go('notificationList')">通知一覧へ戻る</button>
    </div>`;
  },

  handoverList(){
    return `
    ${appbar('受け渡し記録', 'finder', S.role)}
    <div class="pad stack fade">
      <div class="card" style="background:linear-gradient(135deg,#edf5ff,#eefbf9);border-color:#dfe9ff">
        <div class="eyebrow" style="color:var(--navy)">HISTORY</div>
        <h2 class="title" style="font-size:20px;margin-bottom:8px">引き渡し記録</h2>
        <div class="lede" style="margin-top:0">以下の記録一覧から詳細を確認できます。</div>
      </div>

      <div class="role-item" style="cursor:pointer;padding:16px;border-radius:14px;border:1px solid var(--line);background:#fff;transition:background .15s" onclick="go('handoverDetail')" onmouseover="this.style.background='#f8fafb'" onmouseout="this.style.background='#fff'">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
            <div style="width:60px;height:60px;border-radius:14px;background:linear-gradient(135deg,#d9f99d,#86efac);display:grid;place-items:center;font-size:28px;flex-shrink:0">🐕</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:800;color:var(--navy)">柴犬・メス（約3歳）</div>
              <div class="lede" style="margin-top:4px;font-size:12px">2026/08/17 14:35 保護</div>
              <div style="margin-top:4px">
                <span style="display:inline-block;padding:3px 8px;border-radius:999px;background:#eafaf3;color:#0f7a4b;font-size:10px;font-weight:800">保健所への引渡し完了</span>
              </div>
            </div>
          </div>
          <div style="font-size:18px;color:var(--muted)">›</div>
        </div>
      </div>

      <div class="role-item" style="cursor:pointer;padding:16px;border-radius:14px;border:1px solid var(--line);background:#fff;transition:background .15s" onclick="alert('選択可能な情報がサンプルのみです');" onmouseover="this.style.background='#f8fafb'" onmouseout="this.style.background='#fff'">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
            <div style="width:60px;height:60px;border-radius:14px;background:linear-gradient(135deg,#fca5a5,#f87171);display:grid;place-items:center;font-size:28px;flex-shrink:0">🐈</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:800;color:var(--navy)">猫・オス（推定2歳）</div>
              <div class="lede" style="margin-top:4px;font-size:12px">2026/08/15 09:20 保護</div>
              <div style="margin-top:4px">
                <span style="display:inline-block;padding:3px 8px;border-radius:999px;background:#fef0e7;color:#b45309;font-size:10px;font-weight:800">保護中</span>
              </div>
            </div>
          </div>
          <div style="font-size:18px;color:var(--muted)">›</div>
        </div>
      </div>

      <div class="role-item" style="padding:16px;border-radius:14px;border:1px solid var(--line);background:#f9fafb;opacity:0.6">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
            <div style="width:60px;height:60px;border-radius:14px;background:linear-gradient(135deg,#ddd6fe,#c4b5fd);display:grid;place-items:center;font-size:28px;flex-shrink:0">🐕</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:800;color:var(--navy)">トイプードル・メス</div>
              <div class="lede" style="margin-top:4px;font-size:12px">2026/08/10 16:45 保護</div>
              <div style="margin-top:4px">
                <span style="display:inline-block;padding:3px 8px;border-radius:999px;background:#e0e7ff;color:#3730a3;font-size:10px;font-weight:800">飼い主確認完了</span>
              </div>
            </div>
          </div>
          <div style="font-size:18px;color:var(--muted)">›</div>
        </div>
      </div>
    </div>`;
  },

  handoverDetail(){
    return `
    ${appbar('受け渡し記録', 'handoverList', S.role)}
    <div class="pad stack fade">
      <div class="card" style="background:linear-gradient(135deg,#edf5ff,#eefbf9);border-color:#dfe9ff">
        <div class="eyebrow" style="color:var(--navy)">TRANSFER RECORD</div>
        <h2 class="title" style="font-size:20px;margin-bottom:8px">引き渡しが完了しました</h2>
        <div class="lede" style="margin-top:0">最終更新: 2026年8月17日 18:20</div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:#eafaf3;color:#0f7a4b;font-size:12px;font-weight:800;letter-spacing:.3px">引渡し完了</span>
          <span style="font-size:11px;color:var(--muted);font-weight:700">No. F-20260817-104</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:14px">
          <div style="width:72px;height:72px;border-radius:18px;background:linear-gradient(135deg,#d9f99d,#86efac);display:grid;place-items:center;font-size:36px">🐕</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:18px;font-weight:800;color:var(--navy)">柴犬・メス（約3歳）</div>
            <div class="lede" style="margin-top:4px">首輪: オレンジ / 迷子札あり</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="eyebrow">基本情報</div>
        <div class="field" style="margin-top:12px">
          <label>保護場所</label>
          <div class="input" style="display:flex;align-items:center;background:#fff;color:var(--ink);min-height:46px">東京都品川区西五反田 2-16-4</div>
        </div>
        <div class="field" style="margin-top:12px">
          <label>保護日時</label>
          <div class="input" style="display:flex;align-items:center;background:#fff;color:var(--ink);min-height:46px">2026/08/17 14:35</div>
        </div>
        <div class="field" style="margin-top:12px">
          <label>引き渡し先</label>
          <div class="input" style="display:flex;align-items:center;background:#fff;color:var(--ink);min-height:46px">飼い主・山田様（連絡先: 090-1234-5678）</div>
        </div>
      </div>

      <div class="card">
        <div class="eyebrow">補足事項</div>
        <div style="margin-top:12px;padding:12px 14px;border-radius:12px;background:#f8fafc;border:1px solid var(--line);line-height:1.7;color:var(--ink)">
          左耳に傷があります。人懐っこく、散歩中はリードを長く持つと落ち着きます。<br>
          体調については、当日夕方に少しだけぐったりしていたため、水分補給と休養を取らせてから引き渡しを行いました。
        </div>
      </div>

      <div class="card">
        <div class="eyebrow">写真</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
          <div style="width:80px;height:80px;border-radius:14px;background:linear-gradient(135deg,#d1fae5,#a7f3d0);display:grid;place-items:center;font-size:28px">🐕</div>
          <div style="width:80px;height:80px;border-radius:14px;background:linear-gradient(135deg,#fef3c7,#fcd34d);display:grid;place-items:center;font-size:28px">🦴</div>
          <div style="width:80px;height:80px;border-radius:14px;background:linear-gradient(135deg,#dbeafe,#93c5fd);display:grid;place-items:center;font-size:28px">📸</div>
        </div>
      </div>

      <button class="btn btn-primary" onclick="go('handoverList')">記録一覧へ戻る</button>
    </div>`;
  },

  finder(){
    return `
    ${appbar('発見者向け', null, S.role)}
    <div class="pad stack fade">
      <div class="hero-banner">
        <div class="hi">発見者向け機能</div>
        <div class="hn">保護したペットを撮影して照合できます。</div>
        <div class="hs">保護場所と日時を記録して、すぐに登録に進めます。</div>
      </div>

      <div class="role-list">
        <div class="role-item" style="cursor:pointer" onclick="go('register')">
          <div class="emo">📸</div>
          <div>
            <div class="title">ペットを保護・撮影</div>
            <div class="desc">全体像と首輪の写真を追加します。</div>
          </div>
        </div>
        <div class="role-item" style="cursor:pointer" onclick="go('handoverList')">
          <div class="emo">🔄</div>
          <div>
            <div class="title">受け渡し記録</div>
            <div class="desc">引き渡しの記録を確認できます。</div>
          </div>
        </div>
        <div class="role-item" style="cursor:pointer" onclick="go('notificationList')">
          <div class="emo">🔔</div>
          <div>
            <div class="title">お知らせ</div>
            <div class="desc">マッチング結果と引き渡し通知を確認します。</div>
          </div>
        </div>
      </div>

      <a class="btn btn-primary" href="login.html">ホームへ戻る</a>
    </div>`;
  }
};

function go(name){
screen.scrollTop = 0;
screen.innerHTML = screens[name]();
if (name === 'step2' && typeof initStep2 === 'function') initStep2();
}

function renderThumbs(){
  return S.regPhotos.map((p,i)=>`
    <div class="thumb" style="${p && p.src ? `background-image:url('${p.src}');background-size:cover;background-position:center` : `background:${petSwatch(i)}`}" onclick="event.stopPropagation()">
      ${p && p.src ? '' : '🐕'}
      <div class="x" onclick="event.stopPropagation();rmPhoto(${i})">×</div>
    </div>`).join('');
}

function addPhoto(){
  // open file picker
  if(window && fileInput) fileInput.click();
}

function rmPhoto(i){
  // revoke object URL if present, then remove
  const item = S.regPhotos[i];
  if(item && item.src) {
    try{ URL.revokeObjectURL(item.src); }catch(e){}
  }
  S.regPhotos.splice(i,1);
  const t=document.getElementById('thumbs');
  if(t) t.innerHTML=renderThumbs();
}

function pickColor(i){
  if (S.regColors.includes(i)) {
    S.regColors = S.regColors.filter((colorIndex) => colorIndex !== i);
  } else {
    S.regColors.push(i);
  }
  document.querySelectorAll('#swatches .sw').forEach((el, idx) => {
    el.classList.toggle('on', S.regColors.includes(idx));
  });
}

// 写真をKotlinバックエンド経由でAI特徴抽出サーバー(match_api.py)に送り、
// まだ入力していない項目(種類・犬種セレクト/毛色スウォッチ/そのほか欄)だけを自動入力する。
// フロント側の固定UI自体は変更せず、AIの自由な出力は「そのほか」欄に残す(callAiExtractFeaturesは
// demo.jsの共通ヘルパー。guessSpecieOption/colorKeywordIndexも同様に共通のものを使う)。
async function aiAutoFill(){
  if(S.regPhotos.length === 0){
    alert('先に写真を1枚以上追加してください。');
    return;
  }

  const btn = document.getElementById('aiFillBtn');
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'AI解析中…';

  try {
    const tags = await callAiExtractFeatures(S.regPhotos.map(p => p.file));
    applyAiTags(tags);
  } catch (err) {
    console.error(err);
    if(err.message && err.message.includes('ログイン')){
      alert(err.message);
      window.location.href = 'login.html';
      return;
    }
    alert(err.message || 'AI解析中にエラーが発生しました。手動で入力してください。');
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

// AIの解析結果({animalType, breed, coatColor, hasCollar, collarFeatures})を、未入力の項目にだけ反映する
function applyAiTags(tags){
  const notes = [];
  const breedOrType = tags.breed || tags.animalType;

  if(!S.specie){
    const guess = guessSpecieOption(tags.animalType, tags.breed);
    if(guess){
      S.specie = guess;
      const sel = document.getElementById('specie');
      if(sel) sel.value = guess;
    }
  }
  if(breedOrType) notes.push(`AI推定: ${breedOrType}`);

  if(S.regColors.length === 0 && tags.coatColor){
    const idx = colorKeywordIndex(tags.coatColor);
    if(idx !== -1) pickColor(idx);
  }
  if(tags.coatColor) notes.push(`毛色: ${tags.coatColor}`);

  if(tags.hasCollar){
    notes.push(`首輪あり${tags.collarFeatures ? '（' + tags.collarFeatures + '）' : ''}`);
  }

  if(!S.other && notes.length > 0){
    S.other = notes.join(' / ');
    const ta = document.getElementById('other');
    if(ta) ta.value = S.other;
  }
}

// 保護情報をrelink-apiに実際に登録する処理(STEP2の「登録して完了」ボタンから呼ばれる)
// 1. ログイン時にもらったトークンを確認
// 2. 写真を /pets/photos にアップロードしてphoto_urlをもらう
// 3. /pets/found に発見情報を送って登録する(保護方法・引き渡し予定はバックエンドの列がまだ無いので、
//    そのほか欄に追記する形で残す)
async function submitFound(){
  const token = sessionStorage.getItem('authToken');
  if(!token){
    alert('ログインが必要です。ログイン画面からやり直してください。');
    window.location.href = 'login.html';
    return;
  }
  if(S.regPhotos.length === 0){
    alert('写真を1枚以上追加してください。');
    return;
  }
  if(!S.foundPlace){
    alert('発見場所を入力してください。');
    return;
  }
  if(!S.foundDate){
    alert('発見日時を入力してください。');
    return;
  }
  if(!S.specie){
    alert('種類・犬種を選択してください。');
    return;
  }
  if(S.regColors.length === 0){
    alert('毛色を選択してください。');
    return;
  }

  const submitBtn = document.getElementById('submitFoundBtn');
  submitBtn.disabled = true;
  const originalLabel = submitBtn.textContent;
  submitBtn.textContent = '登録中…';

  try {
    const firstPhoto = S.regPhotos[0].file;
    const form = new FormData();
    form.append('photo', firstPhoto);

    const uploadRes = await fetch(`${API_BASE}/pets/photos`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form,
    });
    if(!uploadRes.ok){
      throw new Error('写真のアップロードに失敗しました。(status ' + uploadRes.status + ')');
    }
    const { photoUrl } = await uploadRes.json();

    // 保護方法(STEP2で選んだラジオボタン)を、そのほか欄に追記して情報を残す
    const methodLabels = { temporary: '自宅保護', shelter: '保護団体・シェルターへ引き渡し', healthcenter: '保健所へ引き渡し' };
    const methodInput = document.querySelector('input[name="method"]:checked');
    const methodNotes = [];
    if(methodInput){
      methodNotes.push(`保護方法: ${methodLabels[methodInput.value] || methodInput.value}`);
      const handoverDatetime = document.getElementById('handoverDatetime')?.value;
      const handoverTo = document.getElementById('handoverTo')?.value;
      if(handoverDatetime) methodNotes.push(`引き渡し予定: ${handoverDatetime}`);
      if(handoverTo) methodNotes.push(`引き渡し先: ${handoverTo}`);
    }
    const otherText = [S.other, ...methodNotes].filter(Boolean).join(' / ') || null;

    const foundRes = await fetch(`${API_BASE}/pets/found`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        photoUrl,
        foundPlace: S.foundPlace,
        foundDate: S.foundDate,
        specie: S.specie,
        color: S.regColors.map(i => colorNames[i]).join('・'),
        other: otherText,
      }),
    });

    if(!foundRes.ok){
      if(foundRes.status === 403){
        throw new Error('この操作には発見者(finder)権限が必要です。ログインし直してください。');
      }
      const body = await foundRes.json().catch(()=>null);
      throw new Error((body && body.message) || ('登録に失敗しました。(status ' + foundRes.status + ')'));
    }

    alert('登録が完了しました。');
    go('finder');
  } catch (err) {
    console.error(err);
    alert(err.message || '登録中にエラーが発生しました。');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
}

// 初期表示も動的な finder 画面を表示して、login.html から入った場合と内部遷移で戻った場合で同じ見た目にする
window.finderInit = () => go('finder');
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', window.finderInit); } else { window.finderInit(); }

// step2 初期化: 保護方法に応じて引き渡し予定のフィールド表示を切り替える
function initStep2(){
  try{
    const radios = Array.from(document.querySelectorAll('input[name="method"]'));
    const handover = document.getElementById('handoverFields');
    if(!radios.length || !handover) return;
    const toggle = ()=>{
      const v = radios.find(r=>r.checked)?.value;
      if(v === 'shelter' || v === 'healthcenter'){
        handover.style.display = 'block';
      } else {
        handover.style.display = 'none';
      }
    };
    radios.forEach(r=>r.addEventListener('change', toggle));
    // run once to set initial state
    toggle();
  }catch(e){console.error('initStep2 error', e)}
}

  window.finderGo = go;
  window.finderAddPhoto = addPhoto;
  window.finderRemovePhoto = rmPhoto;
  window.finderPickColor = pickColor;
  if (isFinderPage) {
    window.go = go;
    window.addPhoto = addPhoto;
    window.rmPhoto = rmPhoto;
    window.pickColor = pickColor;
    window.aiAutoFill = aiAutoFill;
    window.submitFound = submitFound;
  }
})();


