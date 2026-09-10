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
    const dotClass =
      n.isRead
        ? 'notify-dot'
        : 'notify-dot unread';

    return `
      <div
        class="notify-card"
        data-id="${n.id}"
        onclick="markRead(${n.id}, this)"
      >
        <div
          class="${dotClass}"
          id="dot-${n.id}"
        ></div>

        <div class="notify-content">
          <div class="notify-title">
            ペットのマッチング通知
          </div>

          <div class="notify-body">
            ${escHtml(n.message)}
          </div>

          <div class="notify-time">
            ${relativeTime(n.createdAt)}
          </div>
        </div>
      </div>
    `;
  }


  // 通知を既読にする
  async function markRead(id, cardEl) {
    const dot = document.getElementById('dot-' + id);

    if (dot) {
      dot.className = 'notify-dot';
    }

    const token =
      sessionStorage.getItem('authToken');

    if (token) {
      fetch(
        `${API_BASE}/notifications/${id}/read`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      ).catch(() => {});
    }
  }


  // 通知一覧を取得
  async function loadNotifications() {
    const token =
      sessionStorage.getItem('authToken');

    if (!token) {
      list.innerHTML =
        '<div class="notify-empty">ログインが必要です。</div>';
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/notifications`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!res.ok) {
        list.innerHTML =
          `<div class="notify-empty">通知の取得に失敗しました (${res.status})</div>`;
        return;
      }

      const data = await res.json();

      const notifications =
        data.notifications || [];

      if (notifications.length === 0) {
        list.innerHTML =
          '<div class="notify-empty">通知はまだありません。</div>';
        return;
      }

      list.innerHTML =
        notifications
          .map(buildCard)
          .join('');

    } catch (e) {
      list.innerHTML =
        '<div class="notify-empty">通知の取得中にエラーが発生しました。</div>';

      console.error(e);
    }
  }


  // HTMLのonclickから呼び出せるようにする
  window.markRead = markRead;


  // 通知一覧を読み込む
  loadNotifications();

})();