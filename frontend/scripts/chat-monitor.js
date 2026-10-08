/* ============================================================
   chat-monitor.js — 保護団体向け「発見者⇔飼い主の会話を見る」ページ(閲覧専用)
   画面は2つ：
     ① 会話一覧   GET /shelter/chat-monitor
     ② 会話ルーム GET /shelter/chat-monitor/{userA}/{userB}/messages
   送信フォームは意図的に作っていない(保護団体は見るだけ)。
   ============================================================ */
(() => {
  const root = document.getElementById('cm-root');
  if (!root) return; // このページ以外では何もしない

  // ---- ログインチェック：保護団体以外は入れない ----
  const token = sessionStorage.getItem('authToken');
  const role = sessionStorage.getItem('selectedRole');
  if (!token || role !== 'shelter') {
    alert('保護団体としてログインしてください。');
    window.location.href = 'shelter-login.html';
    return;
  }

  let pollTimer = null; // 会話ルームを開いている間だけ自動更新するタイマー

  // ---- 小さな道具たち ----
  const authHeaders = () => ({ 'Authorization': `Bearer ${token}` });

  // 役割コード → 日本語ラベル
  const roleLabel = (r) => ({ owner: '飼い主', finder: '発見者' }[r] || r);

  // 役割ごとのアイコン(Font Awesome)
  const roleIcon = (r) =>
    r === 'finder' ? '<i class="fa-solid fa-hand-holding-heart"></i>' : '<i class="fa-solid fa-user"></i>';

  // 日時を「10/8 14:05」の形にする
  function fmtDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ` +
      d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }

  // 名前の表示用(「田中さん(飼い主)」)。escapeHtmlはcommon.jsのもの
  const nameLabel = (p) => `${escapeHtml(p.displayName)}(${roleLabel(p.role)})`;

  // APIを呼んでJSONを返す共通関数。失敗したらErrorを投げる
  async function api(path) {
    const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 403) throw new Error('この画面には保護団体権限が必要です。ログインし直してください。');
      if (res.status === 404) throw new Error('会話が見つかりませんでした。');
      throw new Error(`取得に失敗しました。(status ${res.status})`);
    }
    return res.json();
  }

  /* ============================================================
     ① 会話一覧
     ============================================================ */
  async function showList() {
    clearInterval(pollTimer); // ルームの自動更新を止める
    pollTimer = null;

    root.innerHTML = `
      <div class="cm-notice">
        <i class="fa-solid fa-eye"></i>
        発見者と飼い主のあいだの会話を<b>閲覧のみ</b>できます。引き渡しがスムーズに進んでいるか確認するための画面です。
      </div>
      <div class="cm-empty">読み込み中…</div>`;

    try {
      const data = await api('/shelter/chat-monitor');
      const list = data.conversations || [];
      const notice = root.querySelector('.cm-notice').outerHTML;

      if (list.length === 0) {
        root.innerHTML = notice + '<div class="cm-empty">まだ会話はありません。</div>';
        return;
      }

      root.innerHTML = notice + `
        <div class="cm-list">
          ${list.map((c, i) => `
            <button class="cm-item" type="button" data-i="${i}">
              <div class="cm-avatar">${roleIcon(c.userA.role)}</div>
              <div class="cm-main">
                <div class="cm-names">${nameLabel(c.userA)} ⇔ ${nameLabel(c.userB)}</div>
        <div class="cm-sub">${escapeHtml(c.lastMessage || '音声メッセージ')}</div>
              </div>
              <div class="cm-meta">
                <div>${fmtDateTime(c.lastAt)}</div>
                <span class="cm-count">${c.messageCount}件</span>
              </div>
            </button>`).join('')}
        </div>`;

      // カードをクリック → その2人の会話ルームを開く
      root.querySelectorAll('.cm-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          const c = list[Number(btn.dataset.i)];
          showRoom(c.userA.id, c.userB.id);
        });
      });
    } catch (err) {
      console.error(err);
      root.innerHTML = `<div class="cm-empty" style="color:var(--magenta)">${escapeHtml(err.message)}</div>`;
    }
  }

  /* ============================================================
     ② 会話ルーム(閲覧専用)
     ============================================================ */
  async function showRoom(userAId, userBId) {
    clearInterval(pollTimer);

    // まず枠だけ描画(メッセージは下の loadMessages が入れる)
    root.innerHTML = `
      <div class="cm-room">
        <div class="cm-room-head">
          <button class="cm-back" type="button" aria-label="会話一覧に戻る">‹</button>
          <strong id="cm-title">読み込み中…</strong>
        </div>
        <div class="cm-messages" id="cm-messages"></div>
      </div>`;
    root.querySelector('.cm-back').addEventListener('click', showList);

    await loadMessages(userAId, userBId);
    // 10秒ごとに自動更新(通常のチャット画面と同じ間隔)
    pollTimer = setInterval(() => loadMessages(userAId, userBId), 10000);
  }

  async function loadMessages(userAId, userBId) {
    const box = document.getElementById('cm-messages');
    const title = document.getElementById('cm-title');
    if (!box || !title) return; // 一覧に戻った後なら何もしない

    try {
      const data = await api(`/shelter/chat-monitor/${userAId}/${userBId}/messages`);
      title.innerHTML = `${nameLabel(data.userA)} ⇔ ${nameLabel(data.userB)}`;

      const msgs = data.messages || [];
      if (msgs.length === 0) {
        box.innerHTML = '<div class="cm-empty">まだメッセージはありません。</div>';
        return;
      }

      // 自動更新で読んでいる位置が飛ばないよう、最下部にいた時だけ最下部へ追従する
      const wasAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;

      box.innerHTML = msgs.map((m) => {
        // 送信者がAならグレー(左)、Bならオレンジ(右)
        const isA = Number(m.senderId) === Number(data.userA.id);
        const sender = isA ? data.userA : data.userB;
        const content = m.messageType === 'audio' && m.audioUrl
          ? `<audio controls preload="none" src="${escapeHtml(m.audioUrl)}">音声を再生できません。</audio>`
          : `<span>${escapeHtml(m.message)}</span>`;
        return `
          <div class="cm-bubble ${isA ? 'a' : 'b'}">
            <span class="cm-from">${nameLabel(sender)}</span>
            ${content}
            <span class="cm-time">${fmtDateTime(m.createdAt)}</span>
          </div>`;
      }).join('');

      if (wasAtBottom) box.scrollTop = box.scrollHeight;
    } catch (err) {
      console.error(err);
      box.innerHTML = `<div class="cm-empty" style="color:var(--magenta)">${escapeHtml(err.message)}</div>`;
    }
  }

  // ページを開いたらまず一覧を表示
  showList();
})();
