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
  let ownerMatchUncomparedCandidateCount = 0;

  // 飼い主の登録フォームの状態
  let ownerState = {
    photos: [],
    color: null,
    specie: '',
    otherSpecie: '',
    other: '',
    phone: '',
    lostPlace: '',
    nickname: '',     //新規追加：呼び名
    petName: '',      //新規追加：正式名称
    voiceBlob: null,  //新規追加：音声入力
    petStatus: 'lost', //新規追加：登録時の状態（safe=今は一緒にいる / lost=すでに迷子）
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

        <span class="role-chip">飼い主</span>
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
      lostPlace: '',
      petStatus: 'lost'
    };

    ownerScreen.innerHTML = `
      ${ownerAppbar('ペット情報を登録')}

      <div class="pad stack fade">

        <div class="hero-banner login-welcome">
          <div class="hi">STEP 1 / 撮影</div>
          <div class="hn">手持ちの写真をアップ</div>
          <div class="hs" style="color:#e91e8c;font-weight:600">角度を変えた写真（正面、横、斜めなど）を複数枚登録すると精度が上がります。</div>
        </div>

        <div class="register-grid">

          <!-- 左カラム：写真 -->
          <div class="register-photo">
            <input
              type="file"
              id="ownerFileInput"
              accept="image/*"
              multiple
              hidden
            >

            <div class="imgbox" data-owner-file>
              <div class="big"><i class="fa-solid fa-images"></i></div>

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
              data-owner-action="ai-fill"
            >
              写真からAIで自動入力（未入力の項目のみ）
            </button>

            <div
              class="footnote"
              style="padding:0 0 4px"
            >
              写真を追加した後に押すと、種類・毛色・そのほか欄のうち、
              まだ入力していない項目だけをAIが推定して埋めます。
              すでに入力した項目は変更しません。
            </div>
          </div>

          <!-- 右カラム：フォーム -->
          <div class="register-fields">

            <!-- 新規追加：登録時のペットの状態 -->
            <div class="field">
              <label>ペットの今の状態</label>

              <label style="display:flex;align-items:center;gap:10px;font-size:14px;font-weight:400;cursor:pointer;margin-bottom:8px">
                <input type="radio" name="ownerPetStatus" value="safe"
                       style="accent-color:#e91e8c;width:18px;height:18px;padding:0;margin:0;flex-shrink:0;">
                <span>今は一緒にいる（事前登録）</span>
              </label>

              <label style="display:flex;align-items:center;gap:10px;font-size:14px;font-weight:400;cursor:pointer;margin-bottom:0">
                <input type="radio" name="ownerPetStatus" value="lost" checked
                       style="accent-color:#e91e8c;width:18px;height:18px;padding:0;margin:0;flex-shrink:0;">
                <span>すでに迷子になっている</span>
              </label>
            </div>

            <div class="field">
              <label>連絡先電話番号</label>

              <input
                class="input"
                id="ownerPhone"
                type="tel"
                placeholder=""
              >
            </div>


            <div class="field" id="ownerLostPlaceField">
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
              <label>ペットの正式名称</label>

              <input
                class="input"
                id="ownerPetName"
                type="text"
                placeholder="例）こころ"
                maxlength="50"
              >
            </div>

            <!-- ペットの呼び名の登録 -->
            <div class="field">
              <label>ペットの普段の呼び方</label>

              <input
                class="input"
                id="ownerNickname"
                type="text"
                placeholder="例）ここちゃん"
                maxlength="30"
              >
            </div>

            <!-- 呼び名の音声を登録する欄 -->
            <div class="field">
              <label>ペットを呼んでいる音声</label>

              <div class="owner-voice-area">
                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  id="ownerVoiceRecordBtn"
                >
                  🎙 録音開始
                </button>

                <p id="ownerVoiceStatus">録音していません</p>

                <audio
                  id="ownerVoicePlayer"
                  controls
                  style="display: none;"
                ></audio>

                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  id="ownerVoiceReplayBtn"
                  style="display: none;"
                >
                  🔄 録り直す
                </button>
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
              登録
            </button>

            <div class="footnote">
              条件で絞り込んだ後、画像識別モデルが特徴を照合します。
            </div>

          </div>

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

    if (typeof initLocationAutocomplete === 'function') initLocationAutocomplete('ownerLostPlace');

    //新規追加：登録時の状態を保存。事前登録（無事）のときは紛失場所欄を隠す
    const lostPlaceField = document.getElementById('ownerLostPlaceField');

    document
      .querySelectorAll('input[name="ownerPetStatus"]')
      .forEach((radio) => {
        radio.addEventListener('change', () => {
          ownerState.petStatus = radio.value;

          if (lostPlaceField) {
            lostPlaceField.style.display =
              radio.value === 'safe' ? 'none' : '';
          }
        });
      });

    //新規追加：ペットの正式名称を保存
    const petNameInput = document.getElementById('ownerPetName');

    if (petNameInput) {
      petNameInput.addEventListener('input', () => {
        ownerState.petName = petNameInput.value.trim();
      });
    }

    //新規追加：呼び名の登録を保存
    const nicknameInput = document.getElementById('ownerNickname');

    if (nicknameInput) {
      nicknameInput.addEventListener('input', () => {
        ownerState.nickname = nicknameInput.value.trim();
      });
    }

    //新規追加：録音処理
    const voiceRecordBtn = document.getElementById('ownerVoiceRecordBtn');
    const voiceStatus = document.getElementById('ownerVoiceStatus');
    const voicePlayer = document.getElementById('ownerVoicePlayer');
    const voiceReplayBtn = document.getElementById('ownerVoiceReplayBtn');

    let mediaRecorder = null;
    let audioChunks = [];

    if (voiceRecordBtn) {
      voiceRecordBtn.addEventListener('click', async () => {
        // 録音開始
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: true
            });

            audioChunks = [];

            // クロスブラウザ対応：サポートされているMIMEタイプを自動選択
            const preferredMime = [
              'audio/mp4',
              'audio/webm;codecs=opus',
              'audio/webm',
              'audio/ogg;codecs=opus',
            ].find(t => MediaRecorder.isTypeSupported(t)) || '';
            mediaRecorder = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : {});

            mediaRecorder.addEventListener('dataavailable', (event) => {
              if (event.data.size > 0) {
                audioChunks.push(event.data);
              }
            });

            mediaRecorder.addEventListener('stop', () => {
              // 実際のMIMEタイプを使う（WebM/MP4どちらでも正しく保存）
              const actualMime = mediaRecorder.mimeType || 'audio/webm';
              ownerState.voiceBlob = new Blob(audioChunks, { type: actualMime });
              ownerState.voiceMime = actualMime;

              stream.getTracks().forEach(track => track.stop());

              // 録音した音声を再生できるようにする
              const audioUrl = URL.createObjectURL(ownerState.voiceBlob);
              voicePlayer.src = audioUrl;
              voicePlayer.style.display = 'block';

              // 録り直すボタンを表示
              voiceReplayBtn.style.display = 'block';
              
              voiceRecordBtn.style.display = 'none';
              voiceStatus.textContent = '録音完了';
            });

            mediaRecorder.start();

            voiceRecordBtn.textContent = '⏹ 録音停止';
            voiceStatus.textContent = '録音中...';

          } catch (error) {
            console.error('録音に失敗しました:', error);
            voiceStatus.textContent = 'マイクを使用できませんでした';
          }

        // 録音停止
        } else if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      });
    }

    if (voiceReplayBtn) {
      voiceReplayBtn.addEventListener('click', () => {
        ownerState.voiceBlob = null;

        voicePlayer.pause();
        voicePlayer.removeAttribute('src');
        voicePlayer.style.display = 'none';

        voiceReplayBtn.style.display = 'none';

        voiceStatus.textContent = '録音していません';
        voiceRecordBtn.style.display = 'block';
        voiceRecordBtn.textContent = '🎙 録音開始';
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
      >
        <button
          class="x"
          type="button"
          aria-label="写真を削除"
          data-owner-action="remove-photo"
          data-owner-photo-index="${index}"
        >×</button>
      </div>
    `).join('');

  }

  function removeOwnerPhoto(index) {
    const photo = ownerState.photos[index];

    if (!photo) return;

    URL.revokeObjectURL(photo.src);
    ownerState.photos.splice(index, 1);
    renderOwnerThumbs();
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


    // 紛失場所は「すでに迷子」で登録するときだけ必須
    if (ownerState.petStatus === 'lost' && !ownerState.lostPlace) {

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

      //新規追加：録音したペットの名前をsupabase strageに保存して保存先のURLを受け取る
      let voiceUrl = null;

      if (ownerState.voiceBlob) {
        const voiceFormData = new FormData();

        // MIMEタイプに応じたファイル拡張子を選択（WebM/MP4に対応）
        const voiceExt = (ownerState.voiceMime || '').includes('mp4') ? '.m4a' : '.webm';
        voiceFormData.append(
          'file',
          ownerState.voiceBlob,
          `pet-voice${voiceExt}`
        );

        const voiceRes = await fetch(
          `${API_BASE}/pets/voice`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: voiceFormData
          }
        );

        if (!voiceRes.ok) {
          throw new Error('音声のアップロードに失敗しました');
        }

        const voiceBody = await voiceRes.json();
        voiceUrl = voiceBody.voiceUrl;
      }

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
              ownerState.petStatus === 'lost'
                ? ownerState.lostPlace
                : null,

            //新規追加：登録時の状態
            petStatus:
              ownerState.petStatus,

            //新規追加：ペットの呼び名
            nickname: 
              ownerState.nickname || null,

            //新規追加：ペットの正式名称
            petName: ownerState.petName,
            
            //新規追加：音声入力
            voiceUrl: voiceUrl
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

      if (ownerState.petStatus === 'lost') {
        // 迷子として登録した場合は、そのままAIマッチングへ
        showMatching(lostBody.id);
      } else {
        // 事前登録（無事）の場合はマッチングせず、登録したペット一覧へ
        alert('ペットを登録しました。');
        window.location.href = 'owner-pet.html';
      }

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
          <svg class="paw-svg" viewBox="0 0 100 100">
            <defs>
              <!-- 肉球全体のシルエットマスク -->
              <mask id="paw-mask">
                <g transform="translate(3.8, 90) scale(0.018, -0.018)">
                  <path d="M1799 4626 c-124 -45 -260 -153 -360 -284 -199 -263 -298 -687 -230
                  -987 29 -128 67 -247 96 -305 56 -110 206 -235 330 -272 54 -17 95 -22 175
                  -21 93 0 116 4 195 33 118 42 168 72 237 143 126 128 169 279 172 602 1 234
                  -14 369 -64 555 -49 186 -87 278 -150 368 -57 81 -103 122 -179 158 -79 37
                  -141 40 -222 10z" fill="white"/>
                  <path d="M3085 4626 c-183 -58 -269 -174 -373 -501 -71 -224 -71 -225 -86
                  -370 -22 -204 0 -521 43 -635 68 -178 192 -281 411 -341 110 -30 256 -32 348
                  -5 120 36 273 159 326 263 58 115 108 353 107 507 -2 235 -79 512 -206 736
                  -100 177 -230 291 -389 339 -77 24 -123 25 -181 7z" fill="white"/>
                  <path d="M598 3326 c-95 -34 -187 -115 -261 -231 -59 -92 -92 -173 -122 -298
                  -71 -292 -73 -593 -4 -800 61 -183 158 -302 305 -373 145 -71 296 -89 439 -52
                  66 17 205 99 272 162 140 130 212 392 169 618 -44 235 -199 552 -381 782 -98
                  124 -166 172 -273 195 -67 14 -98 13 -144 -3z" fill="white"/>
                  <path d="M4290 3327 c-106 -25 -164 -66 -260 -187 -191 -240 -356 -583 -390
                  -815 -30 -200 31 -437 145 -563 56 -62 101 -94 210 -151 106 -55 217 -70 349
                  -48 112 20 236 78 307 144 218 202 285 590 183 1053 -47 211 -127 367 -244
                  473 -104 93 -188 120 -300 94z" fill="white"/>
                  <path d="M2379 2616 c-120 -36 -168 -64 -262 -155 -108 -104 -132 -137 -242
                  -326 -130 -224 -228 -366 -298 -432 -64 -60 -219 -181 -342 -268 -114 -81
                  -221 -189 -255 -259 -49 -100 -65 -177 -64 -311 0 -229 70 -368 242 -479 246
                  -159 527 -170 888 -35 170 64 229 71 511 67 269 -5 268 -5 479 -81 334 -122
                  624 -103 856 54 84 57 133 109 166 176 58 115 67 157 66 303 0 119 -3 145 -27
                  215 -32 96 -68 156 -133 219 -48 46 -74 66 -308 242 -184 138 -244 199 -339
                  342 -46 70 -114 181 -152 247 -93 165 -139 227 -238 322 -96 92 -147 121 -273
                  158 -106 31 -175 31 -275 1z" fill="white"/>
                </g>
              </mask>
            </defs>
            <g mask="url(#paw-mask)">
              <rect x="0" y="0" width="100" height="100" fill="var(--line)" />
              <!-- 下から上がってくるグラデーション（Fill） -->
              <rect id="paw-fill-rect" x="0" y="100" width="100" height="100" fill="url(#paw-grad)" />
            </g>
            <defs>
              <linearGradient id="paw-grad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stop-color="var(--magenta)" />
                <stop offset="100%" stop-color="var(--cyan)" />
              </linearGradient>
            </defs>
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
      progress = Math.min(95, progress + 5);

      const bar = document.getElementById('ownerBar');
      const pct = document.getElementById('ownerPct');
      const fillRect = document.getElementById('paw-fill-rect');

      if (bar) bar.style.width = `${progress}%`;
      if (pct) pct.textContent = `${progress}%`;

      // 肉球の下から上へ塗り上げる表示を同期させる
      if (fillRect) {
        const bottomY = 85; // 肉球の一番下の位置（SVG座標系に合わせた経験則値）
        const topY = 7;     // 肉球の一番上の位置
        const currentY = bottomY - (progress / 100) * (bottomY - topY);
        fillRect.setAttribute('y', currentY);
      }
    }, 200);

    fetch(
      `${API_BASE}/matching/run?lostPetId=${lostPetId}`,
      { method: 'POST' }
    )
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            (body && body.message) ||
            `マッチングに失敗しました。(status ${res.status})`
          );
        }

        return res.json();
      })
      .then((data) => {
        if (myToken !== ownerMatchRequestToken) return;

        if (ownerMatchTimer) {
          clearInterval(ownerMatchTimer);
          ownerMatchTimer = null;
        }

        ownerMatchResults = (data && data.results) || [];
        ownerMatchUncomparedCandidateCount =
          Number.isInteger(data && data.uncomparedCandidateCount)
            ? data.uncomparedCandidateCount
            : 0;

        const bar = document.getElementById('ownerBar');
        const pct = document.getElementById('ownerPct');
        const fillRect = document.getElementById('paw-fill-rect');
        if (bar) bar.style.width = '100%';
        if (pct) pct.textContent = '100%';
        if (fillRect) {
          // 最上部にセット
          const topY = 7;
          fillRect.setAttribute('y', topY);
        }

        ownerMatchTimer = setTimeout(() => {
          ownerMatchTimer = null;
          if (myToken === ownerMatchRequestToken) {
            showResults(ownerMatchResults, ownerMatchUncomparedCandidateCount);
          }
        }, 350);
      })
      .catch((error) => {
        if (myToken !== ownerMatchRequestToken) return;

        if (ownerMatchTimer) {
          clearInterval(ownerMatchTimer);
          ownerMatchTimer = null;
        }

        console.error(error);
        alert(error.message || 'マッチング処理中にエラーが発生しました。');
        ownerScreen.innerHTML = homeMarkup;
      });

  }


  /* ---------------- マッチング結果 ---------------- */

  function showResults(results, uncomparedCandidateCount = 0) {

    const list = results || [];

    /* ── 写真スタイル・コンテンツ ヘルパー ── */
    function photoStyle(item, index) {
      const url = item.photoUrls && item.photoUrls.length > 0
        ? item.photoUrls[0] : null;
      return url
        ? `background-image:url('${url}');background-size:cover;background-position:center`
        : `background:${petSwatch(index)}`;
    }
    function photoContent(item) {
      return (item.photoUrls && item.photoUrls.length > 0) ? '' : '🐕';
    }

    /* ── 0件 ── */
    if (list.length === 0) {
      const partialFailureNotice = uncomparedCandidateCount > 0
        ? `
          <div class="card" style="background:#fff4e5;border-color:#f0c36d">
            <b style="color:#7a4b00">マッチングを完了できませんでした</b>
            <div class="lede">
              ${uncomparedCandidateCount}件の候補は写真がない、または比較に失敗したため、
              結果に含まれていません。時間をおいて再度お試しください。
            </div>
          </div>
        `
        : '';
      ownerScreen.innerHTML = `
        ${ownerAppbar('マッチング結果')}
        <div class="pad fade">
          ${partialFailureNotice}
          ${uncomparedCandidateCount > 0 ? '' : `
          <div class="card" style="background:#f2f4ff;border-color:#d8ddfb">
            <b style="color:var(--navy)">候補が見つかりませんでした</b>
            <div class="lede">
              現在登録されている保護ペットの中には、<br>
              条件に近い子がいませんでした。<br>
              新しく保護情報が登録された際に改めてお知らせします。
            </div>
          </div>
          `}
        </div>
      `;
      return;
    }

    /* ── 1位 ── */
    const first = list[0];
    const topCard = `
      <div class="mr-top-card"
           data-owner-action="pet-detail"
           data-match-index="0">
        <div class="mr-top-photo" style="${photoStyle(first, 0)}">
          ${photoContent(first)}
        </div>
        <div class="mr-top-info">
          <div class="mr-top-score">マッチ率：${Math.round(first.matchScore)}%</div>
          <div class="mr-top-label">
            ${first.protectedSource === 'rescued' ? '保護団体で保護中の個体' : '発見された個体'}
          </div>
          ${first.specie   ? `<div class="mr-top-meta">犬種：${first.specie}</div>`          : ''}
          ${first.color    ? `<div class="mr-top-meta">毛色：${first.color}</div>`           : ''}
          ${first.foundPlace ? `<div class="mr-top-meta">地域：${first.foundPlace}</div>`   : ''}
          ${first.reason ? `<div class="mr-top-reason">${first.reason}</div>` : ''}
        </div>
      </div>
    `;

    /* ── 2位以下 グリッド ── */
    const rest = list.slice(1);
    const gridCards = rest.map((item, i) => {
      const index = i + 1;
      return `
        <div class="mr-grid-card"
             data-owner-action="pet-detail"
             data-match-index="${index}">
          <div class="mr-grid-photo" style="${photoStyle(item, index)}">
            ${photoContent(item)}
          </div>
          <div class="mr-grid-score">マッチ率：${Math.round(item.matchScore)}%</div>
        </div>
      `;
    }).join('');

    ownerScreen.innerHTML = `
      ${ownerAppbar('マッチング結果')}

      <div class="mr-page-bg fade">
        <div class="mr-main-card">

          ${uncomparedCandidateCount > 0 ? `
            <div class="card" style="background:#fff4e5;border-color:#f0c36d;margin-bottom:16px">
              <b style="color:#7a4b00">一部の候補を比較できませんでした</b>
              <div class="lede">
                ${uncomparedCandidateCount}件の候補は写真がない、または比較に失敗したため、
                以下の結果には含まれていません。
              </div>
            </div>
          ` : ''}

          <div class="mr-summary">
            <div class="mr-count">${list.length}件ヒットしました。</div>
            <div class="mr-desc">マッチ率が高い順に表示します。</div>
          </div>

          ${topCard}

          ${rest.length > 0 ? `<div class="mr-grid">${gridCards}</div>` : ''}

          <div style="text-align:center;margin-top:24px">
            // ★修正：localhost固定だとスマホから開けないので、相対パスに変更
            // (今開いているホストのまま owner.html に移動する)
            <button class="btn btn-ghost" onclick="location.href='owner.html'">TOPへ戻る</button>// ★修正：localhost固定だとスマホから開けないので、相対パスに変更
            // (今開いているホストのまま owner.html に移動する)
            <button class="btn btn-ghost" onclick="location.href='owner.html'">TOPへ戻る</button>
          </div>

        </div>
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


        <button
          class="btn btn-magenta"
          type="button"
          id="openChatBtn"
          data-owner-action="open-chat"
          data-match-id="${item.matchId}"
          data-protected-source="${item.protectedSource}"
        >
          💬 ${item.protectedSource === 'rescued' ? '保護団体' : '発見者'}にチャットで連絡する
        </button>

      </div>
    `;
  }


  /* ---------------- チャットで保護元へ連絡 ---------------- */

  async function openChatWithProtector(matchId, protectedSource) {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      alert('ログインが必要です。');
      return;
    }

    const btn = document.getElementById('openChatBtn');
    if (btn) { btn.disabled = true; btn.textContent = '読み込み中…'; }

    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/detail`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`詳細取得失敗 (status ${res.status})`);

      const d = await res.json();
      const isShelter = (d.protectedSource || protectedSource) === 'rescued';
      const contactId = d.contact && d.contact.userId;

      sessionStorage.setItem('chatTargetName', (d.contact && d.contact.displayName) || (isShelter ? '保護団体' : '発見者'));
      sessionStorage.setItem('chatTargetRole', isShelter ? 'shelter' : 'finder');

      if (contactId) {
        window.location.href = 'notify.html?sec=chat&contactId=' + contactId;
      } else {
        window.location.href = 'notify.html?sec=chat';
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'チャットの開始に失敗しました。');
      if (btn) { btn.disabled = false; btn.textContent = '💬 チャットで連絡する'; }
    }
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

  // 新規追加：登録したペット一覧の「迷子になりました」から来たときは、そのままAIマッチングへ
  if (urlParams.get('action') === 'match') {

    const lostPetId =
      Number(urlParams.get('lostPetId'));

    // 再読み込みでマッチングが再実行されないよう、URLからパラメータを消す
    history.replaceState(null, '', window.location.pathname);

    if (lostPetId) {
      showMatching(lostPetId);
    }
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

        if (name === 'remove-photo') {
          removeOwnerPhoto(
            Number(action.dataset.ownerPhotoIndex)
          );
          return;
        }

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
            ownerMatchResults,
            ownerMatchUncomparedCandidateCount
          );
        }

        if (name === 'notify') {
          window.location.href = 'notify.html';
        }

        if (name === 'notice-list') {
          window.location.href = 'notify.html';
        }

        if (
          name === 'open-chat'
        ) {
          openChatWithProtector(
            Number(action.dataset.matchId),
            action.dataset.protectedSource
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

/* ---------------- 登録ペット情報（無限スクロール＋段階的表示）---------------- */

async function initOwnerPetsPage() {
  const list = document.getElementById('owner-pet-list');
  if (!list) return;

  const token = sessionStorage.getItem('authToken');
  if (!token) {
    list.innerHTML = `<div class="card" style="grid-column:1/-1"><div class="lede">ログイン情報がありません。</div></div>`;
    return;
  }

  const PAGE_SIZE = 12;   // 1回あたりの取得件数
  let cursor   = null;    // 次ページのcursor（APIから受け取る）
  let loading  = false;   // 二重リクエスト防止フラグ
  let hasMore  = true;    // まだ取得できるデータがあるか
  let sentinel = null;    // IntersectionObserver の監視対象要素
  let observer = null;    // IntersectionObserver インスタンス

  /* ── 初期プレースホルダーをクリア ── */
  list.innerHTML = '';

  /* ── スケルトンカード（読み込み中表示）── */
  function showSkeletons(count) {
    removeSentinel();
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'card owner-pet-card owner-pet-skeleton';
      el.innerHTML = `
        <div class="owner-pet-photo skel-box"></div>
        <div class="owner-pet-info">
          <div class="skel-line skel-line-lg"></div>
          <div class="skel-line skel-line-sm"></div>
          <div class="skel-line skel-line-sm"></div>
        </div>
      `;
      list.appendChild(el);
    }
  }

  function removeSkeletons() {
    list.querySelectorAll('.owner-pet-skeleton').forEach(el => el.remove());
  }

  /* ── センチネル要素（無限スクロールのトリガー）── */
  function removeSentinel() {
    if (observer) { observer.disconnect(); observer = null; }
    if (sentinel) { sentinel.remove(); sentinel = null; }
  }

  function addSentinel() {
    removeSentinel();
    sentinel = document.createElement('div');
    sentinel.className = 'pet-sentinel';
    list.appendChild(sentinel);

    observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '300px' });
    observer.observe(sentinel);
  }

  /* ── ペットデータキャッシュ（詳細表示用）── */
  const petCache = {};

  /* ── ペットの状態バッジ（safe=無事 / lost=迷子）── */
  function petStatusBadge(petStatus) {
    return petStatus === 'safe'
      ? `<span class="pill pet-status-badge" style="background:#e8f5e9;color:#2e7d32">無事</span>`
      : `<span class="pill mag pet-status-badge">迷子</span>`;
  }

  /* ── ペットカードを追加 ── */
  function renderPets(pets) {
    pets.forEach(pet => {
      petCache[pet.id] = pet; // 一覧データをキャッシュ
      const card = document.createElement('div');
      card.className = 'card owner-pet-card';
      card.style.cssText = 'cursor:pointer;position:relative;';
      card.setAttribute('data-pet-id', pet.id);
      if (pet.receivedFrom) {
        card.setAttribute('data-received', '1');
      }
      card.innerHTML = `
        <div class="owner-pet-photo">
          ${pet.photoUrl
            ? `<img src="${pet.photoUrl}" alt="${pet.specie || 'ペット'}" loading="lazy">`
            : `<div class="owner-pet-no-photo">写真なし</div>`
          }
        </div>
        <div class="owner-pet-info">
          <div>${petStatusBadge(pet.petStatus)}</div>
          <div class="t">${pet.specie || '種類未登録'}</div>
          <div class="d">毛色：${pet.color || '未登録'}</div>
          ${pet.petStatus === 'safe' ? '' : `<div class="d">いなくなった場所：${pet.lostPlace || '未登録'}</div>`}
          ${pet.receivedFrom ? `<div class="d" style="color:#2e7d32;font-weight:600">✅ 受け取り済み：${pet.receivedFrom}</div>` : ''}
        </div>
        <div style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:#bbb;font-size:18px;">›</div>
      `;
      card.addEventListener('click', () => openOwnerPetDetail(pet.id));
      list.appendChild(card);
    });
  }

  /* ── ペット詳細オーバーレイを開く ── */
  async function openOwnerPetDetail(petId) {
    const overlay = document.getElementById('ownerPetDetailOverlay');
    const body    = document.getElementById('ownerPetDetailBody');
    if (!overlay || !body) return;

    body.innerHTML = '<div style="text-align:center;padding:32px;color:#888">読み込み中…</div>';
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    try {
      const res = await fetch(`${API_BASE}/pets/lost/${petId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const pet = await res.json();

      const photosHtml = pet.photoUrls && pet.photoUrls.length > 0
        ? `<div style="display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:4px">
            ${pet.photoUrls.map(url => `
              <img src="${url}" alt="ペット"
                style="width:100%;max-height:220px;object-fit:contain;border-radius:12px;
                       background:#f5f5f5;scroll-snap-align:start;flex-shrink:0;">
            `).join('')}
           </div>`
        : `<div style="height:160px;background:#f5f5f5;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:48px;">🐾</div>`;

      // 無事（飼い主のもとにいる）か、迷子か
      const isSafe = pet.petStatus === 'safe';

      body.innerHTML = `
        ${photosHtml}

        <div>${petStatusBadge(pet.petStatus)}</div>

        <div class="card" style="margin:0">
          ${pet.petName  ? `<div><span style="color:#888;font-size:12px">正式名称</span><br><b>${pet.petName}</b></div>` : ''}
          ${pet.nickname ? `<div><span style="color:#888;font-size:12px">呼び名</span><br><b>${pet.nickname}</b></div>` : ''}
          ${pet.specie   ? `<div><span style="color:#888;font-size:12px">種類</span><br>${pet.specie}</div>` : ''}
          ${pet.color    ? `<div><span style="color:#888;font-size:12px">毛色</span><br>${pet.color}</div>` : ''}
          ${!isSafe && pet.lostPlace ? `<div><span style="color:#888;font-size:12px">いなくなった場所</span><br>${pet.lostPlace}</div>` : ''}
          ${pet.other    ? `<div><span style="color:#888;font-size:12px">その他の特徴</span><br>${pet.other}</div>` : ''}
        </div>

        ${isSafe
          ? `<div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:12px;padding:14px;text-align:center">
               <div style="font-size:22px;margin-bottom:4px">✅</div>
               <b style="color:#2e7d32">無事（飼い主のもとにいます）</b>
               ${pet.receivedFrom ? `<div style="color:#388e3c;font-size:13px;margin-top:4px">受け取り元：${pet.receivedFrom}</div>` : ''}
             </div>
             <div id="reportLostSection">
               <p style="font-size:13px;color:#555;margin:0 0 8px;">ペットがいなくなってしまったら、<br>
                 いなくなった場所を選んで届け出てください。
               </p>
               <input
                 class="input"
                 id="reportLostPlace"
                 type="text"
               >
               <button
                 id="reportLostBtn"
                 class="btn btn-magenta"
                 style="margin-top:12px;width:100%;"
                 onclick="handleReportLost(${petId})"
               >
                 🚨 迷子になりました
               </button>
             </div>`
          : `<div id="receiveSection">
               <p style="font-size:13px;color:#555;margin:0 0 8px;">誰から受け取りましたか？<br>
                 <span style="font-size:11px;color:#888;">チャットしたことのある相手を選んでください。</span>
               </p>
               <div id="contactSelectList" style="display:flex;flex-direction:column;gap:8px;">
                 <div style="text-align:center;color:#aaa;font-size:13px;padding:12px;">読み込み中…</div>
               </div>
               <button
                 id="receiveBtn"
                 class="btn btn-magenta"
                 style="margin-top:12px;width:100%;opacity:0.4;pointer-events:none;"
                 onclick="handleReceivePet(${petId})"
                 disabled
               >
                 🐾 ペットを受け取りました
               </button>
             </div>`
        }
      `;

      // グローバルに関数を公開（onclickから呼べるように）
      window.handleReceivePet = (id) => receivePet(id);
      window.handleReportLost = (id) => reportLost(id);

      if (isSafe) {
        if (typeof initLocationAutocomplete === 'function') initLocationAutocomplete('reportLostPlace');
      } else {
        // 迷子の場合、チャット済みコンタクト一覧を読み込む
        loadChatContactsForSelect(petId);
      }

    } catch (err) {
      console.error(err);
      body.innerHTML = `<div style="text-align:center;color:#c00;padding:16px">読み込みに失敗しました</div>`;
    }
  }

  /* ── チャット済みコンタクトを選択リストに描画 ── */
  async function loadChatContactsForSelect(petId) {
    const listEl = document.getElementById('contactSelectList');
    if (!listEl) return;

    try {
      const res = await fetch(`${API_BASE}/chat/contacts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      const contacts = data.contacts || [];

      if (contacts.length === 0) {
        listEl.innerHTML = `
          <div style="background:#f5f5f5;border-radius:10px;padding:14px;text-align:center;color:#888;font-size:13px;">
            まだチャットした相手がいません。<br>
            先にチャットで連絡を取ってから記録してください。
          </div>`;
        return;
      }

      const roleLabel = r =>
        r === 'shelter' ? '保護団体' :
        r === 'finder'  ? '発見者'  : r;

      listEl.innerHTML = contacts.map(c => `
        <label style="display:flex;align-items:center;gap:12px;padding:10px 14px;
                       border:2px solid #eee;border-radius:12px;cursor:pointer;"
               class="contact-select-label">
          <input type="radio" name="receiveContact"
                 value="${c.id}"
                 data-name="${c.displayName}"
                 data-role="${c.role}"
                 style="accent-color:#e91e8c;width:18px;height:18px;flex-shrink:0;">
          <div>
            <div style="font-weight:600;font-size:14px;">${c.displayName}</div>
            <div style="font-size:12px;color:#888;">${roleLabel(c.role)}</div>
          </div>
        </label>
      `).join('');

      // ラジオを選んだらボタンを有効化
      listEl.querySelectorAll('input[type=radio]').forEach(radio => {
        radio.addEventListener('change', () => {
          const btn = document.getElementById('receiveBtn');
          if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
          }
          // 選択中のラベルをハイライト
          listEl.querySelectorAll('.contact-select-label').forEach(lbl => {
            lbl.style.borderColor = lbl.querySelector('input').checked ? '#e91e8c' : '#eee';
            lbl.style.background  = lbl.querySelector('input').checked ? '#fff0f6' : '';
          });
        });
      });

    } catch (err) {
      console.error(err);
      listEl.innerHTML = `<div style="color:#c00;font-size:13px;">コンタクト一覧の読み込みに失敗しました。</div>`;
    }
  }

  /* ── 「ペットを受け取りました」を記録 ── */
  async function receivePet(petId) {
    const btn = document.getElementById('receiveBtn');

    // 選択されたコンタクトを取得
    const selected = document.querySelector('input[name="receiveContact"]:checked');
    if (!selected) {
      alert('受け取り相手を選択してください。');
      return;
    }
    const roleLabel = r =>
      r === 'shelter' ? '保護団体' :
      r === 'finder'  ? '発見者'  : r;
    const contactName = selected.dataset.name;
    const contactRole = roleLabel(selected.dataset.role);
    const receivedFrom = `${contactName}（${contactRole}）`;

    if (btn) { btn.disabled = true; btn.textContent = '記録中…'; }

    try {
      const res = await fetch(`${API_BASE}/pets/lost/${petId}/received`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ receivedFrom })
      });
      if (!res.ok) throw new Error(`status ${res.status}`);

      // 成功：オーバーレイを閉じてリストを更新
      closeOwnerPetDetail();
      // キャッシュを更新
      if (petCache[petId]) {
        petCache[petId].receivedFrom = receivedFrom;
        petCache[petId].petStatus = 'safe';
      }
      // カードの表示を更新
      const cards = list.querySelectorAll('.owner-pet-card');
      cards.forEach(card => {
        if (card.getAttribute('data-pet-id') === String(petId)) {
          // 受け取ったので状態バッジを「無事」にする
          const badge = card.querySelector('.pet-status-badge');
          if (badge) badge.outerHTML = petStatusBadge('safe');
          const info = card.querySelector('.owner-pet-info');
          if (info && !info.querySelector('.received-label')) {
            const lbl = document.createElement('div');
            lbl.className = 'd received-label';
            lbl.style.cssText = 'color:#2e7d32;font-weight:600';
            lbl.textContent = `✅ 受け取り済み（${receivedFrom}）`;
            info.appendChild(lbl);
          }
        }
      });
      alert(`受け取り情報を記録しました。`);
    } catch (err) {
      console.error(err);
      alert('記録に失敗しました。もう一度お試しください。');
      if (btn) { btn.disabled = false; btn.textContent = '🐾 ペットを受け取りました'; }
    }
  }

  /* ── 「迷子になりました」を届け出て、AIマッチングへ ── */
  async function reportLost(petId) {
    const btn = document.getElementById('reportLostBtn');
    const placeInput = document.getElementById('reportLostPlace');
    const lostPlace = placeInput ? placeInput.value.trim() : '';

    if (!lostPlace) {
      alert('いなくなった場所を入力してください。');
      return;
    }
    if (!confirm('このペットを「迷子」として届け出ます。よろしいですか？')) return;

    if (btn) { btn.disabled = true; btn.textContent = '届け出中…'; }

    try {
      const res = await fetch(`${API_BASE}/pets/lost/${petId}/lost`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ lostPlace })
      });
      if (!res.ok) throw new Error(`status ${res.status}`);

      // 成功：飼い主ホームのAIマッチング画面へ
      window.location.href = `owner.html?action=match&lostPetId=${petId}`;
    } catch (err) {
      console.error(err);
      alert('届け出に失敗しました。もう一度お試しください。');
      if (btn) { btn.disabled = false; btn.textContent = '🚨 迷子になりました'; }
    }
  }

  /* ── 詳細オーバーレイを閉じる ── */
  function closeOwnerPetDetail() {
    const overlay = document.getElementById('ownerPetDetailOverlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  // グローバルに公開
  window.closeOwnerPetDetail = closeOwnerPetDetail;

  /* ── エラー表示（既存カードは消さない）── */
  function showError() {
    list.querySelectorAll('.owner-pet-error').forEach(el => el.remove());
    const errEl = document.createElement('div');
    errEl.className = 'card owner-pet-error';
    errEl.style.cssText = 'grid-column:1/-1;text-align:center;padding:20px;';
    errEl.innerHTML = `
      <div class="lede">ペット情報の読み込みに失敗しました。</div>
      <button class="btn btn-ghost" style="margin-top:12px;max-width:200px" id="petRetryBtn">再読み込み</button>
    `;
    list.appendChild(errEl);
    document.getElementById('petRetryBtn')?.addEventListener('click', () => {
      errEl.remove();
      loadMore();
    });
  }

  /* ── 次のページを取得して表示 ── */
  async function loadMore() {
    if (loading || !hasMore) return;
    loading = true;

    list.querySelectorAll('.owner-pet-error').forEach(el => el.remove());
    showSkeletons(3);

    try {
      let url = `${API_BASE}/pets/lost?limit=${PAGE_SIZE}`;
      if (cursor) url += `&cursor=${cursor}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`status ${res.status}`);

      const data = await res.json();
      removeSkeletons();

      const pets = data.pets || [];

      /* 初回取得でペットが0件 */
      if (pets.length === 0 && cursor === null) {
        list.innerHTML = `<div class="card" style="grid-column:1/-1"><div class="lede">登録したペットはいません。</div></div>`;
        hasMore = false;
        return;
      }

      /* 取得できたカードをすぐに追加表示 */
      renderPets(pets);

      /* 次ページの準備 */
      cursor  = data.nextCursor ?? null;
      hasMore = cursor !== null;

      if (hasMore) {
        addSentinel();   // 次のスクロールをIntersectionObserverで監視
      }

    } catch (err) {
      console.error(err);
      removeSkeletons();
      showError();
    } finally {
      loading = false;
    }
  }

  /* ── 初回読み込み開始 ── */
  loadMore();
}


/* ---------------- 飼い主ページを初期化 ---------------- */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    const page =
      document.body.dataset.page;

    if (page === 'owner' ||page === 'owner-register') {
      initOwnerPage();
    }

    //★新規追加：initOwnerPetsPage() を実行
    if (page === 'owner-pets') {
      initOwnerPetsPage();
    }

  }
);