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

  async function renderContacts() {
    root.innerHTML = '<div class="chat-loading">チャット相手を読み込み中...</div>';

    try {
      const response = await fetch(`${API_BASE}/chat/contacts`, { headers: headers() });
      if (!response.ok) throw new Error('チャット相手を取得できませんでした');
      contacts = (await response.json()).contacts || [];
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
    try {
      const response = await fetch(`${API_BASE}/chat/conversations/${activeContact.id}/messages`, { headers: headers() });
      if (!response.ok) throw new Error('メッセージを取得できませんでした');
      const messages = (await response.json()).messages || [];
      const currentUserId = Number(sessionStorage.getItem('userId'));
      messageList.innerHTML = messages.length === 0
        ? '<div class="chat-empty">まだメッセージはありません。</div>'
        : messages.map((message) => `
          <div class="chat-bubble ${message.senderId === currentUserId ? 'me' : 'them'}">${escHtml(message.message)}</div>
        `).join('');
      messageList.scrollTop = messageList.scrollHeight;
    } catch (error) {
      messageList.innerHTML = `<div class="chat-empty">${escHtml(error.message)}</div>`;
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

  renderContacts();
})();
