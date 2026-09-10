/* ---------------- ReLINK 認証・利用者選択処理 ---------------- */


/* ---------------- ログインページ ---------------- */

function initLoginPage() {
  const roleButtons = Array.from(document.querySelectorAll('.role'));
  const roleChip = document.getElementById('roleChip');
  const loginButton = document.getElementById('loginButton');
  const loginForm = document.getElementById('loginForm');

  let selectedUrl = null;

  const roleLabels = {
    owner: '飼い主',
    finder: '発見者',
    shelter: '保護団体'
  };

  function selectRole(button) {
    roleButtons.forEach((item) => item.classList.remove('on'));

    button.classList.add('on');

    selectedUrl = button.getAttribute('data-url');

    roleChip.textContent =
      `選択中：${roleLabels[button.getAttribute('data-role')]}`;
  }

  roleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectRole(button);
    });
  });


  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // 画面全体の勝手なリロードを防止

      if (!selectedUrl) {
        alert(
          '利用者の種類（飼い主・発見者・保護団体）を選択してください。'
        );
        return;
      }


      // 1. 入力値と選択ロールの取得

      const email = loginForm.email.value;
      const password = loginForm.password.value;

      const selectedRole =
        document
          .querySelector('.role.on')
          ?.getAttribute('data-role');


      // 2. ボタンを連打防止＆ローディング表示に変更

      loginButton.disabled = true;


      try {

        // 3. バックエンドAPI(/auth/login)呼び出し

        const result =
          await apiLogin(
            email,
            password,
            selectedRole
          );


        if (result.success) {

          // DBから返ってきたroleを使って遷移先を決定する

          const roleUrlMap = {
            owner: 'owner.html',
            finder: 'finder.html',
            shelter: 'shelter.html'
          };

          const destUrl =
            roleUrlMap[result.role] || selectedUrl;


          sessionStorage.setItem(
            'authToken',
            result.token
          );

          sessionStorage.setItem(
            'selectedRole',
            result.role
          );


          window.location.href = destUrl;
        }

      } catch (error) {

        alert(error.message);

      } finally {

        // 4. ボタンの状態を元に戻す

        loginButton.disabled = false;
      }
    });
  }
}


/* ---------------- ログインAPI ---------------- */

async function apiLogin(email, password, role) {

  if (!email || !password) {
    throw new Error(
      'メールアドレスとパスワードを入力してください。'
    );
  }


  const response = await fetch(
    `${API_BASE}/auth/login`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        email,
        password
      })
    }
  );


  if (response.status === 400) {
    throw new Error(
      'メールアドレスまたはパスワードが正しくありません。'
    );
  }


  if (!response.ok) {
    throw new Error(
      'ログインに失敗しました。バックエンド(relink-api)が起動しているか確認してください。'
    );
  }


  const data = await response.json();


  return {
    success: true,
    token: data.token,
    role: data.role
  };
}


/* ---------------- 新規登録API ---------------- */

// 新規登録API

async function apiRegister(
  email,
  password,
  role,
  displayName
) {

  const response = await fetch(
    `${API_BASE}/auth/register`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        email,
        password,
        role,
        displayName: displayName || null
      })
    }
  );


  if (response.status === 400) {

    const data =
      await response.json();

    throw new Error(
      data.message ||
      '登録に失敗しました。'
    );
  }


  if (!response.ok) {

    throw new Error(
      '登録に失敗しました。バックエンド(relink-api)が起動しているか確認してください。'
    );
  }


  const data =
    await response.json();


  return {
    success: true,
    token: data.token,
    role: data.role
  };
}


/* ---------------- 新規登録ページ ---------------- */

// 新規登録ページの初期化

function initSignupPage() {

  const roleButtons =
    Array.from(
      document.querySelectorAll('.role')
    );

  const signupButton =
    document.getElementById('signupButton');

  const signupForm =
    document.getElementById('signupForm');

  let selectedRole = null;


  roleButtons.forEach((button) => {

    button.addEventListener('click', () => {

      roleButtons.forEach((b) => {
        b.classList.remove('on');
      });

      button.classList.add('on');

      selectedRole =
        button.getAttribute('data-role');
    });
  });


  signupForm.addEventListener(
    'submit',
    async (e) => {

      e.preventDefault();


      if (!selectedRole) {

        alert(
          '利用者の種類を選択してください。'
        );

        return;
      }


      const email =
        signupForm.email.value;

      const password =
        signupForm.password.value;

      const displayName =
        signupForm.displayName.value;


      if (password.length < 6) {

        alert(
          'パスワードは6文字以上にしてください。'
        );

        return;
      }


      signupButton.disabled = true;

      signupButton.textContent =
        '登録中…';


      try {

        const result =
          await apiRegister(
            email,
            password,
            selectedRole,
            displayName
          );


        sessionStorage.setItem(
          'authToken',
          result.token
        );

        sessionStorage.setItem(
          'selectedRole',
          result.role
        );


        const urlMap = {
          owner: 'owner.html',
          finder: 'finder.html',
          shelter: 'shelter.html'
        };


        window.location.href =
          urlMap[result.role] ||
          'login.html';


      } catch (error) {

        alert(error.message);

        signupButton.disabled = false;

        signupButton.textContent =
          '登録する';
      }
    }
  );
}


/* ---------------- ログアウト ---------------- */

// ログアウト
//
// ログアウトするとログイン画面に戻る。
// 認証トークンと選択中のロールを削除する。

function logout() {

  sessionStorage.removeItem('authToken');

  sessionStorage.removeItem('selectedRole');

  window.location.href =
    'login.html';
}


/* ---------------- ロール切り替え ---------------- */

// ロール切り替え
//
// 「飼い主」「発見者」「保護団体」を変更する場合は、
// 現在選択されているロールをリセットしてログイン画面へ戻す。

function switchRole() {

  sessionStorage.removeItem(
    'selectedRole'
  );

  window.location.href =
    'login.html';
}


/* ---------------- ページ初期化 ---------------- */

// login.html / signup.html でだけ初期化する。
// 他のページでは何もしない。

document.addEventListener(
  'DOMContentLoaded',
  () => {

    const page =
      document.body?.dataset?.page;


    if (page === 'login') {
      initLoginPage();
    }


    if (page === 'signup') {
      initSignupPage();
    }
  }
);