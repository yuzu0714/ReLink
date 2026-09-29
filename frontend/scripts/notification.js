/* ---------------- notification ---------------- */
(() => {
  const list = document.getElementById('notify-list');

  // notify.html 以外では何もしない
  if (!list) return;


  // 相対時刻の生成
  function relativeTime(isoStr) {
    const diff = Date.now() - new Date(isoStr).getTime();
    const min = Math.floor(diff / 60000);

    if (min < 1) return 'たった今';
    if (min < 60) return `${min}分前`;

    const h = Math.floor(min / 60);

    if (h < 24) return `${h}時間前`;

    const d = Math.floor(h / 24);

    if (d < 7) return `${d}日前`;

    return new Date(isoStr).toLocaleDateString('ja-JP');
  }


  // HTMLエスケープ
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }


  // 通知カードのHTML生成
  function buildCard(n) {
    const cardClass = n.isRead ? 'notif read' : 'notif';

    return `
      <div
        class="${cardClass}"
        style="cursor:pointer"
        data-id="${n.id}"
        data-match-id="${n.matchId || ''}"
      >
        <div class="dot" id="dot-${n.id}"></div>
        <div>
          <div class="nt">ペットのマッチング通知</div>
          <div class="nb">${escHtml(n.message)}</div>
          <div class="tm">${relativeTime(n.createdAt)}</div>
        </div>
      </div>
    `;
  }


  // 通知を既読にする
  function markRead(id, cardEl) {
    const dot = document.getElementById('dot-' + id);
    if (dot) dot.className = 'dot';
    if (cardEl) cardEl.classList.add('read');

    const token = sessionStorage.getItem('authToken');
    if (token) {
      fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    }
  }


  // マッチング詳細オーバーレイを表示
  function showMatchDetail(matchId) {
    const token = sessionStorage.getItem('authToken');

    const overlay = document.createElement('div');
    overlay.id = 'match-detail-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:20px;max-width:400px;width:100%;' +
      'max-height:85vh;overflow-y:auto;padding:24px;position:relative">' +
      '<div style="text-align:center;padding:32px 0;color:#888">読み込み中...</div></div>';
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    fetch(`${API_BASE}/matches/${matchId}/detail`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        const box = overlay.querySelector('div');
        const isShelter   = d.protectedSource === 'rescued';
        const srcLabel    = isShelter ? '保護団体' : '発見者';
        const score       = Math.round(d.matchScore);
        const photos      = (d.pet.photoUrls || [])
          .map(u => `<img src="${u}" style="width:100%;border-radius:12px;margin-bottom:8px">`)
          .join('');
        const contactName  = d.contact.displayName || (isShelter ? '保護団体' : '発見者');
        const contactEmail = d.contact.email || '';

        box.innerHTML =
          `<button id="md-close" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:22px;cursor:pointer;color:#888">✕</button>
          <div style="font-size:13px;color:#888;margin-bottom:4px">${srcLabel}が保護中</div>
          <div style="font-size:20px;font-weight:700;margin-bottom:16px">マッチ率 ${score}%</div>
          ${photos}
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px">
            <tr><td style="padding:8px 0;color:#888;width:80px">種類</td><td>${escHtml(d.pet.specie || '—')}</td></tr>
            <tr><td style="padding:8px 0;color:#888">毛色</td><td>${escHtml(d.pet.color || '—')}</td></tr>
            <tr><td style="padding:8px 0;color:#888">発見場所</td><td>${escHtml(d.pet.foundPlace || '—')}</td></tr>
            <tr><td style="padding:8px 0;color:#888">その他</td><td>${escHtml(d.pet.other || '—')}</td></tr>
          </table>
          <button id="md-claim-btn" style="margin-top:20px;width:100%;padding:14px;background:var(--magenta,#e040fb);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer">🐾 飼い犬です</button>
          <div id="md-contact" style="display:none;margin-top:16px;padding:16px;background:#f8fafb;border-radius:12px">
            <div style="font-weight:600;margin-bottom:8px">📞 ${srcLabel}の連絡先</div>
            <div style="font-size:14px;color:#444;margin-bottom:6px">${escHtml(contactName)}</div>
            <div style="display:flex;align-items:center;gap:8px">
              <span id="md-email-text" style="font-size:13px;color:#555;flex:1">${contactEmail ? escHtml(contactEmail) : '（連絡先なし）'}</span>
              ${contactEmail ? '<button id="md-copy-btn" style="padding:6px 12px;border:1px solid var(--line,#e0e0e0);background:#fff;border-radius:8px;font-size:12px;cursor:pointer">コピー</button>' : ''}
            </div>
          </div>`;

        box.querySelector('#md-close').addEventListener('click', () => overlay.remove());
        box.querySelector('#md-claim-btn').addEventListener('click', function () {
          document.getElementById('md-contact').style.display = 'block';
          this.style.display = 'none';
        });

        const copyBtn = box.querySelector('#md-copy-btn');
        if (copyBtn) {
          copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(contactEmail).then(() => {
              copyBtn.textContent = 'コピーしました！';
              setTimeout(() => { copyBtn.textContent = 'コピー'; }, 2000);
            });
          });
        }
      })
      .catch(() => {
        const box = overlay.querySelector('div');
        if (box) box.innerHTML = '<div style="padding:32px;text-align:center;color:#888">詳細の取得に失敗しました</div>';
      });
  }


  // 通知一覧を取得・描画
  async function loadNotifications() {
    const token = sessionStorage.getItem('authToken');

    if (!token) {
      list.innerHTML = '<div class="notify-empty">ログインが必要です。</div>';
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        list.innerHTML = `<div class="notify-empty">通知の取得に失敗しました (${res.status})</div>`;
        return;
      }

      const data          = await res.json();
      const notifications = data.notifications || [];

      if (notifications.length === 0) {
        list.innerHTML = '<div class="notify-empty">通知はまだありません。</div>';
        return;
      }

      list.innerHTML = notifications.map(buildCard).join('');

      // カードにクリックイベントを付与
      list.querySelectorAll('[data-id]').forEach(card => {
        card.addEventListener('click', () => {
          const id      = Number(card.dataset.id);
          const matchId = Number(card.dataset.matchId);

          markRead(id, card);
          if (matchId) showMatchDetail(matchId);
        });
      });

    } catch (e) {
      list.innerHTML = '<div class="notify-empty">通知の取得中にエラーが発生しました。</div>';
      console.error(e);
    }
  }


  // 通知一覧を読み込む
  loadNotifications();

})();
