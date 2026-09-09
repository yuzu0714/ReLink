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
  otherSpecie: '',
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
        <input class="input" id="foundPlace" value="${S.foundPlace||''}" placeholder="市区町村" oninput="setFoundPlace(this.value)"></div>
      <div class="field"><label>発見日時</label>
        <input class="input" id="foundDate" type="datetime-local" value="${S.foundDate||''}" oninput="setFoundDate(this.value)"></div>
      ` : `
      <div class="field"><label>連絡先電話番号</label>
        <input class="input" type="tel" value="090-1234-5678" placeholder="090-0000-0000"></div>
      `}

      <div class="field"><label>種類・犬種</label>
        <select class="input" id="specie" onchange="setSpecie(this.value)">
          <option value="">選択してください</option>
          <optgroup label="🐕 犬">
            <option>柴犬</option><option>トイプードル</option><option>ドーベルマン</option><option>チワワ</option>
            <option>ゴールデン・レトリバー</option><option>ボーダー・コリー</option><option>ハスキー</option>
            <option>パグ</option><option>秋田犬</option><option>雑種（中型）</option>
          </optgroup>
          <optgroup label="🐈 猫">
            <option>アメリカン・ショートヘア</option><option>スコティッシュ・フォールド</option><option>マンチカン</option>
            <option>ペルシャ</option><option>ロシアン・ブルー</option><option>シャム</option>
            <option>ノルウェージアン・フォレスト・キャット</option><option>メインクーン</option><option>ラグドール</option>
            <option>ブリティッシュ・ショートヘア</option><option>アビシニアン</option><option>ベンガル</option>
            <option>猫（雑種）</option>
          </optgroup>
        </select></div>

      <div class="field"><label>上記にない犬種・品種（任意）</label>
        <input class="input" id="otherSpecie" type="text" placeholder="例）ビーグル、ミックス犬など" value="${S.otherSpecie||''}" oninput="setOtherSpecie(this.value)"></div>

      <div class="field"><label>毛色（複数選択可）</label>
        <div class="swatches" id="swatches">
          ${petColors.map((c,i)=>`<div class="sw ${S.regColors.includes(i)?'on':''}" style="background:${c}" onclick="pickColor(${i})"></div>`).join('')}
        </div></div>

      <div class="field"><label>そのほか（アレルギー・伝えたいこと）</label>
        <textarea class="input" id="other" placeholder="例）左耳が欠けている。人懐っこい。" oninput="setOther(this.value)">${S.other||''}</textarea></div>

      <button class="btn btn-magenta" onclick="goToStep2()">
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
if (!screen) return;
screen.scrollTop = 0;
screen.innerHTML = screens[name]();
if (name === 'step2' && typeof initStep2 === 'function') initStep2();
}

// 発見場所・発見日時・種類・そのほか欄の入力を S に反映するための関数。
// 【原因判明】これまでは <input oninput="S.foundPlace=this.value"> のように
// HTML属性の中に直接 S への代入を書いていたが、inline属性のイベントハンドラは
// このIIFE内のローカル変数(const Sなど)にはアクセスできず、グローバルスコープの
// S を探しに行ってしまう。ここでは const S しか無い(windowには乗っていない)ため、
// 実際には「S is not defined」というエラーがコンソールに出て代入自体が失敗し、
// 画面の入力欄には文字が表示されていても S.foundPlace は空のまま、という状態になっていた
// (これが「発見場所を入力しているのに入力してくださいと言われる」不具合の正体)。
// 対策として、代入は必ずこのIIFE内の関数(=Sへのクロージャを持つ関数)経由で行い、
// HTML属性側からはその関数をwindow経由で呼び出すだけにする。
function setFoundPlace(v){ S.foundPlace = v; }
function setFoundDate(v){ S.foundDate = v; }
function setSpecie(v){ S.specie = v; }
function setOtherSpecie(v){ S.otherSpecie = v; }
function setOther(v){ S.other = v; }

// STEP1(register画面)の「🐾 登録」ボタンから呼ばれる。
// 以前はSTEP1では何もチェックせずSTEP2へ進めていたため、発見場所などの入力が
// 抜けたままSTEP2(保護方法の選択画面。発見場所の入力欄はここには無い)まで進んでしまい、
// 「登録して完了」を押した瞬間に「発見場所を入力してください」と言われても
// 画面上に直す場所が無い、という分かりにくい状態になっていた。
// そのため、STEP1からSTEP2へ進む前にここで必須項目をチェックし、
// 足りない項目があればSTEP1の画面(該当の入力欄が見えている状態)で知らせるようにする。
function goToStep2(){
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
  if(!S.specie && !S.otherSpecie){
    alert('種類・犬種を選択するか、上記にない犬種・品種欄に入力してください。');
    return;
  }
  if(S.regColors.length === 0){
    alert('毛色を選択してください。');
    return;
  }
  go('step2');
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
// (そのほか欄には首輪情報のみを書く。犬種・毛色はセレクト/スウォッチの選択だけに使う)
function applyAiTags(tags){
  const notes = [];

  if(!S.specie){
    const guess = guessSpecieOption(tags.animalType, tags.breed);
    if(guess){
      S.specie = guess;
      const sel = document.getElementById('specie');
      if(sel) sel.value = guess;
    } else if(tags.breed && !S.otherSpecie){
      // 選択肢にない犬種はテキスト欄に入れる
      S.otherSpecie = [tags.animalType, tags.breed].filter(Boolean).join(' ');
      const inp = document.getElementById('otherSpecie');
      if(inp) inp.value = S.otherSpecie;
    }
  }

  if(S.regColors.length === 0 && tags.coatColor){
    const idx = colorKeywordIndex(tags.coatColor);
    if(idx !== -1) pickColor(idx);
  }

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
  if(!S.specie && !S.otherSpecie){
    alert('種類・犬種を選択するか、上記にない犬種・品種欄に入力してください。');
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
    const photoUrls = await uploadPhotos(S.regPhotos.map(p => p.file), token);

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
        photoUrls,
        foundPlace: S.foundPlace,
        foundDate: S.foundDate,
        specie: S.specie || S.otherSpecie,
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
  window.finderGo = go;
window.finderAddPhoto = addPhoto;
window.finderRemovePhoto = rmPhoto;
window.finderPickColor = pickColor;

window.go = go;
window.addPhoto = addPhoto;
window.rmPhoto = rmPhoto;
window.pickColor = pickColor;
window.aiAutoFill = aiAutoFill;
window.submitFound = submitFound;
window.goToStep2 = goToStep2;
window.setFoundPlace = setFoundPlace;
window.setFoundDate = setFoundDate;
window.setSpecie = setSpecie;
window.setOtherSpecie = setOtherSpecie;
window.setOther = setOther;
})();