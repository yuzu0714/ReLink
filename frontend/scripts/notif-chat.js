/* ============================================================
   notif-chat.js  —  notify.html 内のチャットセクション
   左サブパネル: コンタクト一覧（メッセージ履歴あり・最新順）
               検索時は全アカウントから絞り込み
   右サブパネル: チャットルーム（メッセージ + 入力フォーム + 🎤）
   ============================================================ */
(() => {
  const contactList = document.getElementById('chat-contact-list');
  const roomPanel   = document.getElementById('chat-split-room');
  if (!contactList || !roomPanel) return;
  const chatSplit   = contactList.closest('.chat-split');

  /* --- 状態 --- */
  let allContacts      = [];
  let historyContacts  = [];
  let filteredContacts = [];
  let activeContact    = null;
  let pollTimer        = null;

  /* --- 録音状態 --- */
  let mediaRecorder    = null;
  let audioChunks      = [];
  let recordingStream  = null;
  let recordingTimer   = null;
  let recordingSeconds = 0;
  let audioBlob        = null;
  let audioMime        = 'audio/webm';

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
  function fmtSec(s) {
    const m = Math.floor(s / 60).toString().padStart(2,'0');
    return `${m}:${(s % 60).toString().padStart(2,'0')}`;
  }
  function getBestMime() {
    const candidates = [
      'audio/webm;codecs=opus','audio/webm',
      'audio/ogg;codecs=opus','audio/ogg','audio/mp4'
    ];
    return candidates.find(t => MediaRecorder.isTypeSupported(t)) || '';
  }

  /* ============================================================
     コンタクト一覧
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
            const preview = last.messageType === 'audio' ? '🎤 音声メッセージ' : (last.message || '');
            return { ...c, lastMessage: preview, lastAt: last.createdAt || '' };
          } catch { return null; }
        })
      );

      historyContacts = withMessages
        .filter(Boolean)
        .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));

      renderContactsList();
    } catch (e) {
      setContactsBody('<div class="chat-contacts-empty">取得に失敗しました。</div>');
      console.error('[notif-chat] contacts error', e);
    }
  }

  function renderContactsList() {
    const query = (contactList.querySelector('.chat-contacts-search')?.value || '').trim().toLowerCase();

    if (query) {
      const matched = allContacts.filter(c => c.displayName.toLowerCase().includes(query));
      filteredContacts = matched;
      if (matched.length === 0) {
        setContactsBody('<div class="chat-contacts-empty">見つかりませんでした。</div>');
        return;
      }
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

    contactList.querySelectorAll('[data-cid]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cid = Number(btn.dataset.cid);
        const contact = historyContacts.find(c => c.id === cid)
                     || allContacts.find(c => c.id === cid);
        if (contact) openRoom(contact);
      });
    });
  }

  function setContactsBody(html) {
    const existing = contactList.querySelector('.chat-contacts-body');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'chat-contacts-body';
    div.innerHTML = html;
    contactList.appendChild(div);
  }

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
    cleanupRecording();
    activeContact = contact;
    chatSplit?.classList.add('room-open');

    const srch = contactList.querySelector('.chat-contacts-search');
    if (srch) srch.value = '';
    renderContactsList();

    roomPanel.innerHTML = `
      <div class="split-room-head">
        <button class="split-room-back" type="button" aria-label="チャット一覧に戻る">‹</button>
        <div class="split-room-avatar">${roleIcon(contact.role)}</div>
        <div class="split-room-name">${escHtml(contact.displayName)}</div>
      </div>
      <div class="split-room-messages" id="split-messages">
        <div class="split-msg-loading">読み込み中...</div>
      </div>
      <div id="nc-recording-ui" style="display:none;"></div>
      <div id="nc-preview-ui" style="display:none;"></div>
      <form class="split-room-form" id="split-form" autocomplete="off">
        <input class="input" id="split-input" type="text" maxlength="500"
               placeholder="メッセージを入力...">
        <button class="nc-mic-btn" type="button" id="nc-mic-btn" title="音声メッセージ" aria-label="音声メッセージを録音">
          <span class="material-symbols-rounded">mic</span>
        </button>
        <button class="btn btn-primary" type="submit">送信</button>
      </form>
      <style>
        .nc-mic-btn {
          display: flex; align-items: center; justify-content: center;
          width: 40px; height: 40px; flex: none;
          border: none; border-radius: 10px;
          background: #eef1fa; color: var(--navy, #1e3a5f);
          cursor: pointer; transition: background 0.15s;
        }
        .nc-mic-btn:hover { background: #dce2f5; }
        .nc-mic-btn.recording { background: #fee2e2; color: #dc2626; }
        .nc-mic-btn .material-symbols-rounded { font-size: 20px; line-height: 1; }
        .nc-recording-ui {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; background: #fff5f5;
          border-top: 1px solid #fecaca;
        }
        .nc-rec-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background: #dc2626;
          animation: ncblink 1s step-start infinite;
        }
        @keyframes ncblink { 50% { opacity: 0; } }
        .nc-rec-timer { font-size: 14px; font-weight: 700; color: #dc2626; min-width: 44px; }
        .nc-rec-label { font-size: 13px; color: #dc2626; flex: 1; }
        .nc-rec-stop, .nc-rec-cancel {
          display: flex; align-items: center; gap: 4px;
          border: none; border-radius: 8px; cursor: pointer;
          font-size: 12px; font-weight: 600; padding: 6px 10px;
        }
        .nc-rec-stop { background: #dc2626; color: #fff; }
        .nc-rec-cancel { background: #eef1fa; color: var(--navy, #1e3a5f); }
        .nc-rec-stop .material-symbols-rounded,
        .nc-rec-cancel .material-symbols-rounded { font-size: 15px; }
        .nc-preview-ui {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; background: #f0f4ff;
          border-top: 1px solid #c7d2fe;
        }
        .nc-preview-play {
          width: 36px; height: 36px; border-radius: 50%;
          border: none; background: var(--navy, #1e3a5f); color: #fff;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          flex: none;
        }
        .nc-preview-play .material-symbols-rounded { font-size: 18px; }
        .nc-preview-label { flex: 1; font-size: 13px; color: #334155; }
        .nc-preview-delete, .nc-preview-send {
          border: none; border-radius: 8px; cursor: pointer;
          font-size: 12px; font-weight: 600; padding: 6px 10px;
          display: flex; align-items: center; gap: 4px;
        }
        .nc-preview-delete { background: #fee2e2; color: #dc2626; }
        .nc-preview-send { background: var(--navy, #1e3a5f); color: #fff; }
        .nc-preview-send .material-symbols-rounded,
        .nc-preview-delete .material-symbols-rounded { font-size: 15px; }
        .nc-audio-bubble {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px; border-radius: 14px; min-width: 180px;
        }
        .nc-audio-play {
          width: 34px; height: 34px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.3); color: inherit;
          cursor: pointer; display: flex; align-items: center; justify-content: center; flex: none;
        }
        .nc-audio-play .material-symbols-rounded { font-size: 18px; }
        .nc-audio-wave { display: flex; align-items: center; gap: 2px; flex: 1; }
        .nc-audio-wave span {
          width: 3px; border-radius: 2px; background: currentColor; opacity: 0.5;
          animation: ncwave 0.8s ease-in-out infinite;
        }
        .nc-audio-wave span:nth-child(2) { animation-delay: 0.1s; }
        .nc-audio-wave span:nth-child(3) { animation-delay: 0.2s; }
        .nc-audio-wave span:nth-child(4) { animation-delay: 0.3s; }
        .nc-audio-wave span:nth-child(5) { animation-delay: 0.1s; }
        @keyframes ncwave {
          0%,100% { height: 6px; } 50% { height: 18px; }
        }
      </style>
    `;

    roomPanel.querySelector('#split-form').addEventListener('submit', handleSend);
    roomPanel.querySelector('.split-room-back').addEventListener('click', () => {
      cleanupRecording(); closeRoom();
    });
    roomPanel.querySelector('#nc-mic-btn').addEventListener('click', startRecording);

    renderMessages();
    pollTimer = setInterval(renderMessages, 10000);
  }

  function closeRoom() {
    clearInterval(pollTimer);
    pollTimer = null;
    activeContact = null;
    chatSplit?.classList.remove('room-open');
    roomPanel.innerHTML = `
      <div class="chat-placeholder">
        <div class="chat-placeholder-icon">💬</div>
        <div>チャット相手を選択してください</div>
      </div>`;
    renderContactsList();
  }

  /* ============================================================
     メッセージ描画
     ============================================================ */
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
        if (m.messageType === 'audio' && m.audioUrl) {
          return `<div class="split-bubble ${isMe ? 'me' : 'them'}" style="padding:0;background:transparent;box-shadow:none;">
            <div class="nc-audio-bubble" style="background:${isMe ? 'var(--primary,#f97316)' : '#e2e8f0'};color:${isMe ? '#fff' : '#1e293b'};"
                 data-audio-url="${escHtml(m.audioUrl)}">
              <button class="nc-audio-play" type="button" aria-label="再生">
                <span class="material-symbols-rounded">play_arrow</span>
              </button>
              <div class="nc-audio-wave">
                <span style="height:8px"></span><span style="height:14px"></span>
                <span style="height:18px"></span><span style="height:12px"></span>
                <span style="height:8px"></span>
              </div>
              <span style="font-size:11px;opacity:0.7;">${fmtTime(m.createdAt)}</span>
            </div>
          </div>`;
        }
        return `<div class="split-bubble ${isMe ? 'me' : 'them'}">
          <span>${escHtml(m.message)}</span>
          <span class="split-bubble-time">${fmtTime(m.createdAt)}</span>
        </div>`;
      }).join('');

      /* 音声再生ボタン */
      box.querySelectorAll('.nc-audio-bubble').forEach(bubble => {
        let audio = null;
        bubble.querySelector('.nc-audio-play').addEventListener('click', () => {
          if (!audio) audio = new Audio(bubble.dataset.audioUrl);
          if (audio.paused) {
            audio.play().catch(() => {});
            bubble.querySelector('.material-symbols-rounded').textContent = 'pause';
            audio.onended = () => {
              bubble.querySelector('.material-symbols-rounded').textContent = 'play_arrow';
            };
          } else {
            audio.pause();
            bubble.querySelector('.material-symbols-rounded').textContent = 'play_arrow';
          }
        });
      });

      if (wasAtBottom) box.scrollTop = box.scrollHeight;
    } catch (e) {
      const box2 = document.getElementById('split-messages');
      if (box2) box2.innerHTML = '<div class="split-msg-empty">メッセージを取得できませんでした。</div>';
      console.error('[notif-chat] renderMessages error', e);
    }
  }

  /* ============================================================
     テキスト送信
     ============================================================ */
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
     録音
     ============================================================ */
  function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('このブラウザはマイクの録音に対応していません');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      recordingStream = stream;
      audioChunks = [];
      audioMime = getBestMime();
      mediaRecorder = new MediaRecorder(stream, audioMime ? { mimeType: audioMime } : {});
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        audioBlob = new Blob(audioChunks, { type: audioMime || 'audio/webm' });
        showPreview();
      };
      mediaRecorder.start(200);

      /* UI: フォームを隠して録音UIを表示 */
      const form = document.getElementById('split-form');
      const recUi = document.getElementById('nc-recording-ui');
      if (form) form.style.display = 'none';
      if (recUi) {
        recUi.style.display = '';
        recUi.innerHTML = `
          <div class="nc-recording-ui">
            <div class="nc-rec-dot"></div>
            <span class="nc-rec-timer" id="nc-rec-timer">00:00</span>
            <span class="nc-rec-label">録音中...</span>
            <button class="nc-rec-stop" type="button" id="nc-rec-stop">
              <span class="material-symbols-rounded">stop</span>停止
            </button>
            <button class="nc-rec-cancel" type="button" id="nc-rec-cancel">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>`;
        recUi.querySelector('#nc-rec-stop').addEventListener('click', stopRecording);
        recUi.querySelector('#nc-rec-cancel').addEventListener('click', cancelRecording);
      }

      recordingSeconds = 0;
      recordingTimer = setInterval(() => {
        recordingSeconds++;
        const el = document.getElementById('nc-rec-timer');
        if (el) el.textContent = fmtSec(recordingSeconds);
        if (recordingSeconds >= 120) stopRecording();
      }, 1000);

      const micBtn = document.getElementById('nc-mic-btn');
      if (micBtn) micBtn.classList.add('recording');
    }).catch(() => {
      alert('マイクへのアクセスが拒否されました。ブラウザの設定をご確認ください。');
    });
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    clearInterval(recordingTimer);
    recordingStream?.getTracks().forEach(t => t.stop());
    const recUi = document.getElementById('nc-recording-ui');
    if (recUi) recUi.style.display = 'none';
    const micBtn = document.getElementById('nc-mic-btn');
    if (micBtn) micBtn.classList.remove('recording');
  }

  function cancelRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.ondataavailable = null;
      mediaRecorder.onstop = null;
      mediaRecorder.stop();
    }
    clearInterval(recordingTimer);
    recordingStream?.getTracks().forEach(t => t.stop());
    audioChunks = [];
    audioBlob = null;
    const recUi = document.getElementById('nc-recording-ui');
    if (recUi) recUi.style.display = 'none';
    const micBtn = document.getElementById('nc-mic-btn');
    if (micBtn) micBtn.classList.remove('recording');
    const form = document.getElementById('split-form');
    if (form) form.style.display = '';
  }

  function showPreview() {
    const prevUi = document.getElementById('nc-preview-ui');
    if (!prevUi || !audioBlob) return;
    const url = URL.createObjectURL(audioBlob);
    prevUi.style.display = '';
    prevUi.innerHTML = `
      <div class="nc-preview-ui">
        <button class="nc-preview-play" type="button" id="nc-prev-play">
          <span class="material-symbols-rounded">play_arrow</span>
        </button>
        <span class="nc-preview-label">音声メッセージ（${fmtSec(recordingSeconds)}）</span>
        <button class="nc-preview-delete" type="button" id="nc-prev-del">
          <span class="material-symbols-rounded">delete</span>
        </button>
        <button class="nc-preview-send" type="button" id="nc-prev-send">
          <span class="material-symbols-rounded">send</span>送信
        </button>
      </div>`;

    let prevAudio = null;
    prevUi.querySelector('#nc-prev-play').addEventListener('click', () => {
      if (!prevAudio) prevAudio = new Audio(url);
      if (prevAudio.paused) {
        prevAudio.play().catch(() => {});
        prevUi.querySelector('.material-symbols-rounded').textContent = 'pause';
        prevAudio.onended = () => {
          prevUi.querySelector('.material-symbols-rounded').textContent = 'play_arrow';
        };
      } else {
        prevAudio.pause();
        prevUi.querySelector('.material-symbols-rounded').textContent = 'play_arrow';
      }
    });
    prevUi.querySelector('#nc-prev-del').addEventListener('click', () => {
      prevAudio?.pause();
      URL.revokeObjectURL(url);
      audioBlob = null;
      prevUi.style.display = 'none';
      const form = document.getElementById('split-form');
      if (form) form.style.display = '';
    });
    prevUi.querySelector('#nc-prev-send').addEventListener('click', () => sendAudio(url));
  }

  async function sendAudio(previewUrl) {
    if (!audioBlob || !activeContact) return;
    const sendBtn = document.getElementById('nc-prev-send');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '送信中...'; }

    try {
      /* Step 1: アップロード */
      const ext = audioMime.includes('ogg') ? 'ogg' : audioMime.includes('mp4') ? 'mp4' : 'webm';
      const filename = `voice_${Date.now()}.${ext}`;
      const fd = new FormData();
      fd.append('audio', audioBlob, filename);
      const uploadRes = await fetch(`${API_BASE}/chat/audio`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` },
        body: fd
      });
      if (!uploadRes.ok) throw new Error('音声のアップロードに失敗しました');
      const { audioUrl } = await uploadRes.json();

      /* Step 2: メッセージ投稿 */
      const msgRes = await fetch(`${API_BASE}/chat/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          receiverId: activeContact.id,
          message: '',
          messageType: 'audio',
          audioUrl
        })
      });
      if (!msgRes.ok) throw new Error('メッセージの送信に失敗しました');

      URL.revokeObjectURL(previewUrl);
      audioBlob = null;
      const prevUi = document.getElementById('nc-preview-ui');
      if (prevUi) prevUi.style.display = 'none';
      const form = document.getElementById('split-form');
      if (form) form.style.display = '';
      await renderMessages();
    } catch (err) {
      alert(err.message || '送信に失敗しました');
      if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<span class="material-symbols-rounded">send</span>送信'; }
    }
  }

  function cleanupRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.ondataavailable = null;
      mediaRecorder.onstop = null;
      try { mediaRecorder.stop(); } catch {}
    }
    clearInterval(recordingTimer);
    recordingStream?.getTracks().forEach(t => t.stop());
    mediaRecorder = null; recordingStream = null;
    audioChunks = []; audioBlob = null;
  }

  /* ============================================================
     ナビゲーション連動
     ============================================================ */
  document.querySelectorAll('.nnav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.sec === 'chat') {
        loadAndRenderContacts();
      } else {
        cleanupRecording(); closeRoom();
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
