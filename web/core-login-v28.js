(() => {
  const PATCH_LABEL = 'core-login-v28';
  const ADMIN_EMAIL = 'teffbeauty767@gmail.com';

  function errorMessage(error) {
    if (!error) return 'Falha inesperada.';
    if (typeof error === 'string') return error;
    return error.message || String(error);
  }

  function notify(message) {
    try {
      showToast(message);
    } catch (_error) {
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = message;
        toast.classList.add('show');
        window.setTimeout(() => toast.classList.remove('show'), 4200);
      }
      console.log(`[${PATCH_LABEL}] ${message}`);
    }
  }

  window.addEventListener('error', (event) => {
    notify(`Erro no app: ${event.message || 'falha inesperada'}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    notify(`Erro no app: ${errorMessage(event.reason)}`);
  });

  async function clearClientCache() {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }
    } catch (error) {
      console.warn(`[${PATCH_LABEL}] cache cleanup skipped`, error);
    }
  }

  function prettyName(username) {
    return String(username || '')
      .split(/[._\-\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Cliente Teff';
  }

  function passwordForAuth(username, password) {
    const raw = String(password || '');
    const login = String(username || '').trim().toLowerCase();
    if (!raw) return raw;
    if (login === 'admin' || login.includes('@') || raw.length >= 6) return raw;
    return `TeffExclusivo#${normalizeUsername(username)}#${raw}`;
  }

  function setAdminShortcutFocus() {
    window.setTimeout(() => {
      const usernameInput = document.querySelector('input[name="username"]');
      const passwordInput = document.querySelector('input[name="password"]');
      if (usernameInput) usernameInput.value = 'admin';
      if (passwordInput) passwordInput.focus();
    }, 0);
  }

  function dataFromForm(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  if (typeof refreshAll === 'function') {
    const originalRefreshAll = refreshAll;
    refreshAll = async function refreshAllPatched() {
      try {
        await originalRefreshAll();
      } catch (error) {
        notify(`Falha ao carregar dados: ${errorMessage(error)}`);
      }
    };
  }

  if (typeof isAdmin === 'function') {
    const originalIsAdmin = isAdmin;
    isAdmin = function isAdminPatched() {
      return originalIsAdmin() || state.session?.user?.email === ADMIN_EMAIL;
    };
  }

  renderLoginForm = function renderLoginFormPatched() {
    return `
      <form class="auth-form" data-form="login">
        <label>Usuário<input name="username" autocomplete="username" required></label>
        <label>Senha<input name="password" type="password" autocomplete="current-password" required></label>
        <button class="primary full" type="submit">Entrar</button>
      </form>
    `;
  };

  renderSignupForm = function renderSignupFormPatched() {
    return `
      <form class="auth-form" data-form="signup">
        <label>Nome completo<input name="name" autocomplete="name" required></label>
        <label>WhatsApp<input name="whatsapp" inputmode="tel" autocomplete="tel" required></label>
        <label>Usuário<input name="username" autocomplete="username" required></label>
        <label>Senha<input name="password" type="password" autocomplete="new-password" required></label>
        <button class="primary full" type="submit">Criar conta</button>
      </form>
    `;
  };

  renderAuth = function renderAuthPatched() {
    const isLogin = state.authMode === 'login';
    return `
      <section class="auth-page" data-version="${PATCH_LABEL}">
        <div class="auth-art" aria-hidden="true"></div>
        <div class="auth-panel">
          <p class="eyebrow">TEFF</p>
          <h1>Teff Exclusivo</h1>
          <div class="auth-tabs">
            <button class="${isLogin ? 'active' : ''}" data-action="auth-mode" data-mode="login">Entrar</button>
            <button class="${!isLogin ? 'active' : ''}" data-action="auth-mode" data-mode="signup">Criar conta</button>
          </div>
          <button class="secondary full" type="button" data-action="admin-login-shortcut">Painel administrativo</button>
          ${isLogin ? renderLoginForm() : renderSignupForm()}
        </div>
      </section>
    `;
  };

  if (typeof handleAction === 'function') {
    const originalHandleAction = handleAction;
    handleAction = async function handleActionPatched(action, target) {
      if (action === 'admin-login-shortcut') {
        state.authMode = 'login';
        render();
        setAdminShortcutFocus();
        notify('Atalho admin pronto. Digite a senha e toque em Entrar.');
        return;
      }
      return originalHandleAction(action, target);
    };
  }

  handleForm = async function handleFormPatched(type, form) {
    const data = dataFromForm(form);
    try {
      if (type === 'login') {
        notify('Entrando...');
        await login(data);
        return;
      }
      if (type === 'signup') {
        notify('Criando conta...');
        await signup(data);
        return;
      }
      await saveForm(type, data, form);
    } catch (error) {
      notify(errorMessage(error));
    }
  };

  login = async function loginPatched(data) {
    const username = normalizeUsername(data.username);
    const email = await emailForLogin(data.username);
    const rawPassword = String(data.password || '');
    const safePassword = passwordForAuth(data.username, rawPassword);
    const attempts = [...new Set([safePassword, rawPassword].filter(Boolean))];

    for (const password of attempts) {
      const result = await db.auth.signInWithPassword({ email, password });
      if (!result.error) {
        state.session = result.data.session;
        state.profile = null;
        state.cart = loadCart();
        await refreshAll();
        state.view = isAdmin() ? 'admin-dashboard' : 'home';
        render();
        notify('Login realizado.');
        return;
      }
    }

    if (!username || String(data.username || '').includes('@') || username === 'admin') {
      throw new Error('Usuario ou senha incorretos.');
    }

    const signupResult = await db.auth.signUp({
      email: usernameEmail(username),
      password: safePassword,
      options: {
        data: {
          full_name: prettyName(username),
          username,
          whatsapp: '',
        },
      },
    });

    if (signupResult.error) {
      throw new Error('Nao consegui entrar. Se esse usuario ja existe, a senha salva no Supabase pode estar diferente.');
    }

    const retry = await db.auth.signInWithPassword({ email: usernameEmail(username), password: safePassword });
    if (retry.error) {
      state.authMode = 'login';
      render();
      notify('Conta criada. Tente entrar novamente com esse usuario e senha.');
      return;
    }

    state.session = retry.data.session;
    state.profile = null;
    state.cart = loadCart();
    await refreshAll();
    state.view = 'home';
    render();
    notify('Conta criada e login realizado.');
  };

  signup = async function signupPatched(data) {
    const username = normalizeUsername(data.username);
    if (!username) throw new Error('Informe um usuario valido.');
    const email = usernameEmail(username);
    const password = passwordForAuth(username, data.password);

    const { error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: data.name,
          username,
          whatsapp: data.whatsapp,
        },
      },
    });

    if (error) throw new Error(error.message);
    notify('Conta criada. Se nao entrar automaticamente, use seu usuario e senha.');
  };

  document.addEventListener('submit', (event) => {
    const form = event.target?.closest?.('form[data-form]');
    if (!form || !app.contains(form)) return;
    event.preventDefault();
    event.stopPropagation();
    handleForm(form.dataset.form, form);
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target?.closest?.('[data-action="admin-login-shortcut"]');
    if (!target || !app.contains(target)) return;
    event.preventDefault();
    event.stopPropagation();
    handleAction('admin-login-shortcut', target);
  }, true);

  clearClientCache();
  window.__TEFF_LOGIN_PATCH = PATCH_LABEL;

  let attempts = 0;
  const renderTimer = window.setInterval(() => {
    attempts += 1;
    if (!state.loading && !state.session) {
      render();
      window.clearInterval(renderTimer);
      notify('Preview atualizado.');
    }
    if (attempts > 20) window.clearInterval(renderTimer);
  }, 250);
})();
