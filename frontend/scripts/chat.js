/* ---------------- finder chat ---------------- */
(() => {
  const root = document.getElementById('chat-root');
  if (!root) return;

  let contacts = [];
  let activeContact = null;

  const currentRole = sessionStorage.getItem('selectedRole');
  const roleLabels = {
    owner: '飼い主',
    finder: '発見者',
    shelter: '保護団体'
  };

  function escHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function headers() {
    return {
      'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`,
      'Content-Type': 'application/json'
    };
  }

  async function loadContacts() {
    const response = await fetch(`${API_BASE}/chat/contacts`, { headers: headers() });
    if (!response.ok) throw new Error('チャット相手を取得できませんでした');
    contacts = (await response.json()).contacts || [];
  }

  async function renderContacts() {
    root.innerHTML = '<div class="chat-loading">チャット相手を読み込み中...</div>';

    try {
      await loadContacts();
    } catch (error) {
      root.innerHTML = `<div class="chat-empty">${escHtml(error.message)}</div>`;
      return;
    }

    root.innerHTML = `
      <div>
        <div class="eyebrow">CHAT</div>
        <h2 class="title">チャットする相手を選択</h2>
        <div class="lede">${roleLabels[currentRole] || '利用者'}として${currentRole === 'shelter' ? '発見者' : '保護団体'}に状況を確認できます。</div>
      </div>
      <div class="chat-contacts">
        ${contacts.map((contact) => `
          <button class="chat-contact" type="button" data-contact-id="${contact.id}">
            <div class="chat-avatar">${contact.role === 'shelter' ? '🏠' : '🐾'}</div>
            <div>
              <div class="chat-contact-name">${escHtml(contact.displayName)}</div>
              <div class="chat-contact-preview">${escHtml(contact.role)}</div>
            </div>
            <div class="chat-contact-arrow">›</div>
          </button>
        `).join('')}
      </div>
    `;

    root.querySelectorAll('[data-contact-id]').forEach((button) => {
      button.addEventListener('click', () => openRoom(Number(button.dataset.contactId)));
    });
  }

  function openRoom(contactId) {
    activeContact = contacts.find((contact) => contact.id === contactId);
    if (!activeContact) return;

    root.innerHTML = `
      <div class="chat-room">
        <div class="chat-room-head">
          <button class="chat-back" type="button" aria-label="チャット相手一覧に戻る">‹</button>
          <div class="chat-avatar">${activeContact.role === 'shelter' ? '🏠' : '🐾'}</div>
          <strong>${escHtml(activeContact.displayName)}</strong>
        </div>
        <div class="chat-messages" id="chat-messages"></div>
        <form class="chat-form" id="chat-form">
          <input class="input" id="chat-input" type="text" maxlength="500" placeholder="メッセージを入力">
          <button class="btn btn-primary" type="submit">送信</button>
        </form>
      </div>
    `;

    root.querySelector('.chat-back').addEventListener('click', renderContacts);
    root.querySelector('#chat-form').addEventListener('submit', sendMessage);
    renderMessages();
    root.querySelector('#chat-input').focus();
  }

  async function renderMessages() {
    const messageList = root.querySelector('#chat-messages');
    if (!messageList) { console.error('[chat] #chat-messages not found'); return; }
    try {
      const url = `${API_BASE}/chat/conversations/${activeContact.id}/messages`;
      console.log('[chat] fetching:', url);
      const response = await fetch(url, { headers: headers() });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`メッセージを取得できませんでした (${response.status}) ${errText}`);
      }
      const data = await response.json();
      console.log('[chat] raw data:', JSON.stringify(data).slice(0, 300));
      const messages = data.messages || [];
      const currentUserId = Number(sessionStorage.getItem('userId'));
      console.log('[chat] messages count:', messages.length, 'currentUserId:', currentUserId);

      if (messages.length === 0) {
        messageList.innerHTML = '<div class="chat-empty">まだメッセージはありません。</div>';
      } else {
        messageList.innerHTML = messages.map((message) => {
          const isMe = Number(message.senderId) === currentUserId;
          const time = new Date(message.createdAt).toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'});
          console.log('[chat] bubble senderId:', message.senderId, 'isMe:', isMe, 'text:', message.message);
          return `<div class="chat-bubble ${isMe ? 'me' : 'them'}">
            <span class="chat-text">${escHtml(message.message)}</span>
            <span class="chat-time">${time}</span>
          </div>`;
        }).join('');
      }
      messageList.scrollTop = messageList.scrollHeight;
    } catch (error) {
      console.error('[chat] renderMessages error:', error);
      if (messageList) messageList.innerHTML = `<div class="chat-empty">${escHtml(error.message)}</div>`;
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const input = root.querySelector('#chat-input');
    const text = input.value.trim();
    if (!text) return;

    try {
      const response = await fetch(`${API_BASE}/chat/messages`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ receiverId: activeContact.id, message: text })
      });
      if (!response.ok) throw new Error('メッセージを送信できませんでした');
      input.value = '';
      await renderMessages();
    } catch (error) {
      alert(error.message);
    }
  }

  // notify.htmlから「contactId」パラメータ付きで遷移してきた場合は
  // 連絡先一覧を読み込んだあと、そのまま指定された相手のチャットルームを開く
  const params = new URLSearchParams(window.location.search);
  const autoContactId = params.get('contactId') ? Number(params.get('contactId')) : null;

  if (autoContactId) {
    root.innerHTML = '<div class="chat-loading">チャット相手を読み込み中...</div>';
    loadContacts()
      .then(() => {
        const found = contacts.find((c) => c.id === autoContactId);
        if (found) {
          openRoom(autoContactId);
        } else {
          // 連絡先リストにいない場合（ロール制限など）はダミーで開く
          activeContact = { id: autoContactId, displayName: '連絡先', role: 'finder' };
          openRoom(autoContactId);
        }
      })
      .catch((err) => {
        root.innerHTML = `<div class="chat-empty">${escHtml(err.message)}</div>`;
      });
  } else {
    renderContacts();
  }
})();
