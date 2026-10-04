(() => {
  const PREVIEW_LABEL = 'preview-v25-login-direto';

  async function clearOldPreviewCache() {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch (_error) {
      // Preview cleanup is best effort only.
    }
  }

  function prettyName(username) {
    const clean = normalizeUsername(username);
    if (!clean) return 'Cliente';
    return clean
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  function passwordForAuth(username, password) {
    const raw = String(password || '');
    const clean = normalizeUsername(username);
    if (String(username || '').includes('@') || clean === 'admin' || raw.length >= 6) return raw;
    return `TeffExclusivo#${clean || 'cliente'}#${raw || '000'}`;
  }

  clearOldPreviewCache();

  renderLoginForm = function renderLoginFormV25() {
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

  renderSignupForm = function renderSignupFormV25() {
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

  renderAuth = function renderAuthPreviewV25() {
    const isLogin = state.authMode === 'login';
    return `
      <section class="auth-page" data-preview="${PREVIEW_LABEL}">
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

  const baseHandleAction = handleAction;
  handleAction = async function handleActionV25(action, target) {
    if (action === 'admin-login-shortcut') {
      state.authMode = 'login';
      render();
      window.setTimeout(() => {
        const usernameInput = document.querySelector('input[name="username"]');
        const passwordInput = document.querySelector('input[name="password"]');
        if (usernameInput) usernameInput.value = 'admin';
        if (passwordInput) passwordInput.focus();
      }, 0);
      return;
    }
    return baseHandleAction(action, target);
  };

  login = async function loginV25(data) {
    const username = normalizeUsername(data.username);
    const email = await emailForLogin(data.username);
    const safePassword = passwordForAuth(data.username, data.password);
    let attempt = await db.auth.signInWithPassword({ email, password: safePassword });

    if (attempt.error && safePassword !== data.password) {
      attempt = await db.auth.signInWithPassword({ email, password: data.password });
    }

    if (!attempt.error) {
      showToast('Login realizado.');
      return;
    }

    if (!username || String(data.username || '').includes('@') || username === 'admin') {
      throw new Error('Usuário ou senha incorretos.');
    }

    const signupAttempt = await db.auth.signUp({
      email: usernameEmail(username),
      password: safePassword,
      options: {
        data: {
          full_name: prettyName(username),
          username,
          whatsapp: ''
        }
      }
    });

    if (signupAttempt.error) {
      throw new Error('Usuário ou senha incorretos.');
    }

    const secondAttempt = await db.auth.signInWithPassword({ email: usernameEmail(username), password: safePassword });
    if (secondAttempt.error) {
      state.authMode = 'login';
      render();
      showToast('Conta criada. Tente entrar novamente com esse usuário e senha.');
      return;
    }

    showToast('Conta criada e login realizado.');
  };

  signup = async function signupV25(data) {
    const username = normalizeUsername(data.username);
    if (username.length < 3) throw new Error('Escolha um usuário com pelo menos 3 caracteres.');

    const email = usernameEmail(username);
    const safePassword = passwordForAuth(username, data.password);
    const { error } = await db.auth.signUp({
      email,
      password: safePassword,
      options: {
        data: {
          full_name: data.full_name,
          username,
          whatsapp: data.whatsapp
        }
      }
    });

    if (error) throw new Error('Não foi possível criar a conta. Verifique se o usuário já existe.');

    const loginAttempt = await db.auth.signInWithPassword({ email, password: safePassword });
    if (loginAttempt.error) {
      state.authMode = 'login';
      render();
      showToast('Conta criada. Tente entrar com usuário e senha.');
      return;
    }

    showToast('Conta criada.');
  };
})();
