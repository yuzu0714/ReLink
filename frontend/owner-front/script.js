/* ---------------- ReLINK demo — state & router ---------------- */
const S = {
  role: null,            // 'owner' | 'finder' | 'shelter'
  regPhotos: [],
  regColors: [],
  cancelMatch: false,
};

const screen = document.getElementById('screen');
const $ = (h)=>{const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstElementChild;};

const roleLabel = {owner:'飼い主', finder:'発見者', shelter:'保護団体'};
const roleChip = (r)=> r ? `<span class="role-chip">${roleLabel[r]}</span>` : '';

function appbar(title, backTo, role){
  return `<div class="appbar">
    ${backTo!==null?`<button class="back" onclick="go('${backTo}')">‹</button>`:''}
    <h1>${title}</h1><div class="spacer"></div>${roleChip(role)}
  </div>`;
}

const petColors = ['#c8935f','#e8c9a0','#7a5230','#3d3d3d','#e5e5e5','#f0f0f0'];
function petSwatch(i){return petColors[i%petColors.length];}

/* ---------------- Screens ---------------- */
const screens = {

/* LOGIN ---------------------------------------------------------- */
login(){
  const roleCard = (key,emo,t,d)=>`
    <div class="role ${S.role===key?'on':''}" onclick="setRole('${key}')">
      <div class="emo">${emo}</div>
      <div><div class="rt">${t}</div><div class="rd">${d}</div></div>
      <div class="tick">✓</div>
    </div>`;
  return `
  <div class="appbar" style="justify-content:center;padding-top:38px">
    <h1 style="font-size:24px;letter-spacing:1px;position:static;">🐾 ReLINK</h1>
  </div>
  <div class="pad stack fade">
    <div style="text-align:center;margin:6px 0 4px">
      <div class="lede" style="margin-top:0">災害時ペット保護・マッチングシステム</div>
    </div>
    <div class="roles">
      ${roleCard('owner','🧑','飼い主として使う','迷子のペットを登録・通知を受け取る')}
      ${roleCard('finder','🙋','発見者として使う','保護したペットを撮影して照合する')}
      ${roleCard('shelter','🏥','保護団体として使う','保護中のペット一覧を管理する')}
    </div>
    <div class="field"><label>メールアドレス</label>
      <input class="input" type="email" value="demo@relink.jp" placeholder="mail@example.com"></div>
    <div class="field"><label>パスワード</label>
      <input class="input" type="password" value="demodemo" placeholder="••••••••"></div>
    <button class="btn btn-primary" onclick="login()">ログイン</button>
    <div class="footnote">ReLINK は事前登録なしでも利用できます。<br>デモ版のため入力内容は保存されません。</div>
  </div>`;
},

/* HOME ----------------------------------------------------------- */
home(){
  const nav = (scr,ic,t,d)=>`
    <div class="card card-nav" onclick="go('${scr}')">
      <div class="ic">${ic}</div>
      <div><div class="t">${t}</div><div class="d">${d}</div></div>
      <div class="arr">›</div>
    </div>`;

  let actions = '';
  if(S.role==='owner'){
    actions = nav('register','📷','ペット情報を登録','迷子のペットの写真をアップして照合を開始')
            + nav('notify','🔔','通知を確認','似たペットが保護されたらここに届きます');
  } else if(S.role==='finder'){
    actions = nav('register','📸','ペットを保護・撮影','全体像と首輪を撮って自動マッチング')
            + nav('notify','🔔','受け渡し記録','引き渡したペットの記録を確認');
  } else {
    actions = nav('shelterList','📋','保護ペット一覧','現在保護中のペットを確認・照合')
            + nav('register','📷','新規保護を登録','保護したペットを撮影して登録')
            + nav('notify','🔔','お知らせ','マッチング結果と受け渡し通知');
  }

  return `
  ${appbar('ホーム', null, S.role)}
  <div class="pad stack fade">
    <div class="hero-banner">
      <div class="hi">こんにちは、${roleLabel[S.role]}さん</div>
      <div class="hn">つなぎ直そう、大切な家族と。</div>
      <div class="hs">マイクロチップがなくても、写真だけでAIが飼い主とペットを結びます。</div>
    </div>
    ${actions}
    <div class="card card-nav" onclick="go('notify')">
      <div class="ic" style="background:linear-gradient(140deg,var(--magenta),#be185d)">🐕</div>
      <div><div class="t">お知らせ一覧</div><div class="d">最新の照合・保護情報をまとめて確認</div></div>
      <div class="arr">›</div>
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-ghost btn-sm" style="flex:1" onclick="go('login')">ログアウト</button>
      <button class="btn btn-ghost btn-sm" style="flex:1" onclick="switchRole()">役割を切替</button>
    </div>
  </div>`;
},

/* REGISTER ------------------------------------------------------- */
register(){
  const finder = S.role!=='owner';
  return `
  ${appbar(finder?'ペットを保護・登録':'ペット情報を登録','home',S.role)}
  <div class="pad stack fade">
    <div>
      <div class="eyebrow">STEP 1 / 撮影</div>
      <h2 class="title" style="font-size:19px">${finder?'保護したペットを撮る':'手持ちの写真をアップ'}</h2>
      <div class="lede">全体像と、首輪がはっきり写った写真があるほど精度が上がります。事前登録は不要です。</div>
    </div>

    <input type="file" id="fileInput" accept="image/*" style="display:none;" onchange="handleFileSelect(event)">
    <div class="imgbox" onclick="document.getElementById('fileInput').click()">
      <div class="big">📸</div>
      <div class="cap"><b style="color:var(--navy)">タップして写真を追加</b><br>全体像 ＋ 首輪アップがおすすめ</div>
    </div>
    <div class="thumbs" id="thumbs">${renderThumbs()}</div>

    ${finder ? `
    <div class="field"><label>発見場所</label>
      <input class="input" value="" placeholder="市区町村"></div>
    <div class="field"><label>発見日時</label>
      <input class="input" type="datetime-local" value=""></div>
    ` : `
    <div class="field"><label>連絡先電話番号</label>
      <input class="input" type="tel" value="" placeholder="090-0000-0000"></div>
    `}

    <div class="field"><label>種類・犬種</label>
      <select class="input">
        <option value="" disabled selected>選択してください</option>
        <option>柴犬</option><option>トイプードル</option><option>雑種（中型）</option>
        <option>猫（雑種）</option><option>その他</option>
      </select></div>

    <div class="field"><label>毛色（複数選択可）</label>
      <div class="swatches" id="swatches">
        ${petColors.map((c,i)=>`<div class="sw ${S.regColors.includes(i)?'on':''}" style="background:${c}" onclick="pickColor(${i})"></div>`).join('')}
      </div></div>

    <div class="field"><label>そのほか（アレルギー・伝えたいこと）</label>
      <textarea class="input" placeholder="例）左耳が欠けている。人懐っこい。"></textarea></div>

    <button class="btn btn-magenta" onclick="go('matching')">
      🐾 AIマッチングを開始
    </button>
    <div class="footnote">条件で絞り込んだ後、画像識別モデルが特徴を照合します。</div>
  </div>`;
},

/* MATCHING (signature loader) ------------------------------------ */
matching(){
  return `
  <div class="loader-wrap fade">
    <div class="eyebrow" style="color:var(--magenta)">AI MATCHING</div>
    <div class="paw-container">
      <svg class="paw-svg" viewBox="0 0 100 100">
        <defs>
          <!-- 肉球全体のシルエットマスク -->
          <mask id="paw-mask">
            <g transform="translate(3.8, 90) scale(0.018, -0.018)">
              <path d="M1799 4626 c-124 -45 -260 -153 -360 -284 -199 -263 -298 -687 -230
              -987 29 -128 67 -247 96 -305 56 -110 206 -235 330 -272 54 -17 95 -22 175
              -21 93 0 116 4 195 33 118 42 168 72 237 143 126 128 169 279 172 602 1 234
              -14 369 -64 555 -49 186 -87 278 -150 368 -57 81 -103 122 -179 158 -79 37
              -141 40 -222 10z" fill="white"/>
              <path d="M3085 4626 c-183 -58 -269 -174 -373 -501 -71 -224 -71 -225 -86
              -370 -22 -204 0 -521 43 -635 68 -178 192 -281 411 -341 110 -30 256 -32 348
              -5 120 36 273 159 326 263 58 115 108 353 107 507 -2 235 -79 512 -206 736
              -100 177 -230 291 -389 339 -77 24 -123 25 -181 7z" fill="white"/>
              <path d="M598 3326 c-95 -34 -187 -115 -261 -231 -59 -92 -92 -173 -122 -298
              -71 -292 -73 -593 -4 -800 61 -183 158 -302 305 -373 145 -71 296 -89 439 -52
              66 17 205 99 272 162 140 130 212 392 169 618 -44 235 -199 552 -381 782 -98
              124 -166 172 -273 195 -67 14 -98 13 -144 -3z" fill="white"/>
              <path d="M4290 3327 c-106 -25 -164 -66 -260 -187 -191 -240 -356 -583 -390
              -815 -30 -200 31 -437 145 -563 56 -62 101 -94 210 -151 106 -55 217 -70 349
              -48 112 20 236 78 307 144 218 202 285 590 183 1053 -47 211 -127 367 -244
              473 -104 93 -188 120 -300 94z" fill="white"/>
              <path d="M2379 2616 c-120 -36 -168 -64 -262 -155 -108 -104 -132 -137 -242
              -326 -130 -224 -228 -366 -298 -432 -64 -60 -219 -181 -342 -268 -114 -81
              -221 -189 -255 -259 -49 -100 -65 -177 -64 -311 0 -229 70 -368 242 -479 246
              -159 527 -170 888 -35 170 64 229 71 511 67 269 -5 268 -5 479 -81 334 -122
              624 -103 856 54 84 57 133 109 166 176 58 115 67 157 66 303 0 119 -3 145 -27
              215 -32 96 -68 156 -133 219 -48 46 -74 66 -308 242 -184 138 -244 199 -339
              342 -46 70 -114 181 -152 247 -93 165 -139 227 -238 322 -96 92 -147 121 -273
              158 -106 31 -175 31 -275 1z" fill="white"/>
            </g>
          </mask>
        </defs>
        <!-- 下地（グレーの肉球） -->
        <g mask="url(#paw-mask)">
          <rect x="0" y="0" width="100" height="100" fill="var(--line)" />
          <!-- 下から上がってくるグラデーション（Fill） -->
          <rect id="paw-fill-rect" x="0" y="100" width="100" height="100" fill="url(#paw-grad)" />
        </g>
        <!-- グラデーション定義 -->
        <defs>
          <linearGradient id="paw-grad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="var(--magenta)" />
            <stop offset="100%" stop-color="var(--cyan)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
    <div class="mm">マッチング中…</div>
    <div class="barwrap">
      <div class="bar"><i id="bar" style="width:0%"></i></div>
      <div class="pct" id="pct">0%</div>
    </div>
    <div class="lede" style="max-width:260px">保護中のペットの中から、外見と首輪の特徴が近い子を探しています。</div>
    <button class="cancel-link" onclick="cancelMatch()">時間がかかる場合はキャンセル</button>
  </div>`;
},

/* RESULTS -------------------------------------------------------- */
results(){
  const data = [
    {n:'ぽん太',  m:95, c:0, meta:'柴犬・オス / ○○保健所で保護 / 首輪：赤い革'},
    {n:'候補 2',  m:93, c:1, meta:'柴犬・推定オス / △△市で発見 / 首輪：赤系'},
    {n:'候補 3',  m:91, c:2, meta:'柴系雑種 / □□町で保護 / 首輪あり'},
    {n:'候補 4',  m:89, c:3, meta:'柴犬・不明 / 発見者宅で一時保護'},
    {n:'候補 5',  m:87, c:4, meta:'中型犬 / ○○市 / 首輪：色不明'},
    {n:'候補 6',  m:86, c:5, meta:'柴系 / △△市で保護'},
  ];
  const row = (d)=>`
    <div class="match-card" onclick="go('petDetail')">
      <div class="ph" style="background:${petSwatch(d.c)}">🐕</div>
      <div style="min-width:0">
        <div class="name">${d.n}</div>
        <div class="meta">${d.meta}</div>
      </div>
      <div class="score"><b>${d.m}%</b><span>マッチ率</span></div>
    </div>`;
  return `
  ${appbar('マッチング結果','register',S.role)}
  <div class="pad stack fade">
    <div class="card" style="background:#f2f4ff;border-color:#d8ddfb">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:22px">✨</span>
        <div><b style="color:var(--navy)">6件ヒットしました</b>
        <div class="lede" style="margin-top:2px">マッチ率が高い順に表示しています。85%以上の候補を確認して連絡してください。</div></div>
      </div>
    </div>
    ${data.map(row).join('')}
    <div class="footnote">似た個体が新たに保護された場合は、自動で通知が届きます。</div>
  </div>`;
},

/* PET DETAIL ----------------------------------------------------- */
petDetail(){
  return `
  ${appbar('保護ペットの詳細','results',S.role)}
  <div class="pad stack fade">
    <div class="ph" style="background:${petSwatch(0)};height:180px;border-radius:20px;display:grid;place-items:center;font-size:80px;color:#fff">🐕</div>
    <div style="display:flex;align-items:center;gap:8px">
      <h2 class="title" style="font-size:20px;margin:0">ぽん太</h2>
      <span class="pill mag">マッチ率 95%</span>
    </div>
    <div class="card stack" style="padding:14px">
      <div style="display:flex;justify-content:space-between"><span class="lede" style="margin:0">種類</span><b style="font-size:13px">柴犬 / オス</b></div>
      <div style="display:flex;justify-content:space-between"><span class="lede" style="margin:0">毛色</span><b style="font-size:13px">薄い茶色・白</b></div>
      <div style="display:flex;justify-content:space-between"><span class="lede" style="margin:0">首輪</span><b style="font-size:13px">赤い革製</b></div>
      <div style="display:flex;justify-content:space-between"><span class="lede" style="margin:0">保護場所</span><b style="font-size:13px">○○保健所</b></div>
      <div style="display:flex;justify-content:space-between"><span class="lede" style="margin:0">保護日</span><b style="font-size:13px">2026/07/06</b></div>
    </div>
    <div class="map">
      <div class="pin s1">🏥</div>
      <div class="pin you">🐾</div>
    </div>
    <button class="btn btn-magenta" onclick="go('contactDone')">この子について保健所に連絡する</button>
    <button class="btn btn-ghost" onclick="go('notify')">飼い主に通知が届く仕組みを見る</button>
  </div>`;
},

/* CONTACT DONE --------------------------------------------------- */
contactDone(){
  return `
  ${appbar('連絡を送信','petDetail',S.role)}
  <div class="success fade">
    <div class="ring">✓</div>
    <h3>保健所に連絡しました</h3>
    <p>ぽん太を保護している○○保健所へ、あなたの連絡先が共有されました。<br>受け渡しの日時が決まるとお知らせが届きます。</p>
    <div class="pill" style="margin-top:16px">受付番号：RL-10018</div>
    <button class="btn btn-primary" style="margin-top:22px;max-width:220px" onclick="go('home')">ホームに戻る</button>
  </div>`;
},

/* SHELTER LIST --------------------------------------------------- */
shelterList(){
  const data = [
    {n:'保護 #A21',c:0,meta:'柴犬 / ○○保健所 / 照合待ち 2件',tag:'照合中'},
    {n:'保護 #A20',c:3,meta:'トイプードル / 発見者から受入',tag:'新規'},
    {n:'保護 #A18',c:2,meta:'雑種 / 飼い主候補 95%',tag:'一致'},
    {n:'保護 #A15',c:5,meta:'柴系 / 引き渡し済み',tag:'完了'},
  ];
  const tagColor={ '照合中':'pill', '新規':'pill mag', '一致':'pill mag', '完了':'pill'};
  const row=(d)=>`
    <div class="match-card" onclick="go('petDetail')">
      <div class="ph" style="background:${petSwatch(d.c)}">🐕</div>
      <div style="min-width:0"><div class="name">${d.n}</div><div class="meta">${d.meta}</div></div>
      <span class="${tagColor[d.tag]}" style="margin-left:auto">${d.tag}</span>
    </div>`;
  return `
  ${appbar('保護ペット一覧','home',S.role)}
  <div class="pad stack fade">
    <div class="lede" style="margin-top:2px">現在の保護：<b style="color:var(--navy)">12頭</b> ／ 照合待ち：<b style="color:var(--magenta)">3頭</b></div>
    ${data.map(row).join('')}
    <button class="btn btn-primary" onclick="go('register')">＋ 新しい保護を登録</button>
  </div>`;
},
/* NOTIFICATIONS -------------------------------------------------- */
notify(){
  const items = [
    {t:'似たペットが保護されました', b:'マッチ率95%：柴犬「ぽん太」が○○保健所で保護されました。詳細を確認してください。', tm:'たった今', read:false, to:'petDetail'},
    {t:'AIマッチングが完了', b:'登録したペットについて6件の候補が見つかりました。', tm:'5分前', read:false, to:'results'},
    {t:'受け渡し記録の共有', b:'発見者から飼い主へ直接引き渡された記録が保健所に共有されました。', tm:'2時間前', read:true, to:null},
    {t:'新しい保護情報', b:'△△市でトイプードルが保護されました。登録内容と照合中です。', tm:'昨日', read:true, to:null},
  ];
  const row=(n)=>`
    <div class="notif ${n.read?'read':''}" ${n.to?`onclick="go('${n.to}')" style="cursor:pointer"`:''}>
      <div class="dot"></div>
      <div><div class="nt">${n.t}</div><div class="nb">${n.b}</div><div class="tm">${n.tm}</div></div>
    </div>`;
  return `
  ${appbar('お知らせ','home',S.role)}
  <div class="pad stack fade">
    ${items.map(row).join('')}
    <div class="footnote">似た外見・首輪のペットが新たに保護されるたびに、自動で通知します。</div>
  </div>`;
},

};

/* ---------------- Router & actions ---------------- */
function go(name){
  screen.scrollTop = 0;
  screen.innerHTML = screens[name]();
  if(name==='matching') startMatch();
}
function setRole(r){ S.role=r; go('login'); }
function login(){
  if(!S.role){ shake(); return; }
  go('home');
}
function switchRole(){ S.role=null; go('login'); }

function shake(){
  const roles=document.querySelector('.roles');
  if(!roles)return;
  roles.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:260});
}

/* register helpers */
function renderThumbs(){
  return S.regPhotos.map((url,i)=>`
    <div class="thumb" style="background-image:url('${url}');background-size:cover;background-position:center;">
      <div class="x" onclick="event.stopPropagation();rmPhoto(${i})">×</div>
    </div>`).join('');
}
function handleFileSelect(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    S.regPhotos.push(e.target.result);
    const t = document.getElementById('thumbs');
    if(t) t.innerHTML = renderThumbs();
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}
function rmPhoto(i){
  S.regPhotos.splice(i,1);
  const t=document.getElementById('thumbs');
  if(t) t.innerHTML=renderThumbs();
}
function pickColor(i){
  const index = S.regColors.indexOf(i);
  if (index > -1) {
    // すでに選択されている場合は削除（キャンセル）
    S.regColors.splice(index, 1);
  } else {
    // 選択されていない場合は追加
    S.regColors.push(i);
  }
  // 表示の更新（選択中の色にだけ 'on' クラスを付与）
  document.querySelectorAll('#swatches .sw').forEach((el, idx) => {
    el.classList.toggle('on', S.regColors.includes(idx));
  });
}

/* matching animation */
let matchTimer=null;
function startMatch(){
  S.cancelMatch=false;
  let p=0;
  const bar=document.getElementById('bar');
  const pct=document.getElementById('pct');
  const fillRect=document.getElementById('paw-fill-rect');
  matchTimer=setInterval(()=>{
    if(S.cancelMatch){clearInterval(matchTimer);return;}
    p += Math.random()*7+3;
    if(p>=100){p=100;}
    bar.style.width=p+'%';
    pct.textContent=Math.round(p)+'%';
    
    // 肉球のイラストが存在する実質的な高さ（下端: 85, 上端: 15）に合わせて連動させる
    if(fillRect) {
      const bottomY = 85; // 肉球の一番下の位置
      const topY = 7;    // 肉球の一番上の位置
      const currentY = bottomY - (p / 100) * (bottomY - topY);
      fillRect.setAttribute('y', currentY);
    }
    
    if(p>=100){
      clearInterval(matchTimer);
      setTimeout(()=>{ if(!S.cancelMatch) go('results'); },420);
    }
  },220);
}
function cancelMatch(){
  S.cancelMatch=true;
  if(matchTimer)clearInterval(matchTimer);
  go('register');
}

/* boot */
go('login');
