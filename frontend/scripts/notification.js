/* ---------------- notification v2 ---------------- */
(() => {
  const app = document.querySelector('.notif-screen');
  if (!app) return;

  /* ---- trash (localStorage) ---- */
  const TRASH_KEY = 'relink_notif_trash_v1';
  function getTrash() { try { return JSON.parse(localStorage.getItem(TRASH_KEY) || '[]'); } catch { return []; } }
  function saveTrash(arr) { try { localStorage.setItem(TRASH_KEY, JSON.stringify(arr)); } catch {} }
  function addToTrash(n) { const t = getTrash(); if (!t.find(x => x.id === n.id)) { t.unshift(n); saveTrash(t); } }
  function removeFromTrash(id) { saveTrash(getTrash().filter(x => x.id !== id)); }
  function clearTrash() { saveTrash([]); }

  /* ---- state ---- */
  let allNotifs = [];
  let currentSec = 'inbox';

  /* ---- utils ---- */
  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
  }

  /* ---- card builder ---- */
  function buildCard(n, inTrash) {
    const cls = n.isRead ? 'notif-card read' : 'notif-card unread';
    const scoreMatch = (n.message || '').match(/(\d+)%/);
    const score = scoreMatch ? scoreMatch[1] : null;
    return `
      <div class="${cls}" data-id="${n.id}" data-match-id="${n.matchId || ''}">
        <div class="nc-body">
          <div class="nc-head">
            <div class="nc-title-row">
              <span class="nc-title">マッチングが見つかりました</span>
              ${score ? `<span class="nc-score">${score}%</span>` : ''}
            </div>
            <div class="nc-right">
              <span class="nc-date">${formatDate(n.createdAt)}</span>
              <button class="nc-del-btn" data-id="${n.id}" data-in-trash="${inTrash ? '1' : ''}">✕</button>
            </div>
          </div>
          <div class="nc-msg">${escHtml(n.message)}</div>
          ${inTrash ? `<button class="nc-restore-btn" data-id="${n.id}">↩ 元に戻す</button>` : ''}
        </div>
      </div>
    `;
  }

  function emptyMsg(msg) {
    return `<div class="notif-empty">${msg}</div>`;
  }

  /* ---- render ---- */
  function renderInbox() {
    const trashIds = new Set(getTrash().map(x => x.id));
    const items = allNotifs.filter(n => !trashIds.has(n.id));
    const el = document.getElementById('notify-list');
    if (!el) return;
    el.innerHTML = items.length ? items.map(n => buildCard(n, false)).join('') : emptyMsg('通知はまだありません。');
    bindEvents(el, false);
  }

  function renderSimilar() {
    const trashIds = new Set(getTrash().map(x => x.id));
    const items = allNotifs.filter(n => !trashIds.has(n.id) && (n.message || '').match(/\d+%/));
    const el = document.getElementById('similar-list');
    if (!el) return;
    el.innerHTML = items.length ? items.map(n => buildCard(n, false)).join('') : emptyMsg('似たペットの通知はまだありません。');
    bindEvents(el, false);
  }

  function renderTrash() {
    const trash = getTrash();
    const el = document.getElementById('trash-list');
    if (!el) return;
    if (!trash.length) { el.innerHTML = emptyMsg('ゴミ箱は空です。'); return; }
    el.innerHTML = `
      <div class="trash-header">
        <span class="trash-count">${trash.length}件</span>
        <button class="trash-clear-btn" id="btn-clear-trash">ゴミ箱を空にする</button>
      </div>
      ${trash.map(n => buildCard(n, true)).join('')}
    `;
    document.getElementById('btn-clear-trash')?.addEventListener('click', () => { clearTrash(); renderTrash(); });
    bindEvents(el, true);
  }

  function renderCurrent() {
    if (currentSec === 'inbox') renderInbox();
    else if (currentSec === 'similar') renderSimilar();
    else if (currentSec === 'trash') renderTrash();
  }

  /* ---- event binding ---- */
  function bindEvents(container, inTrash) {
    container.querySelectorAll('.nc-del-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        if (inTrash) {
          removeFromTrash(id); renderTrash();
        } else {
          const n = allNotifs.find(x => x.id === id);
          if (n) addToTrash(n);
          renderCurrent();
        }
      });
    });
    container.querySelectorAll('.nc-restore-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        removeFromTrash(Number(btn.dataset.id));
        renderTrash();
      });
    });
    if (!inTrash) {
      container.querySelectorAll('.notif-card').forEach(card => {
        card.addEventListener('click', e => {
          if (e.target.closest('.nc-del-btn')) return;
          const id = Number(card.dataset.id);
          const matchId = Number(card.dataset.matchId);
          markRead(id, card);
          if (matchId) showMatchDetail(matchId);
        });
      });
    }
  }

  /* ---- mark read ---- */
  function markRead(id, cardEl) {
    if (cardEl) { cardEl.classList.remove('unread'); cardEl.classList.add('read'); }
    const n = allNotifs.find(x => x.id === id);
    if (n) n.isRead = true;
    const token = sessionStorage.getItem('authToken');
    if (token) {
      fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    }
  }

  /* ---- match detail overlay ---- */
  function showMatchDetail(matchId) {
    const token = sessionStorage.getItem('authToken');
    const overlay = document.createElement('div');
    overlay.id = 'match-detail-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML = '<div style="background:#fff;border-radius:20px;max-width:400px;width:100%;max-height:85vh;overflow-y:auto;padding:24px;position:relative"><div style="text-align:center;padding:32px 0;color:#888">読み込み中...</div></div>';
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    fetch(`${API_BASE}/matches/${matchId}/detail`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const box = overlay.querySelector('div');
        const isShelter = d.protectedSource === 'rescued';
        const srcLabel = isShelter ? '保護団体' : '発見者';
        const score = Math.round(d.matchScore);
        const photos = (d.pet.photoUrls || []).map(u => `<img src="${u}" style="width:100%;border-radius:12px;margin-bottom:8px">`).join('');
        const contactName = d.contact.displayName || (isShelter ? '保護団体' : '発見者');
        const contactEmail = d.contact.email || '';
        box.innerHTML = `
          <button id="md-close" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:22px;cursor:pointer;color:#888">✕</button>
          <div style="font-size:13px;color:#888;margin-bottom:4px">${srcLabel}が保護中</div>
          <div style="font-size:20px;font-weight:700;margin-bottom:16px">マッチ率 ${score}%</div>
          ${photos}
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px">
            <tr><td style="padding:8px 0;color:#888;width:80px">種類</td><td>${escHtml(d.pet.specie||'—')}</td></tr>
            <tr><td style="padding:8px 0;color:#888">毛色</td><td>${escHtml(d.pet.color||'—')}</td></tr>
            <tr><td style="padding:8px 0;color:#888">発見場所</td><td>${escHtml(d.pet.foundPlace||'—')}</td></tr>
            <tr><td style="padding:8px 0;color:#888">その他</td><td>${escHtml(d.pet.other||'—')}</td></tr>
          </table>
          <button id="md-claim-btn" style="margin-top:20px;width:100%;padding:14px;background:var(--magenta,#e040fb);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer">🐾 飼い犬です</button>
          <div id="md-contact" style="display:none;margin-top:16px;padding:16px;background:#f0f7ff;border-radius:12px">
            <div style="font-weight:600;margin-bottom:8px">📞 ${srcLabel}の連絡先</div>
            <div style="font-size:14px;color:#444;margin-bottom:6px">${escHtml(contactName)}</div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:13px;color:#555;flex:1">${contactEmail ? escHtml(contactEmail) : '（連絡先なし）'}</span>
              ${contactEmail ? '<button id="md-copy-btn" style="padding:6px 12px;border:1px solid #d1d5db;background:#fff;border-radius:8px;font-size:12px;cursor:pointer">コピー</button>' : ''}
            </div>
          </div>`;
        box.querySelector('#md-close').addEventListener('click', () => overlay.remove());
        box.querySelector('#md-claim-btn').addEventListener('click', function() {
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

  /* ---- nav switching ---- */
  document.querySelectorAll('.nnav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSec = btn.dataset.sec;
      const title = btn.dataset.title || '';
      const h1 = document.getElementById('notif-title');
      if (h1) h1.textContent = title;
      document.querySelectorAll('.nnav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.notif-sec').forEach(s => s.classList.remove('active'));
      document.getElementById('sec-' + currentSec)?.classList.add('active');
      renderCurrent();
    });
  });

  /* ---- compose ---- */
  document.getElementById('c-send')?.addEventListener('click', () => {
    const subject = document.getElementById('c-subject')?.value?.trim();
    const body = document.getElementById('c-body')?.value?.trim();
    if (!subject || !body) { alert('件名と本文を入力してください。'); return; }
    const wrap = document.querySelector('.compose-wrap');
    if (wrap) {
      wrap.innerHTML = `
        <div class="compose-sent">
          <div class="compose-sent-icon">✉️</div>
          <div class="compose-sent-title">送信完了</div>
          <div class="compose-sent-msg">メッセージを送信しました</div>
          <button class="compose-new-btn" onclick="location.reload()">新しいメッセージを作成</button>
        </div>`;
    }
  });

  /* ---- load notifications ---- */
  async function loadNotifications() {
    const token = sessionStorage.getItem('authToken');
    const list = document.getElementById('notify-list');
    if (!token) {
      if (list) list.innerHTML = emptyMsg('ログインが必要です。');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (list) list.innerHTML = emptyMsg(`通知の取得に失敗しました (${res.status})`);
        return;
      }
      const data = await res.json();
      allNotifs = data.notifications || [];
      renderInbox();
    } catch (e) {
      if (list) list.innerHTML = emptyMsg('通知の取得中にエラーが発生しました。');
      console.error(e);
    }
  }

  loadNotifications();
})();
