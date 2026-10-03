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
            <div class="chat-avatar">${contact.role === 'shelter' ? '<i class="fa-solid fa-building"></i>' : '<i class="fa-solid fa-user"></i>'}</div>
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
    if (!activeContact || activeContact.id !== contactId) {
      activeContact = contacts.find((contact) => contact.id === contactId);
    }
    if (!activeContact) return;

    root.innerHTML = `
      <div class="chat-room">
        <div class="chat-room-head">
          <button class="chat-back" type="button" aria-label="チャット相手一覧に戻る">‹</button>
          <div class="chat-avatar">${activeContact.role === 'shelter' ? '<i class="fa-solid fa-building"></i>' : '<i class="fa-solid fa-user"></i>'}</div>
          <strong>${escHtml(activeContact.displayName)}</strong>
        </div>
        <div class="chat-messages" id="chat-messages"></div>
        <div id="audio-recording-ui" style="display:none;"></div>
        <div id="audio-preview-ui" style="display:none;"></div>
        <form class="chat-form" id="chat-form">
          <input class="input" id="chat-input" type="text" maxlength="500" placeholder="メッセージを入力">
          <button class="chat-mic-btn" type="button" id="mic-btn" title="音声メッセージ" aria-label="音声メッセージを録音">
            <span class="material-symbols-rounded">mic</span>
          </button>
          <button class="btn btn-primary btn-sm" type="submit">送信</button>
        </form>
      </div>
      <style>
        .chat-mic-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          flex: none;
          border: none;
          border-radius: 12px;
          background: #eef1fa;
          color: var(--navy);
          cursor: pointer;
          font-size: 0;
          transition: background 0.15s;
        }
        .chat-mic-btn:hover { background: #dce2f5; }
        .chat-mic-btn .material-symbols-rounded { font-size: 22px; line-height: 1; }
        .chat-mic-btn.recording { background: #fee2e2; color: #dc2626; }

        /* 録音中UI */
        .recording-ui {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: #fff3f3;
          border: 1.5px solid #fca5a5;
          border-radius: 12px;
          margin-bottom: 6px;
        }
        .recording-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background: #dc2626;
          animation: blink 1s ease-in-out infinite;
          flex: none;
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .recording-timer { font-size: 14px; font-weight: 700; color: #dc2626; min-width: 50px; }
        .recording-label { font-size: 13px; color: #dc2626; flex: 1; }
        .recording-actions { display: flex; gap: 8px; margin-left: auto; }
        .recording-stop-btn, .recording-cancel-btn {
          display: flex; align-items: center; gap: 4px;
          padding: 6px 12px; border-radius: 8px; border: none;
          font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer;
        }
        .recording-stop-btn { background: #dc2626; color: #fff; }
        .recording-cancel-btn { background: #eef1fa; color: var(--navy); }
        .recording-stop-btn .material-symbols-rounded,
        .recording-cancel-btn .material-symbols-rounded { font-size: 16px; }

        /* 録音プレビューUI */
        .audio-preview {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: #f0f7ff;
          border: 1.5px solid #93c5fd;
          border-radius: 12px;
          margin-bottom: 6px;
        }
        .audio-preview-play {
          width: 36px; height: 36px; border-radius: 50%;
          background: var(--navy); color: #fff;
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center; flex: none;
        }
        .audio-preview-play .material-symbols-rounded { font-size: 20px; }
        .audio-preview-duration { font-size: 13px; color: var(--navy); font-weight: 700; min-width: 38px; }
        .audio-preview-label { font-size: 12px; color: var(--muted); flex: 1; }
        .audio-preview-delete {
          width: 32px; height: 32px; border-radius: 8px;
          background: #fee2e2; color: #dc2626;
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .audio-preview-delete .material-symbols-rounded { font-size: 18px; }
        .audio-preview-send {
          padding: 8px 14px; border-radius: 10px;
          background: var(--orange); color: #fff;
          border: none; cursor: pointer;
          font-size: 13px; font-weight: 700; font-family: inherit;
        }

        /* 音声バブル */
        .audio-bubble-inner {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .audio-play-btn {
          width: 34px; height: 34px; border-radius: 50%;
          border: none; cursor: pointer; flex: none;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.25);
          color: inherit;
          transition: background 0.15s;
        }
        .chat-bubble.me .audio-play-btn { background: rgba(255,255,255,0.25); }
        .chat-bubble.them .audio-play-btn { background: rgba(20,20,102,0.1); }
        .audio-play-btn .material-symbols-rounded { font-size: 20px; }
        .audio-waveform {
          flex: 1;
          height: 28px;
          display: flex;
          align-items: center;
          gap: 2px;
          overflow: hidden;
        }
        .audio-waveform-bar {
          width: 3px;
          border-radius: 2px;
          background: currentColor;
          opacity: 0.5;
          flex: none;
        }
        .audio-duration-display { font-size: 11px; opacity: 0.8; min-width: 32px; text-align: right; }
      </style>
    `;

    const backBtn = root.querySelector('.chat-back');
    if (autoContactId) {
      backBtn.style.display = 'none';
    } else {
      backBtn.addEventListener('click', () => {
        cleanupRecording();
        renderContacts();
      });
    }

    root.querySelector('#chat-form').addEventListener('submit', sendMessage);
    root.querySelector('#mic-btn').addEventListener('click', startRecording);
    renderMessages();
    root.querySelector('#chat-input').focus();
  }

  async function renderMessages() {
    const messageList = root.querySelector('#chat-messages');
    if (!messageList) return;
    try {
      const url = `${API_BASE}/chat/conversations/${activeContact.id}/messages`;
      const response = await fetch(url, { headers: headers() });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`メッセージを取得できませんでした (${response.status}) ${errText}`);
      }
      const data = await response.json();
      const messages = data.messages || [];
      const currentUserId = Number(sessionStorage.getItem('userId'));

      if (messages.length === 0) {
        messageList.innerHTML = '<div class="chat-empty">まだメッセージはありません。</div>';
      } else {
        messageList.innerHTML = messages.map((message) => {
          const isMe = Number(message.senderId) === currentUserId;
          const time = new Date(message.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

          if (message.messageType === 'audio' && message.audioUrl) {
            return renderAudioBubble(message, isMe, time);
          }
          return `<div class="chat-bubble ${isMe ? 'me' : 'them'}">
            <span class="chat-text">${escHtml(message.message)}</span>
            <span class="chat-time">${time}</span>
          </div>`;
        }).join('');

        // 音声バブルにイベント登録
        messageList.querySelectorAll('.audio-play-btn').forEach((btn) => {
          const audioUrl = btn.dataset.audioUrl;
          if (!audioUrl) return;
          let audio = null;
          btn.addEventListener('click', () => {
            if (!audio) {
              audio = new Audio(audioUrl);
              audio.addEventListener('ended', () => {
                btn.querySelector('.material-symbols-rounded').textContent = 'play_arrow';
              });
              audio.addEventListener('error', () => {
                showError('音声の再生に失敗しました');
                audio = null;
              });
            }
            if (audio.paused) {
              audio.play().catch(() => showError('音声の再生に失敗しました'));
              btn.querySelector('.material-symbols-rounded').textContent = 'pause';
            } else {
              audio.pause();
              btn.querySelector('.material-symbols-rounded').textContent = 'play_arrow';
            }
          });
        });
      }
      messageList.scrollTop = messageList.scrollHeight;
    } catch (error) {
      if (messageList) messageList.innerHTML = `<div class="chat-empty">${escHtml(error.message)}</div>`;
    }
  }

  function renderAudioBubble(message, isMe, time) {
    // ダミーの波形バー（見た目のみ）
    const bars = Array.from({ length: 20 }, (_, i) => {
      const h = 8 + Math.abs(Math.sin(i * 0.7 + message.id) * 18);
      return `<div class="audio-waveform-bar" style="height:${h}px"></div>`;
    }).join('');

    return `<div class="chat-bubble ${isMe ? 'me' : 'them'}">
      <div class="audio-bubble-inner">
        <button class="audio-play-btn" type="button" data-audio-url="${escHtml(message.audioUrl)}" aria-label="再生">
          <span class="material-symbols-rounded">play_arrow</span>
        </button>
        <div class="audio-waveform">${bars}</div>
      </div>
      <span class="chat-time">${time}</span>
    </div>`;
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
        body: JSON.stringify({ receiverId: activeContact.id, message: text, messageType: 'text' })
      });
      if (!response.ok) throw new Error('メッセージを送信できませんでした');
      input.value = '';
      await renderMessages();
    } catch (error) {
      showError(error.message);
    }
  }

  // ─── 音声録音 ──────────────────────────────────

  let mediaRecorder = null;
  let audioChunks = [];
  let recordingTimerInterval = null;
  let recordingSeconds = 0;
  let recordedBlob = null;
  let recordedDuration = 0;
  let previewAudio = null;

  function getBestMimeType() {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function showError(msg) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#dc2626;color:#fff;padding:10px 18px;border-radius:10px;font-size:13px;z-index:9999;max-width:90vw;text-align:center;';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError('このブラウザはマイクの録音に対応していません');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      showError('このブラウザはMediaRecorderに対応していません');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        showError('マイクの使用が許可されていません。ブラウザの設定を確認してください');
      } else if (e.name === 'NotFoundError') {
        showError('マイクが見つかりません');
      } else {
        showError('マイクの取得に失敗しました: ' + e.message);
      }
      return;
    }

    const mimeType = getBestMimeType();
    try {
      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      showError('録音の開始に失敗しました');
      return;
    }

    audioChunks = [];
    recordingSeconds = 0;

    mediaRecorder.addEventListener('dataavailable', (e) => {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
    });

    mediaRecorder.addEventListener('stop', () => {
      stream.getTracks().forEach((t) => t.stop());
      recordedDuration = recordingSeconds;
      recordedBlob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
      showAudioPreview();
    });

    mediaRecorder.start(100);

    // マイクボタンを録音中に
    const micBtn = root.querySelector('#mic-btn');
    if (micBtn) micBtn.classList.add('recording');

    // テキストフォームを隠す
    const chatForm = root.querySelector('#chat-form');
    if (chatForm) chatForm.style.display = 'none';

    // 録音中UIを表示
    const recUI = root.querySelector('#audio-recording-ui');
    recUI.style.display = 'block';
    recUI.innerHTML = `
      <div class="recording-ui">
        <div class="recording-dot"></div>
        <span class="recording-label">録音中</span>
        <span class="recording-timer" id="rec-timer">00:00</span>
        <div class="recording-actions">
          <button class="recording-stop-btn" type="button" id="rec-stop">
            <span class="material-symbols-rounded">stop</span>停止
          </button>
          <button class="recording-cancel-btn" type="button" id="rec-cancel">
            <span class="material-symbols-rounded">close</span>キャンセル
          </button>
        </div>
      </div>
    `;

    recordingTimerInterval = setInterval(() => {
      recordingSeconds++;
      const timer = root.querySelector('#rec-timer');
      if (timer) timer.textContent = formatTime(recordingSeconds);
    }, 1000);

    root.querySelector('#rec-stop').addEventListener('click', stopRecording);
    root.querySelector('#rec-cancel').addEventListener('click', cancelRecording);
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    clearInterval(recordingTimerInterval);
    const recUI = root.querySelector('#audio-recording-ui');
    if (recUI) recUI.style.display = 'none';
    const micBtn = root.querySelector('#mic-btn');
    if (micBtn) micBtn.classList.remove('recording');
  }

  function cancelRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.addEventListener('stop', () => {}, { once: true });
      mediaRecorder.stop();
      // stopイベントはpreviewを出さないようにクリーンアップ
    }
    clearInterval(recordingTimerInterval);
    audioChunks = [];
    recordedBlob = null;
    recordedDuration = 0;

    const recUI = root.querySelector('#audio-recording-ui');
    if (recUI) recUI.style.display = 'none';
    const previewUI = root.querySelector('#audio-preview-ui');
    if (previewUI) previewUI.style.display = 'none';
    const chatForm = root.querySelector('#chat-form');
    if (chatForm) chatForm.style.display = 'flex';
    const micBtn = root.querySelector('#mic-btn');
    if (micBtn) micBtn.classList.remove('recording');
  }

  function showAudioPreview() {
    if (!recordedBlob) return;

    const previewUI = root.querySelector('#audio-preview-ui');
    previewUI.style.display = 'block';
    previewUI.innerHTML = `
      <div class="audio-preview">
        <button class="audio-preview-play" type="button" id="preview-play" aria-label="プレビュー再生">
          <span class="material-symbols-rounded">play_arrow</span>
        </button>
        <span class="audio-preview-duration">${formatTime(recordedDuration)}</span>
        <span class="audio-preview-label">録音済み音声</span>
        <button class="audio-preview-delete" type="button" id="preview-delete" aria-label="削除">
          <span class="material-symbols-rounded">delete</span>
        </button>
        <button class="audio-preview-send" type="button" id="preview-send">送信</button>
      </div>
    `;

    const previewUrl = URL.createObjectURL(recordedBlob);
    previewAudio = new Audio(previewUrl);
    previewAudio.addEventListener('ended', () => {
      const btn = root.querySelector('#preview-play');
      if (btn) btn.querySelector('.material-symbols-rounded').textContent = 'play_arrow';
    });

    root.querySelector('#preview-play').addEventListener('click', () => {
      const icon = root.querySelector('#preview-play .material-symbols-rounded');
      if (previewAudio.paused) {
        previewAudio.play().catch(() => showError('再生に失敗しました'));
        icon.textContent = 'pause';
      } else {
        previewAudio.pause();
        icon.textContent = 'play_arrow';
      }
    });

    root.querySelector('#preview-delete').addEventListener('click', () => {
      if (previewAudio) { previewAudio.pause(); previewAudio = null; }
      URL.revokeObjectURL(previewUrl);
      recordedBlob = null;
      previewUI.style.display = 'none';
      const chatForm = root.querySelector('#chat-form');
      if (chatForm) chatForm.style.display = 'flex';
    });

    root.querySelector('#preview-send').addEventListener('click', async () => {
      if (previewAudio) { previewAudio.pause(); previewAudio = null; }
      URL.revokeObjectURL(previewUrl);
      await sendAudioMessage();
    });
  }

  async function sendAudioMessage() {
    if (!recordedBlob) return;

    const sendBtn = root.querySelector('#preview-send');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '送信中...'; }

    try {
      // 1. 音声ファイルをアップロード
      const ext = recordedBlob.type.includes('ogg') ? 'ogg' : recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const formData = new FormData();
      formData.append('file', recordedBlob, `voice.${ext}`);

      const uploadRes = await fetch(`${API_BASE}/chat/audio`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('authToken')}` },
        body: formData
      });
      if (!uploadRes.ok) throw new Error('音声のアップロードに失敗しました');
      const uploadData = await uploadRes.json();
      const audioUrl = uploadData.audioUrl;

      // 2. チャットメッセージとして送信
      const msgRes = await fetch(`${API_BASE}/chat/messages`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          receiverId: activeContact.id,
          message: '',
          messageType: 'audio',
          audioUrl
        })
      });
      if (!msgRes.ok) throw new Error('音声メッセージの送信に失敗しました');

      // 3. UI リセット
      recordedBlob = null;
      const previewUI = root.querySelector('#audio-preview-ui');
      if (previewUI) previewUI.style.display = 'none';
      const chatForm = root.querySelector('#chat-form');
      if (chatForm) chatForm.style.display = 'flex';

      await renderMessages();
    } catch (error) {
      showError(error.message);
      if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '送信'; }
    }
  }

  function cleanupRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch (_) {}
    }
    clearInterval(recordingTimerInterval);
    if (previewAudio) { try { previewAudio.pause(); } catch (_) {} previewAudio = null; }
    mediaRecorder = null;
    audioChunks = [];
    recordedBlob = null;
  }

  // ─── キャンセル対応：画面遷移時にstopをかける ─
  // cancelRecording の stop イベントで preview が出ないよう上書き
  const origCancelRecording = cancelRecording;

  // ─── 起動 ────────────────────────────────────

  const params = new URLSearchParams(window.location.search);
  const autoContactId = params.get('contactId') ? Number(params.get('contactId')) : null;

  if (autoContactId) {
    root.innerHTML = '<div class="chat-loading">チャット相手を読み込み中...</div>';
    const fallbackName = sessionStorage.getItem('chatTargetName') || '連絡先';
    const fallbackRole = sessionStorage.getItem('chatTargetRole') || 'finder';
    activeContact = { id: autoContactId, displayName: fallbackName, role: fallbackRole };
    openRoom(autoContactId);
    loadContacts().then(() => {
      const found = contacts.find((c) => c.id === autoContactId);
      if (found && found.displayName !== fallbackName) {
        const nameEl = root.querySelector('.chat-room-head strong');
        if (nameEl) nameEl.textContent = found.displayName;
        activeContact.displayName = found.displayName;
        activeContact.role = found.role;
      }
    }).catch(() => {});
  } else {
    renderContacts();
  }
})();
