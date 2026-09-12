/* ---------------- rescue register ---------------- */
(() => {
  // このJSは register.html 専用
  const fileInput = document.getElementById('fileInput');
  const addPhotoBox = document.getElementById('addPhotoBox');

  // register.html 以外では何もしない
  if (!fileInput || !addPhotoBox) return;

  const thumbs = document.getElementById('thumbs');
  const aiFillBtn = document.getElementById('aiFillBtn');
  const submitBtn = document.getElementById('submitBtn');
  const specieSelect = document.getElementById('specieSelect');
  const otherText = document.getElementById('otherText');

  let photos = [];
  let selectedColors = [];

  addPhotoBox.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (event) => {
    const files = Array.from(event.target.files || []);

    if (photos.length + files.length > MAX_PHOTOS_PER_PET) {
      alert(`写真は${MAX_PHOTOS_PER_PET}枚までしか登録できません(現在${photos.length}枚)。`);
      event.target.value = '';
      return;
    }

    files.forEach((file) => {
      const reader = new FileReader();

      reader.onload = (loadEvent) => {
        photos.push({
          file,
          dataUrl: loadEvent.target.result
        });

        renderThumbs();
      };

      reader.readAsDataURL(file);
    });

    event.target.value = '';
  });

  function renderThumbs() {
    thumbs.innerHTML = photos.map((p, i) => `
      <div
        class="thumb"
        style="background-image:url('${p.dataUrl}');background-size:cover;background-position:center"
        onclick="event.stopPropagation()"
      >
        <div
          class="x"
          onclick="event.stopPropagation();removePhoto(${i})"
        >×</div>
      </div>
    `).join('');
  }

  function removePhoto(index) {
    photos.splice(index, 1);
    renderThumbs();
  }

  window.removePhoto = removePhoto;


  /* ---------------- color ---------------- */

  document.getElementById('swatches').addEventListener('click', (event) => {
    const sw = event.target.closest('.sw');

    if (!sw) return;

    const index = Number(sw.dataset.colorIndex);

    if (selectedColors.includes(index)) {
      selectedColors = selectedColors.filter((i) => i !== index);
    } else {
      selectedColors.push(index);
    }

    sw.classList.toggle(
      'on',
      selectedColors.includes(index)
    );
  });


  function pickColor(index) {
    if (!selectedColors.includes(index)) {
      selectedColors.push(index);

      document
        .querySelector(`#swatches .sw[data-color-index="${index}"]`)
        ?.classList.add('on');
    }
  }


  /* ---------------- AI auto fill ---------------- */

  aiFillBtn.addEventListener('click', async () => {
    if (photos.length === 0) {
      alert('先に写真を1枚以上追加してください。');
      return;
    }

    const token = sessionStorage.getItem('authToken');

    if (!token) {
      alert('ログインが必要です。ログイン画面からやり直してください。');
      window.location.href = 'login.html';
      return;
    }

    const originalLabel = aiFillBtn.textContent;

    aiFillBtn.disabled = true;
    aiFillBtn.textContent = 'AI解析中…';

    try {
      const form = new FormData();

      photos.forEach((p) => {
        form.append('photo', p.file);
      });

      const res = await fetch(
        `${API_BASE}/pets/extract-features`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: form
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);

        throw new Error(
          (body && body.message) ||
          ('AI解析に失敗しました。(status ' + res.status + ')')
        );
      }

      const tags = await res.json();

      // 種類・犬種
      if (!specieSelect.value) {
        const guess = guessSpecieOption(
          tags.animalType,
          tags.breed
        );

        if (guess) {
          specieSelect.value = guess;
        } else if (
          tags.breed &&
          !document.getElementById('otherSpecie').value
        ) {
          document.getElementById('otherSpecie').value =
            [tags.animalType, tags.breed]
              .filter(Boolean)
              .join(' ');
        }
      }

      // 毛色
      if (
        selectedColors.length === 0 &&
        tags.coatColor
      ) {
        const idx = colorKeywordIndex(tags.coatColor);

        if (idx !== -1) {
          pickColor(idx);
        }
      }

      // 首輪情報
      if (tags.hasCollar) {
        const note =
          `首輪あり${
            tags.collarFeatures
              ? '（' + tags.collarFeatures + '）'
              : ''
          }`;

        if (!otherText.value) {
          otherText.value = note;
        }
      }

    } catch (err) {
      console.error(err);

      if (
        err.message &&
        err.message.includes('ログイン')
      ) {
        alert(err.message);
        window.location.href = 'login.html';
        return;
      }

      alert(
        err.message ||
        'AI解析中にエラーが発生しました。手動で入力してください。'
      );

    } finally {
      aiFillBtn.disabled = false;
      aiFillBtn.textContent = originalLabel;
    }
  });


  /* ---------------- photo upload ---------------- */

  async function uploadRescuePhotos(files, token) {
    const photoUrls = [];

    for (const file of files) {
      const form = new FormData();

      form.append('photo', file);

      const uploadRes = await fetch(
        `${API_BASE}/pets/photos`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: form
        }
      );

      if (!uploadRes.ok) {
        throw new Error(
          '写真のアップロードに失敗しました。(status ' +
          uploadRes.status +
          ')'
        );
      }

      const { photoUrl } = await uploadRes.json();

      photoUrls.push(photoUrl);
    }

    return photoUrls;
  }


  /* ---------------- rescue registration ---------------- */

  submitBtn.addEventListener('click', async () => {
    const token = sessionStorage.getItem('authToken');

    if (!token) {
      alert('ログインが必要です。ログイン画面からやり直してください。');
      window.location.href = 'login.html';
      return;
    }

    if (photos.length === 0) {
      alert('写真を1枚以上追加してください。');
      return;
    }

    const foundPlace =
      document.getElementById('foundPlace').value.trim();

    if (!foundPlace) {
      alert('発見場所を入力してください。');
      return;
    }

    const foundDate =
      document.getElementById('foundDate').value;

    if (!foundDate) {
      alert('発見日時を入力してください。');
      return;
    }

    const otherSpecieValue =
      document.getElementById('otherSpecie').value.trim();

    if (!specieSelect.value && !otherSpecieValue) {
      alert(
        '種類・犬種を選択するか、上記にない犬種・品種欄に入力してください。'
      );
      return;
    }

    if (selectedColors.length === 0) {
      alert('毛色を選択してください。');
      return;
    }

    const originalLabel = submitBtn.textContent;

    submitBtn.disabled = true;
    submitBtn.textContent = '登録中…';

    try {
      const photoUrls = await uploadRescuePhotos(
        photos.map((p) => p.file),
        token
      );

      // 保護場所・保護日時は現在のAPI項目にないため、
      // 「そのほか」に追記して保存する
      const rescuePlace =
        document.getElementById('rescuePlace').value.trim();

      const rescueDate =
        document.getElementById('rescueDate').value;

      const extraNotes = [];

      if (rescuePlace) {
        extraNotes.push(`保護場所: ${rescuePlace}`);
      }

      if (rescueDate) {
        extraNotes.push(`保護日時: ${rescueDate}`);
      }

      const otherValue =
        [
          otherText.value.trim(),
          ...extraNotes
        ]
          .filter(Boolean)
          .join(' / ') || null;

      const res = await fetch(
        `${API_BASE}/pets/rescued`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            photoUrls,
            foundPlace,
            foundDate,
            specie:
              specieSelect.value ||
              otherSpecieValue,
            color:
              selectedColors
                .map((i) => colorNames[i])
                .join('・'),
            other: otherValue
          })
        }
      );

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error(
            'この操作には保護団体(shelter)権限が必要です。ログインし直してください。'
          );
        }

        const body =
          await res.json().catch(() => null);

        throw new Error(
          (body && body.message) ||
          ('登録に失敗しました。(status ' +
            res.status +
            ')')
        );
      }

      alert('登録が完了しました。');

      window.location.href = 'shelter.html';

    } catch (err) {
      console.error(err);

      alert(
        err.message ||
        '登録中にエラーが発生しました。'
      );

    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });

})();