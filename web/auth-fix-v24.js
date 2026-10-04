(() => {
  const AUTH_FIX_VERSION = 'v24-simple-login';

  function displayNameFromUsername(username) {
    const clean = normalizeUsername(username);
    if (!clean) return 'Cliente';
    return clean
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  function supabaseSafePassword(password, username) {
    const raw = String(password || '');
    if (raw.length >= 6) return raw;
    const clean = normalizeUsername(username) || 'cliente';
    return `TeffExclusivo#${clean}#${raw || '000'}`;
  }

  function authPayloadPassword(data) {
    return supabaseSafePassword(data.password, data.username);
  }

  renderLoginForm = function renderLoginFormV24() {
    return `
      <form class="form-grid" data-form="login">
        <div class="form-row">
          <label>Usuário</label>
          <input class="input" name="username" autocomplete="username" autocapitalize="none" required>
        </div>
        <div class="form-row">
          <label>Senha</label>
          <input class="input" name="password" type="password" autocomplete="current-password" required>
        </div>
        <button class="primary full" type="submit">Entrar</button>
      </form>
    `;
  };

  renderSignupForm = function renderSignupFormV24() {
    return `
      <form class="form-grid" data-form="signup">
        <div class="form-row">
          <label>Nome</label>
          <input class="input" name="full_name" autocomplete="name" required>
        </div>
        <div class="form-row">
          <label>WhatsApp</label>
          <input class="input" name="whatsapp" inputmode="tel" autocomplete="tel">
        </div>
        <div class="form-row">
          <label>Nome de usuário</label>
          <input class="input" name="username" autocomplete="username" autocapitalize="none" required>
        </div>
        <div class="form-row">
          <label>Senha</label>
          <input class="input" name="password" type="password" autocomplete="new-password" required>
        </div>
        <button class="primary full" type="submit">Criar conta</button>
      </form>
    `;
  };

  if (typeof renderAuth === 'function') {
    renderAuth = function renderAuthPreviewV24() {
      const isLogin = state.authMode === 'login';
      return `
        <section class="auth-page" data-preview="${AUTH_FIX_VERSION}">
          <div class="auth-art" aria-hidden="true"></div>
          <div class="auth-panel">
            <div>
              <div class="brand-mark">TEFF</div>
              <h1>Teff Exclusivo</h1>
              <p>Pedidos, entregas e pagamentos em uma loja online compartilhada.</p>
            </div>
            <div class="auth-tabs">
              <button class="tab-button ${isLogin ? 'active' : ''}" data-action="auth-mode" data-mode="login">Entrar</button>
              <button class="tab-button ${!isLogin ? 'active' : ''}" data-action="auth-mode" data-mode="signup">Criar conta</button>
            </div>
            ${isLogin ? renderLoginForm() : renderSignupForm()}
            <button class="secondary full" type="button" data-action="admin-login-shortcut">Painel administrativo</button>
          </div>
        </section>
      `;
    };
  }

  const previousHandleAction = handleAction;
  handleAction = async function handleActionV24(action, target) {
    if (action === 'admin-login-shortcut') {
      state.authMode = 'login';
      render();
      window.setTimeout(() => {
        const username = document.querySelector('input[name="username"]');
        const password = document.querySelector('input[name="password"]');
        if (username) username.value = 'admin';
        if (password) password.focus();
      }, 0);
      return;
    }
    return previousHandleAction(action, target);
  };

  login = async function loginV24(data) {
    const username = normalizeUsername(data.username);
    const email = await emailForLogin(data.username);
    const password = authPayloadPassword(data);
    let loginAttempt = await db.auth.signInWithPassword({ email, password });

    if (loginAttempt.error && password !== data.password) {
      loginAttempt = await db.auth.signInWithPassword({ email, password: data.password });
    }

    if (!loginAttempt.error) {
      showToast('Login realizado.');
      return;
    }

    if (!username || String(data.username || '').includes('@') || username === 'admin') {
      throw new Error('Usuário ou senha incorretos.');
    }

    const signupAttempt = await db.auth.signUp({
      email: usernameEmail(username),
      password,
      options: {
        data: {
          full_name: displayNameFromUsername(username),
          username,
          whatsapp: ''
        }
      }
    });

    if (signupAttempt.error) {
      throw new Error('Usuário ou senha incorretos.');
    }

    const secondLogin = await db.auth.signInWithPassword({ email: usernameEmail(username), password });
    if (secondLogin.error) {
      state.authMode = 'login';
      render();
      showToast('Conta criada. Tente entrar novamente com esse usuário e senha.');
      return;
    }

    showToast('Conta criada e login realizado.');
  };

  signup = async function signupV24(data) {
    const username = normalizeUsername(data.username);
    if (username.length < 3) throw new Error('Escolha um usuário com pelo menos 3 caracteres.');

    const email = usernameEmail(username);
    const password = authPayloadPassword({ ...data, username });
    const { error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: data.full_name,
          username,
          whatsapp: data.whatsapp
        }
      }
    });

    if (error) throw new Error('Não foi possível criar a conta. Verifique se o usuário já existe.');

    const loginAttempt = await db.auth.signInWithPassword({ email, password });
    if (loginAttempt.error) {
      state.authMode = 'login';
      render();
      showToast('Conta criada. Tente entrar com usuário e senha.');
      return;
    }

    showToast('Conta criada.');
  };
})();
