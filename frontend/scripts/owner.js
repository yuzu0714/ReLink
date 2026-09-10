/* ---------------- ReLINK — owner ---------------- */

function initOwnerPage() {
  const ownerScreen = document.querySelector('.screen');
  if (!ownerScreen) return;

  const homeMarkup = ownerScreen.innerHTML;

  let ownerMatchTimer = null;

  // 古いマッチング処理の結果で画面が上書きされるのを防ぐ
  let ownerMatchRequestToken = 0;

  // 直近のマッチング結果
  let ownerMatchResults = [];

  // 飼い主の登録フォームの状態
  let ownerState = {
    photos: [],
    color: null,
    specie: '',
    otherSpecie: '',
    other: '',
    phone: '',
    lostPlace: ''
  };


  /* ---------------- アプリバー ---------------- */

  function ownerAppbar(title, backAction = 'home') {
    return `
      <div class="appbar">
        <button
          class="back"
          type="button"
          data-owner-action="${backAction}"
        >‹</button>

        <h1>${title}</h1>

        <div class="spacer"></div>

        <span class="role-chip">Owner</span>
      </div>
    `;
  }


  /* ---------------- ペット登録画面 ---------------- */

  function showRegister() {

    ownerState = {
      photos: [],
      color: null,
      specie: '',
      otherSpecie: '',
      other: '',
      phone: '',
      lostPlace: ''
    };

    ownerScreen.innerHTML = `
      ${ownerAppbar('ペット情報を登録')}

      <div class="pad stack fade">

        <div>
          <div class="eyebrow">STEP 1 / 撮影</div>

          <h2 class="title">
            手持ちの写真をアップ
          </h2>

          <div class="lede">
            全体像と、首輪がはっきり写った写真があるほど精度が上がります。
          </div>
        </div>

        <input
          type="file"
          id="ownerFileInput"
          accept="image/*"
          multiple
          hidden
        >

        <div class="imgbox" data-owner-file>
          <div class="big">📸</div>

          <div class="cap">
            <b style="color:var(--navy)">
              タップして写真を追加
            </b>
            <br>
            全体像 ＋ 首輪アップがおすすめ
          </div>
        </div>

        <div
          class="owner-thumbs"
          id="ownerThumbs"
        ></div>

        <button
          class="btn btn-ghost btn-sm"
          id="ownerAiFillBtn"
          type="button"
          style="width:100%"
          data-owner-action="ai-fill"
        >
          🤖 写真からAIで自動入力（未入力の項目のみ）
        </button>

        <div
          class="footnote"
          style="padding:0 0 4px"
        >
          写真を追加した後に押すと、種類・毛色・そのほか欄のうち、
          まだ入力していない項目だけをAIが推定して埋めます。
          すでに入力した項目は変更しません。
        </div>


        <div class="field">
          <label>連絡先電話番号</label>

          <input
            class="input"
            id="ownerPhone"
            type="tel"
            placeholder="090-0000-0000"
          >
        </div>


        <div class="field">
          <label>紛失場所</label>

          <input
            class="input"
            id="ownerLostPlace"
            type="text"
            placeholder="市区町村"
          >
        </div>


        <div class="field">
          <label>種類・犬種</label>

          <select
            class="input"
            id="ownerSpecie"
          >
            <option value="">選択してください</option>

            <optgroup label="🐕 犬">
              <option>柴犬</option>
              <option>トイプードル</option>
              <option>ドーベルマン</option>
              <option>チワワ</option>
              <option>ゴールデン・レトリバー</option>
              <option>ボーダー・コリー</option>
              <option>ハスキー</option>
              <option>パグ</option>
              <option>秋田犬</option>
              <option>雑種（中型）</option>
            </optgroup>

            <optgroup label="🐈 猫">
              <option>アメリカン・ショートヘア</option>
              <option>スコティッシュ・フォールド</option>
              <option>マンチカン</option>
              <option>ペルシャ</option>
              <option>ロシアン・ブルー</option>
              <option>シャム</option>
              <option>ノルウェージアン・フォレスト・キャット</option>
              <option>メインクーン</option>
              <option>ラグドール</option>
              <option>ブリティッシュ・ショートヘア</option>
              <option>アビシニアン</option>
              <option>ベンガル</option>
              <option>猫（雑種）</option>
            </optgroup>
          </select>
        </div>


        <div class="field">
          <label>上記にない犬種・品種（任意）</label>

          <input
            class="input"
            id="ownerOtherSpecie"
            type="text"
            placeholder="例）ビーグル、ミックス犬など"
          >
        </div>


        <div class="field">
          <label>毛色</label>

          <div
            class="swatches"
            id="ownerSwatches"
          >
            ${petColors.map((color, index) => `
              <div
                class="sw"
                data-owner-color="${index}"
                style="background:${color}"
              ></div>
            `).join('')}
          </div>
        </div>


        <div class="field">
          <label>そのほか</label>

          <textarea
            class="input"
            id="ownerOther"
            placeholder="例）左耳が欠けている。人懐っこい。"
          ></textarea>
        </div>


        <button
          class="btn btn-magenta"
          type="button"
          id="ownerSubmitBtn"
          data-owner-action="submit-lost"
        >
          🐾 登録
        </button>

        <div class="footnote">
          条件で絞り込んだ後、画像識別モデルが特徴を照合します。
        </div>

      </div>
    `;

    setupOwnerRegisterEvents();
  }


  /* ---------------- 登録フォームのイベント ---------------- */

  function setupOwnerRegisterEvents() {

    const fileInput = document.getElementById('ownerFileInput');
    const imageBox = document.querySelector('[data-owner-file]');

    if (imageBox && fileInput) {
      imageBox.addEventListener('click', () => {
        fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (event) => {

        const files = Array.from(event.target.files || []);

        files.forEach((file) => {

          const src = URL.createObjectURL(file);

          ownerState.photos.push({
            file,
            src
          });

        });

        renderOwnerThumbs();

        fileInput.value = '';
      });
    }


    const specie = document.getElementById('ownerSpecie');

    if (specie) {
      specie.addEventListener('change', () => {
        ownerState.specie = specie.value;
      });
    }


    const otherSpecie = document.getElementById('ownerOtherSpecie');

    if (otherSpecie) {
      otherSpecie.addEventListener('input', () => {
        ownerState.otherSpecie = otherSpecie.value;
      });
    }


    const phone = document.getElementById('ownerPhone');

    if (phone) {
      phone.addEventListener('input', () => {
        ownerState.phone = phone.value;
      });
    }


    const lostPlace = document.getElementById('ownerLostPlace');

    if (lostPlace) {
      lostPlace.addEventListener('input', () => {
        ownerState.lostPlace = lostPlace.value;
      });
    }


    const other = document.getElementById('ownerOther');

    if (other) {
      other.addEventListener('input', () => {
        ownerState.other = other.value;
      });
    }
  }


  /* ---------------- 写真サムネイル ---------------- */

  function renderOwnerThumbs() {

    const thumbs = document.getElementById('ownerThumbs');

    if (!thumbs) return;

    thumbs.innerHTML = ownerState.photos.map((photo, index) => `
      <div
        class="thumb"
        data-owner-photo="${index}"
        style="
          background-image:url('${photo.src}');
          background-size:cover;
          background-position:center;
        "
      ></div>
    `).join('');

  }


  /* ---------------- 毛色 ---------------- */

  function pickOwnerColor(index) {

    ownerState.color = index;

    document
      .querySelectorAll('#ownerSwatches .sw')
      .forEach((element) => {

        element.classList.toggle(
          'on',
          Number(element.dataset.ownerColor) === index
        );

      });
  }


  /* ---------------- AI自動入力 ---------------- */

  async function aiAutoFillOwner() {

    const btn = document.getElementById('ownerAiFillBtn');

    if (!btn) return;

    const originalLabel = btn.textContent;

    btn.disabled = true;
    btn.textContent = 'AI解析中…';

    try {

      if (ownerState.photos.length === 0) {
        throw new Error('写真を1枚以上追加してください。');
      }

      const result = await callAiExtractFeatures(
        ownerState.photos.map((photo) => photo.file)
      );

      /*
       * すでに入力されている項目は上書きしない
       */

      if (!ownerState.specie && !ownerState.otherSpecie) {

        if (result.specie) {
          ownerState.specie = result.specie;

          const specie = document.getElementById('ownerSpecie');

          if (specie) {
            specie.value = result.specie;
          }
        }

        if (result.otherSpecie) {
          ownerState.otherSpecie = result.otherSpecie;

          const input =
            document.getElementById('ownerOtherSpecie');

          if (input) {
            input.value = result.otherSpecie;
          }
        }
      }


      if (
        ownerState.color === null &&
        result.colorIndex !== undefined &&
        result.colorIndex !== null &&
        result.colorIndex >= 0
      ) {

        pickOwnerColor(Number(result.colorIndex));

      }


      if (!ownerState.other && result.other) {

        ownerState.other = result.other;

        const textarea =
          document.getElementById('ownerOther');

        if (textarea) {
          textarea.value = ownerState.other;
        }
      }

    } catch (error) {

      console.error(error);

      alert(
        error.message ||
        'AIによる自動入力に失敗しました。'
      );

    } finally {

      btn.disabled = false;
      btn.textContent = originalLabel;

    }
  }


  /* ---------------- 紛失ペット登録 ---------------- */

  async function submitLost() {

    const token =
      sessionStorage.getItem('authToken');

    if (!token) {

      alert(
        'ログインが必要です。ログイン画面からやり直してください。'
      );

      window.location.href = 'login.html';

      return;
    }


    if (ownerState.photos.length === 0) {

      alert('写真を1枚以上追加してください。');

      return;
    }


    if (!ownerState.phone) {

      alert('連絡先電話番号を入力してください。');

      return;
    }


    if (!ownerState.lostPlace) {

      alert('紛失場所を入力してください。');

      return;
    }


    if (!ownerState.specie && !ownerState.otherSpecie) {

      alert(
        '種類・犬種を選択するか、上記にない犬種・品種欄に入力してください。'
      );

      return;
    }


    if (ownerState.color === null) {

      alert('毛色を選択してください。');

      return;
    }


    const submitBtn =
      document.getElementById('ownerSubmitBtn');

    if (!submitBtn) return;

    submitBtn.disabled = true;

    const originalLabel =
      submitBtn.textContent;

    submitBtn.textContent = '登録中…';


    try {

      const photoUrls = await uploadPhotos(
        ownerState.photos.map((photo) => photo.file),
        token
      );


      const lostRes = await fetch(
        `${API_BASE}/pets/lost`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },

          body: JSON.stringify({

            photoUrls,

            phoneNumber:
              ownerState.phone,

            specie:
              ownerState.specie ||
              ownerState.otherSpecie,

            color:
              colorNames[ownerState.color],

            other:
              ownerState.other || null,

            lostPlace:
              ownerState.lostPlace

          })
        }
      );


      if (!lostRes.ok) {

        if (lostRes.status === 403) {

          throw new Error(
            'この操作には飼い主(owner)権限が必要です。ログインし直してください。'
          );
        }

        const body =
          await lostRes.json().catch(() => null);

        throw new Error(
          (body && body.message) ||
          `登録に失敗しました。(status ${lostRes.status})`
        );
      }


      const lostBody =
        await lostRes.json();

      // 登録後、そのままAIマッチングへ
      showMatching(lostBody.id);

    } catch (error) {

      console.error(error);

      alert(
        error.message ||
        '登録中にエラーが発生しました。'
      );

    } finally {

      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;

    }
  }


  /* ---------------- AIマッチング中 ---------------- */

  function showMatching(lostPetId) {

    ownerScreen.innerHTML = `
      ${ownerAppbar('AIマッチング')}

      <div class="loader-wrap fade">

        <div class="eyebrow">
          AI MATCHING
        </div>

        <div class="paw-container">
          <svg
            class="paw-svg"
            viewBox="0 0 100 100"
          >
            <text
              x="50"
              y="60"
              text-anchor="middle"
              font-size="45"
            >
              🐾
            </text>
          </svg>
        </div>

        <div class="mm">
          マッチング中…
        </div>

        <div class="barwrap">

          <div class="bar">
            <i
              id="ownerBar"
              style="width:0%"
            ></i>
          </div>

          <div
            class="pct"
            id="ownerPct"
          >
            0%
          </div>

        </div>

        <div
          class="lede"
          style="max-width:260px"
        >
          保護中のペットの中から、
          外見と首輪の特徴が近い子を探しています。
        </div>

        <button
          class="cancel-link"
          type="button"
          data-owner-action="register"
        >
          時間がかかる場合はキャンセル
        </button>

      </div>
    `;


    const myToken =
      ++ownerMatchRequestToken;

    let progress = 0;


    ownerMatchTimer = setInterval(() => {

      progress =
        Math.min(
          95,
          progress + 5
        );

      const bar =
        document.getElementById('ownerBar');

      const pct =
        document.getElementById('ownerPct');


      if (bar) {
        bar.style.width =
          `${progress}%`;
      }

      if (pct) {
        pct.textContent =
          `${progress}%`;
      }

    }, 200);


    fetch(
      `${API_BASE}/matching/run?lostPetId=${lostPetId}`,
      {
        method: 'POST'
      }
    )

      .then(async (res) => {

        if (!res.ok) {

          const body =
            await res.json().catch(() => null);

          throw new Error(
            (body && body.message) ||
            `マッチングに失敗しました。(status ${res.status})`
          );
        }

        return res.json();

      })

      .then((data) => {

        if (
          myToken !== ownerMatchRequestToken
        ) {
          return;
        }


        if (ownerMatchTimer) {

          clearInterval(ownerMatchTimer);
          ownerMatchTimer = null;

        }


        ownerMatchResults =
          (data && data.results) || [];


        const bar =
          document.getElementById('ownerBar');

        const pct =
          document.getElementById('ownerPct');


        if (bar) {
          bar.style.width = '100%';
        }

        if (pct) {
          pct.textContent = '100%';
        }


        setTimeout(() => {

          if (
            myToken === ownerMatchRequestToken
          ) {
            showResults(ownerMatchResults);
          }

        }, 350);

      })

      .catch((error) => {

        if (
          myToken !== ownerMatchRequestToken
        ) {
          return;
        }


        if (ownerMatchTimer) {

          clearInterval(ownerMatchTimer);
          ownerMatchTimer = null;

        }


        console.error(error);

        alert(
          error.message ||
          'マッチング処理中にエラーが発生しました。'
        );

        ownerScreen.innerHTML =
          homeMarkup;

      });

  }


  /* ---------------- マッチング結果 ---------------- */

  function showResults(results) {

    const list = results || [];


    const body =
      list.length === 0

        ? `
          <div
            class="card"
            style="background:#f2f4ff;border-color:#d8ddfb"
          >
            <b style="color:var(--navy)">
              候補が見つかりませんでした
            </b>

            <div class="lede">
              現在登録されている保護ペットの中には、
              条件に近い子がいませんでした。
              新しく保護情報が登録された際に
              改めてお知らせします。
            </div>
          </div>
        `

        : `
          <div
            class="card"
            style="background:#f2f4ff;border-color:#d8ddfb"
          >
            <b style="color:var(--navy)">
              ${list.length}件ヒットしました
            </b>

            <div class="lede">
              マッチ率が高い順に表示しています。
            </div>
          </div>

          ${list.map((item, index) => {

            const sourceLabel =
              item.protectedSource === 'rescued'
                ? '保護団体で保護中の個体'
                : '発見された個体';

            const firstPhoto =
              item.photoUrls &&
              item.photoUrls.length > 0
                ? item.photoUrls[0]
                : null;

            const thumbStyle =
              firstPhoto
                ? `
                  background-image:url('${firstPhoto}');
                  background-size:cover;
                  background-position:center
                `
                : `
                  background:${petSwatch(index)}
                `;

            const thumbContent =
              firstPhoto
                ? ''
                : '🐕';


            return `
              <div
                class="match-card"
                data-owner-action="pet-detail"
                data-match-index="${index}"
              >

                <div
                  class="ph"
                  style="${thumbStyle}"
                >
                  ${thumbContent}
                </div>

                <div>
                  <div class="name">
                    ${sourceLabel}
                    #${item.protectedPetId}
                  </div>

                  <div class="meta">
                    ${item.reason || ''}
                  </div>
                </div>

                <div class="score">
                  <b>
                    ${Math.round(item.matchScore)}%
                  </b>

                  <span>
                    マッチ率
                  </span>
                </div>

              </div>
            `;

          }).join('')}
        `;


    ownerScreen.innerHTML = `
      ${ownerAppbar('マッチング結果')}

      <div class="pad stack fade">
        ${body}
      </div>
    `;
  }


  /* ---------------- マッチング詳細 ---------------- */

  function showPetDetail(index) {

    const item =
      ownerMatchResults[index];


    if (!item) {

      ownerScreen.innerHTML =
        homeMarkup;

      return;
    }


    const sourceLabel =
      item.protectedSource === 'rescued'
        ? '保護団体で保護中の個体'
        : '発見者に保護されている個体';


    const photos =
      item.photoUrls &&
      item.photoUrls.length > 0
        ? item.photoUrls
        : [];


    const photoSwiperHtml =
      photos.length > 0

        ? photos.map((url) => `
            <img
              src="${url}"
              alt="ペット画像"
              style="
                width:100%;
                max-height:300px;
                object-fit:contain;
                border-radius:16px;
                background:#f5f5f5;
                scroll-snap-align:start
              "
            >
          `).join('')

        : `
          <div
            class="owner-pet-photo"
            style="background:${petSwatch(index)}"
          >
            🐕
          </div>
        `;


    ownerScreen.innerHTML = `
      ${ownerAppbar(
        '保護ペットの詳細',
        'results'
      )}

      <div class="pad stack fade">

        <div
          style="
            display:flex;
            gap:8px;
            overflow-x:auto;
            scroll-snap-type:x mandatory;
            padding-bottom:4px
          "
        >
          ${photoSwiperHtml}
        </div>


        <div class="owner-pet-title">

          <h2 class="title">
            ${sourceLabel}
            #${item.protectedPetId}
          </h2>

          <span class="pill mag">
            マッチ率
            ${Math.round(item.matchScore)}%
          </span>

        </div>


        <div class="card owner-info-card">

          <div>
            <span>
              AIの判定理由
            </span>

            <b>
              ${item.reason || '（コメントなし）'}
            </b>
          </div>

        </div>


        <div class="card">

          <div class="field">

            <label>
              連絡先電話番号
            </label>

            <input
              class="input"
              id="contactPhone"
              type="tel"
              placeholder="090-0000-0000"
            >

          </div>


          <div class="field">

            <label>
              メモ（任意）
            </label>

            <textarea
              class="input"
              id="contactNote"
              placeholder="伝えたいことがあれば入力してください"
            ></textarea>

          </div>


          <button
            class="btn btn-magenta"
            type="button"
            id="sendContactBtn"
            data-owner-action="send-contact"
            data-match-id="${item.matchId}"
          >
            この子について連絡する
          </button>

        </div>

      </div>
    `;
  }


  /* ---------------- 保護元へ連絡 ---------------- */

  async function sendContact(matchId) {

    const phoneInput =
      document.getElementById('contactPhone');

    const noteInput =
      document.getElementById('contactNote');


    const phone =
      phoneInput
        ? phoneInput.value.trim()
        : '';


    if (!phone) {

      alert(
        '連絡先電話番号を入力してください。'
      );

      return;
    }


    const btn =
      document.getElementById(
        'sendContactBtn'
      );


    const originalLabel =
      btn
        ? btn.textContent
        : '';


    if (btn) {

      btn.disabled = true;
      btn.textContent = '送信中…';

    }


    try {

      const res =
        await fetch(
          `${API_BASE}/contacts`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body: JSON.stringify({

              matchId,

              contactedByPhone:
                phone,

              note:
                (noteInput &&
                  noteInput.value.trim()) ||
                null

            })
          }
        );


      if (!res.ok) {

        const errBody =
          await res.json().catch(() => null);

        throw new Error(
          (errBody && errBody.message) ||
          `連絡の送信に失敗しました。(status ${res.status})`
        );
      }


      const data =
        await res.json();

      showContactDone(
        data.receptionNumber
      );

    } catch (error) {

      console.error(error);

      alert(
        error.message ||
        '連絡の送信中にエラーが発生しました。'
      );


      if (btn) {

        btn.disabled = false;
        btn.textContent =
          originalLabel;

      }
    }
  }


  /* ---------------- 連絡完了 ---------------- */

  function showContactDone(receptionNumber) {

    ownerScreen.innerHTML = `
      ${ownerAppbar('連絡完了')}

      <div class="pad stack fade">

        <div
          class="card"
          style="
            background:#f2f4ff;
            border-color:#d8ddfb
          "
        >

          <b style="color:var(--navy)">
            連絡を送信しました
          </b>

          <div class="lede">
            受付番号：
            <b>${receptionNumber}</b>
          </div>

          <div class="lede">
            この番号を控えて、
            担当者からの連絡をお待ちください。
          </div>

        </div>


        <button
          class="btn btn-magenta"
          type="button"
          data-owner-action="home"
        >
          ホームに戻る
        </button>

      </div>
    `;
  }


  /* ---------------- 画面イベント ---------------- */

  const urlParams =
    new URLSearchParams(
      window.location.search
    );


  if (
    document.body.dataset.page === 'owner-register' ||
    urlParams.get('action') === 'register'
  ) {
    showRegister();
  }


  ownerScreen.addEventListener(
    'click',
    (event) => {

      const action =
        event.target.closest(
          '[data-owner-action]'
        );


      if (action) {

        const name =
          action.dataset.ownerAction;


        // マッチング中の処理を停止
        if (ownerMatchTimer) {

          clearInterval(
            ownerMatchTimer
          );

          ownerMatchTimer = null;

          ownerMatchRequestToken++;

        }


        if (name === 'register') {
          showRegister();
        }


        if (
          name === 'submit-lost'
        ) {
          submitLost();
        }


        if (
          name === 'ai-fill'
        ) {
          aiAutoFillOwner();
        }


        if (
          name === 'pet-detail'
        ) {
          showPetDetail(
            Number(
              action.dataset.matchIndex
            )
          );
        }


        if (
          name === 'results'
        ) {
          showResults(
            ownerMatchResults
          );
        }

        if (name === 'notify') {
          window.location.href = 'notify.html';
        }

        if (name === 'notice-list') {
          window.location.href = 'notify.html';
        }

        if (
          name === 'send-contact'
        ) {
          sendContact(
            Number(
              action.dataset.matchId
            )
          );
        }


        if (
          name === 'home' &&
          ownerScreen.innerHTML !== homeMarkup
        ) {
          ownerScreen.innerHTML =
            homeMarkup;
        }


        return;
      }


      const swatch =
        event.target.closest(
          '.sw[data-owner-color]'
        );


      if (swatch) {

        pickOwnerColor(
          Number(
            swatch.dataset.ownerColor
          )
        );
      }

    }
  );
}


/* ---------------- 飼い主ページを初期化 ---------------- */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    const page =
      document.body.dataset.page;

    if (
      page === 'owner' ||
      page === 'owner-register'
    ) {
      initOwnerPage();
    }

  }
);