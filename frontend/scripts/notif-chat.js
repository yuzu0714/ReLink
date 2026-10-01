/* ============================================================
   notif-chat.js  —  notify.html 内のチャットセクション
   左サブパネル: コンタクト一覧（メッセージ履歴あり・最新順）
               検索時は全アカウントから絞り込み
   右サブパネル: チャットルーム（メッセージ + 入力フォーム）
   ============================================================ */
(() => {
  const contactList = document.getElementById('chat-contact-list');
  const roomPanel   = document.getElementById('chat-split-room');
  if (!contactList || !roomPanel) return;

  /* --- 状態 --- */
  let allContacts      = [];   // APIから取得した全アカウント { id, displayName, role }
  let historyContacts  = [];   // メッセージ履歴あり { ...allContacts, lastMessage, lastAt }
  let filteredContacts = [];   // 現在表示中（検索結果 or 履歴一覧）
  let activeContact    = null;
  let pollTimer        = null;

  /* --- ヘルパー --- */
  function escHtml(v) {
    return String(v || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function authHeaders() {
    return {
      'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
      'Content-Type': 'application/json'
    };
  }
  function roleIcon(role) {
    return role === 'shelter' ? '<i class="fa-solid fa-building"></i>' : '<i class="fa-solid fa-user"></i>';
  }
  function roleLabel(role) {
    const map = { owner: '飼い主', finder: '発見者', shelter: '保護団体' };
    return map[role] || role;
  }
  function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }

  /* ============================================================
     コンタクト一覧を読み込む
     - 全アカウントを取得 → 各自のメッセージを並行取得
     - 履歴あり → historyContacts（最新順）
     - 全アカウント → allContacts（検索用）
     ============================================================ */
  async function loadAndRenderContacts() {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      setContactsBody('<div class="chat-contacts-empty">ログインが必要です。</div>');
      return;
    }
    setContactsBody('<div class="chat-contacts-loading">読み込み中...</div>');
    try {
      const res = await fetch(`${API_BASE}/chat/contacts`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`${res.status}`);
      allContacts = (await res.json()).contacts || [];

      /* 各コンタクトのメッセージを並行取得 */
      const withMessages = await Promise.all(
        allContacts.map(async c => {
          try {
            const r = await fetch(
              `${API_BASE}/chat/conversations/${c.id}/messages`,
              { headers: authHeaders() }
            );
            if (!r.ok) return null;
            const data = await r.json();
            const msgs = data.messages || [];
            if (msgs.length === 0) return null;
            const last = msgs[msgs.length - 1];
            return { ...c, lastMessage: last.message || '', lastAt: last.createdAt || '' };
          } catch { return null; }
        })
      );

      /* 最新メッセージ日時の降順でソート */
      historyContacts = withMessages
        .filter(Boolean)
        .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));

      renderContactsList();
    } catch (e) {
      setContactsBody('<div class="chat-contacts-empty">取得に失敗しました。</div>');
      console.error('[notif-chat] contacts error', e);
    }
  }

  /* ============================================================
     検索クエリで絞り込んで一覧を再描画
     - 空欄 → 履歴のある相手のみ（最新順）
     - 入力あり → 全アカウントから名前で検索（サブテキストは役割名）
     ============================================================ */
  function renderContactsList() {
    const query = (contactList.querySelector('.chat-contacts-search')?.value || '').trim().toLowerCase();

    if (query) {
      /* 全アカウントから名前で絞り込み */
      const matched = allContacts.filter(c => c.displayName.toLowerCase().includes(query));
      filteredContacts = matched;

      if (matched.length === 0) {
        setContactsBody('<div class="chat-contacts-empty">見つかりませんでした。</div>');
        return;
      }

      /* 検索結果のサブテキストは役割名 */
      const items = matched.map(c => {
        const hist = historyContacts.find(h => h.id === c.id);
        const sub  = hist ? escHtml(hist.lastMessage) : escHtml(roleLabel(c.role));
        return `
          <button class="chat-contact-item${activeContact && activeContact.id === c.id ? ' active' : ''}"
                  type="button" data-cid="${c.id}">
            <div class="chat-contact-avatar">${roleIcon(c.role)}</div>
            <div class="chat-contact-info">
              <div class="chat-contact-name">${escHtml(c.displayName)}</div>
              <div class="chat-contact-sub">${sub}</div>
            </div>
          </button>`;
      }).join('');
      setContactsBody(items);

    } else {
      /* 空欄 → 履歴のある相手のみ表示 */
      filteredContacts = historyContacts.slice();

      if (historyContacts.length === 0) {
        setContactsBody('<div class="chat-contacts-empty">チャット相手がまだいません。</div>');
        return;
      }

      const items = historyContacts.map(c => `
        <button class="chat-contact-item${activeContact && activeContact.id === c.id ? ' active' : ''}"
                type="button" data-cid="${c.id}">
          <div class="chat-contact-avatar">${roleIcon(c.role)}</div>
          <div class="chat-contact-info">
            <div class="chat-contact-name">${escHtml(c.displayName)}</div>
            <div class="chat-contact-sub">${escHtml(c.lastMessage)}</div>
          </div>
        </button>
      `).join('');
      setContactsBody(items);
    }

    /* クリックイベント登録 */
    contactList.querySelectorAll('[data-cid]').forEach(btn => {
      btn.addEventListener('click', () => {
        /* allContacts + historyContacts 両方から探す */
        const cid = Number(btn.dataset.cid);
        const contact = historyContacts.find(c => c.id === cid)
                     || allContacts.find(c => c.id === cid);
        if (contact) openRoom(contact);
      });
    });
  }

  /* .chat-contacts-body のみ差し替え（ヘッダーは保持） */
  function setContactsBody(html) {
    const existing = contactList.querySelector('.chat-contacts-body');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'chat-contacts-body';
    div.innerHTML = html;
    contactList.appendChild(div);
  }

  /* 検索入力欄のイベント登録 */
  const searchInput = contactList.querySelector('.chat-contacts-search');
  if (searchInput) {
    searchInput.addEventListener('input', renderContactsList);
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredContacts.length === 1) {
          const cid = filteredContacts[0].id;
          const contact = historyContacts.find(c => c.id === cid)
                       || allContacts.find(c => c.id === cid);
          if (contact) openRoom(contact);
        }
      }
    });
  }

  /* ============================================================
     チャットルーム
     ============================================================ */
  function openRoom(contact) {
    clearInterval(pollTimer);
    activeContact = contact;

    /* 検索欄をクリアして全件表示に戻す */
    const srch = contactList.querySelector('.chat-contacts-search');
    if (srch) srch.value = '';
    renderContactsList();

    /* ルームの骨格を描画 */
    roomPanel.innerHTML = `
      <div class="split-room-head">
        <div class="split-room-avatar">${roleIcon(contact.role)}</div>
        <div class="split-room-name">${escHtml(contact.displayName)}</div>
      </div>
      <div class="split-room-messages" id="split-messages">
        <div class="split-msg-loading">読み込み中...</div>
      </div>
      <form class="split-room-form" id="split-form" autocomplete="off">
        <input class="input" id="split-input" type="text" maxlength="500"
               placeholder="メッセージを入力..." required>
        <button class="btn btn-primary" type="submit">送信</button>
      </form>
    `;

    roomPanel.querySelector('#split-form').addEventListener('submit', handleSend);
    renderMessages();
    pollTimer = setInterval(renderMessages, 10000);
  }

  async function renderMessages() {
    if (!activeContact) return;
    const box = document.getElementById('split-messages');
    if (!box) return;

    try {
      const res = await fetch(
        `${API_BASE}/chat/conversations/${activeContact.id}/messages`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const msgs = data.messages || [];
      const me   = Number(sessionStorage.getItem('userId'));

      if (msgs.length === 0) {
        box.innerHTML = '<div class="split-msg-empty">まだメッセージはありません。</div>';
        return;
      }

      const wasAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;

      box.innerHTML = msgs.map(m => {
        const isMe = Number(m.senderId) === me;
        return `<div class="split-bubble ${isMe ? 'me' : 'them'}">
          <span>${escHtml(m.message)}</span>
          <span class="split-bubble-time">${fmtTime(m.createdAt)}</span>
        </div>`;
      }).join('');

      if (wasAtBottom) box.scrollTop = box.scrollHeight;
    } catch (e) {
      const box2 = document.getElementById('split-messages');
      if (box2) box2.innerHTML = '<div class="split-msg-empty">メッセージを取得できませんでした。</div>';
      console.error('[notif-chat] renderMessages error', e);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    const input = document.getElementById('split-input');
    const text  = input?.value.trim();
    if (!text || !activeContact) return;

    try {
      const res = await fetch(`${API_BASE}/chat/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ receiverId: activeContact.id, message: text })
      });
      if (!res.ok) throw new Error('送信失敗');
      input.value = '';
      await renderMessages();
    } catch (err) {
      alert(err.message || 'メッセージを送信できませんでした。');
    }
  }

  /* ============================================================
     ナビゲーション連動
     ============================================================ */
  document.querySelectorAll('.nnav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.sec === 'chat') {
        loadAndRenderContacts();
      } else {
        clearInterval(pollTimer);
        pollTimer = null;
        activeContact = null;
        const room = document.getElementById('chat-split-room');
        if (room) {
          room.innerHTML = `
            <div class="chat-placeholder">
              <div class="chat-placeholder-icon">💬</div>
              <div>チャット相手を選択してください</div>
            </div>`;
        }
      }
    });
  });

  /* ============================================================
     URL パラメータ対応 (notify.html?sec=chat&contactId=5)
     ============================================================ */
  const params      = new URLSearchParams(window.location.search);
  const initSec     = params.get('sec');
  const initContact = params.get('contactId') ? Number(params.get('contactId')) : null;

  if (initSec === 'chat') {
    document.querySelectorAll('.nnav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.notif-sec').forEach(s => s.classList.remove('active'));
    document.querySelector('.nnav-btn[data-sec="chat"]')?.classList.add('active');
    document.getElementById('sec-chat')?.classList.add('active');
    const h1 = document.getElementById('notif-title');
    if (h1) h1.textContent = 'チャット';

    loadAndRenderContacts().then(() => {
      if (initContact) {
        const fallbackName = sessionStorage.getItem('chatTargetName') || '連絡先';
        const fallbackRole = sessionStorage.getItem('chatTargetRole') || 'finder';
        const found = historyContacts.find(c => c.id === initContact)
                   || allContacts.find(c => c.id === initContact)
                   || { id: initContact, displayName: fallbackName, role: fallbackRole };
        openRoom(found);
      }
    });
  }
})();
