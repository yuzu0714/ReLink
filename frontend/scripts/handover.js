// handover.js — 受け渡し記録ページの処理

(function () {
  const token = sessionStorage.getItem('authToken');
  const role  = sessionStorage.getItem('selectedRole');

  // ロールチップ表示
  const chip = document.getElementById('roleChip');
  if (chip && role) chip.textContent = role === 'shelter' ? '保護団体' : role === 'finder' ? '発見者' : role;

  // shelter / finder だけ登録フォームを表示
  if (role === 'shelter' || role === 'finder') {
    const sec = document.getElementById('registerSection');
    if (sec) sec.style.display = '';
  }

  // ---- 一覧を取得して表示 ----
  async function loadHandovers() {
    const list = document.getElementById('handoverList');
    try {
      const res = await fetch(`${API_BASE}/handovers`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const records = await res.json();

      if (!records || records.length === 0) {
        list.innerHTML = '<div class="lede" style="text-align:center;padding:24px">記録はまだありません。</div>';
        return;
      }

      list.innerHTML = records.map(r => `
        <div style="padding:16px;border-radius:14px;border:1px solid var(--line);background:#fff;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
            <span style="display:inline-block;padding:3px 8px;border-radius:999px;background:#eafaf3;color:#0f7a4b;font-size:11px;font-weight:800">
              ${r.status === 'completed' ? '引渡し完了' : r.status}
            </span>
            <span style="font-size:11px;color:var(--muted)">ID: ${r.id} / 連絡ID: ${r.contactId}</span>
          </div>
          ${r.handedOverTo ? `<div style="margin-top:10px;font-size:14px;font-weight:700;color:var(--navy)">引き渡し先: ${escapeHtml(r.handedOverTo)}</div>` : ''}
          ${r.handoverPlace ? `<div style="margin-top:4px;font-size:13px;color:var(--ink)">場所: ${r.handoverPlace}</div>` : ''}
          ${r.handoverDatetime ? `<div style="margin-top:4px;font-size:12px;color:var(--muted)">日時: ${r.handoverDatetime.replace('T', ' ')}</div>` : ''}
          ${r.note ? `<div style="margin-top:6px;font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:6px">備考: ${r.note}</div>` : ''}
        </div>
      `).join('');
    } catch (e) {
      list.innerHTML = `<div class="lede" style="text-align:center;padding:24px;color:#e53e3e">読み込みに失敗しました: ${e.message}</div>`;
    }
  }

  // ---- フォーム送信 ----
  const form = document.getElementById('handoverForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg    = document.getElementById('formMsg');
      const btn    = document.getElementById('submitBtn');
      const contactId = parseInt(document.getElementById('contactId').value, 10);
      const handoverPlace    = document.getElementById('handoverPlace').value.trim() || null;
      const handoverDatetime = document.getElementById('handoverDatetime').value || null;
      const handedOverTo     = document.getElementById('handedOverTo').value.trim() || null;
      const note             = document.getElementById('note').value.trim() || null;

      if (!contactId) {
        showMsg(msg, '連絡IDは必須です。', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = '送信中…';

      try {
        const res = await fetch(`${API_BASE}/handovers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ contactId, handoverPlace, handoverDatetime, handedOverTo, note })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `HTTP ${res.status}`);
        }

        showMsg(msg, '記録しました！', 'success');
        form.reset();
        loadHandovers();
      } catch (err) {
        showMsg(msg, `エラー: ${err.message}`, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '記録する';
      }
    });
  }

  function showMsg(el, text, type) {
    el.style.display = '';
    el.textContent = text;
    el.style.background = type === 'success' ? '#eafaf3' : '#fff5f5';
    el.style.color       = type === 'success' ? '#0f7a4b' : '#e53e3e';
    el.style.border      = `1px solid ${type === 'success' ? '#86efac' : '#fca5a5'}`;
  }

  // ページ読み込み時に一覧取得
  loadHandovers();
})();
