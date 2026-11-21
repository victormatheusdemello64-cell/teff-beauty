(() => {
  const PATCH_LABEL = 'core-login-v29-visual';
  const ADMIN_EMAIL = 'teffbeauty767@gmail.com';
  let accessMode = 'cliente';

  function authIcon(name) {
    const paths = {
      user: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2"/>',
      shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8.5 12 2.3 2.3 4.7-5"/>',
      lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
      eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
      eyeOff: '<path d="m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.2 4M6.2 6.2A20 20 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.8-1.6M10 10a3 3 0 0 0 4 4"/>',
      bag: '<path d="M6 7h12l2 14H4L6 7Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
      heart: '<path d="M20.8 4.9a5.5 5.5 0 0 0-7.8 0L12 6l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.3a5.5 5.5 0 0 0 0-7.8Z"/>',
      sparkle: '<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z"/>',
      phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>',
      userPlus: '<circle cx="9" cy="7" r="3.5"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M19 8v8M15 12h8"/>'
    };
    return `<svg class="auth-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.user}</svg>`;
  }

  function authField(label, name, options = {}) {
    const { icon = 'user', type = 'text', autocomplete = '', placeholder = '', value = '', inputmode = '' } = options;
    const id = `auth-${name}`;
    return `<div class="auth-field">
      <label for="${id}">${label}</label>
      <div class="auth-input-wrap">
        ${authIcon(icon)}
        <input id="${id}" name="${name}" type="${type}" autocomplete="${autocomplete}" placeholder="${placeholder}" value="${escapeAttr(value)}" ${inputmode ? `inputmode="${inputmode}"` : ''} ${name === 'username' ? 'autocapitalize="none" spellcheck="false"' : ''} required>
        ${type === 'password' ? `<button class="auth-password-toggle" type="button" data-action="toggle-auth-password" aria-controls="${id}" aria-label="Mostrar senha" aria-pressed="false">${authIcon('eye')}</button>` : ''}
      </div>
    </div>`;
  }

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
        ${authField('E-mail ou usuário', 'username', { autocomplete: 'username', placeholder: accessMode === 'admin' ? 'Seu acesso administrativo' : 'Como você se identifica', value: accessMode === 'admin' ? 'admin' : '' })}
        ${authField('Senha', 'password', { icon: 'lock', type: 'password', autocomplete: 'current-password', placeholder: 'Digite sua senha' })}
        <button class="primary full auth-submit" type="submit">${accessMode === 'admin' ? 'Entrar no painel' : 'Entrar'}</button>
      </form>
    `;
  };

  renderSignupForm = function renderSignupFormPatched() {
    return `
      <form class="auth-form" data-form="signup">
        ${authField('Nome completo', 'name', { autocomplete: 'name', placeholder: 'Como podemos chamar você?' })}
        ${authField('WhatsApp', 'whatsapp', { icon: 'phone', inputmode: 'tel', autocomplete: 'tel', placeholder: '(00) 00000-0000' })}
        ${authField('Nome de usuário', 'username', { autocomplete: 'username', placeholder: 'Escolha seu usuário' })}
        ${authField('Senha', 'password', { icon: 'lock', type: 'password', autocomplete: 'new-password', placeholder: 'Crie sua senha' })}
        <button class="primary full auth-submit" type="submit">Criar minha conta</button>
      </form>
    `;
  };

  renderAuth = function renderAuthPatched() {
    const isLogin = state.authMode === 'login';
    return `
      <section class="auth-page" data-version="${PATCH_LABEL}">
        <div class="auth-layout">
          <div class="auth-art">
            <img class="auth-hero-image" src="./assets/Imagem%20do%20ChatGPT%2027%20de%20set.%20de%202026%2C%2003_19_26.png" alt="Teff Beauty — beleza que realça você" width="1536" height="1024" fetchpriority="high">
            <div class="auth-story">
              <p class="auth-eyebrow">MAQUIAGENS & COSMÉTICOS</p>
              <h2>Um toque de beleza.<br><em>Todo seu.</em></h2>
              <div class="auth-benefits">
                <span>${authIcon('bag')}Escolhas<br>especiais</span>
                <span>${authIcon('sparkle')}Novidades<br>para você</span>
                <span>${authIcon('heart')}Cuidado em<br>cada detalhe</span>
              </div>
            </div>
          </div>
          <div class="auth-panel">
            <header class="auth-heading">
              <span class="auth-welcome-mark">${authIcon('heart')}</span>
              <p class="auth-eyebrow">SEU ESPAÇO DE BELEZA</p>
              <h1>${isLogin ? 'Bem-vinda à' : 'Faça parte da'}<br><em>Teff Beauty</em></h1>
              <p class="auth-description">${isLogin ? (accessMode === 'admin' ? 'Acesse sua conta para cuidar da loja.' : 'Entre e descubra seus novos favoritos.') : 'Crie sua conta e encontre o que realça você.'}</p>
            </header>
            ${isLogin ? `<div class="auth-access-switch" role="group" aria-label="Tipo de acesso">
              <button type="button" data-action="client-login-shortcut" aria-pressed="${accessMode === 'cliente'}" class="${accessMode === 'cliente' ? 'active' : ''}">${authIcon('user')}Cliente</button>
              <button type="button" data-action="admin-login-shortcut" aria-pressed="${accessMode === 'admin'}" class="${accessMode === 'admin' ? 'active' : ''}">${authIcon('shield')}Administrador</button>
            </div>` : ''}
            ${isLogin ? renderLoginForm() : renderSignupForm()}
            <div class="auth-alternative">
              <p><span>${isLogin ? 'Ainda não tem uma conta?' : 'Já tem uma conta?'}</span></p>
              <button class="auth-create-account" type="button" data-action="auth-mode" data-mode="${isLogin ? 'signup' : 'login'}">${authIcon(isLogin ? 'userPlus' : 'user')}${isLogin ? 'Criar conta' : 'Entrar na minha conta'}</button>
            </div>
            <p class="auth-signature">TEFF EXCLUSIVO <span>·</span> BELEZA QUE REALÇA VOCÊ</p>
          </div>
        </div>
        </div>
      </section>
    `;
  };

  if (typeof handleAction === 'function') {
    const originalHandleAction = handleAction;
    handleAction = async function handleActionPatched(action, target) {
      if (action === 'admin-login-shortcut' || action === 'client-login-shortcut') {
        accessMode = action === 'admin-login-shortcut' ? 'admin' : 'cliente';
        state.authMode = 'login';
        render();
        if (accessMode === 'admin') setAdminShortcutFocus();
        return;
      }
      if (action === 'toggle-auth-password') {
        const input = document.getElementById(target.getAttribute('aria-controls'));
        if (!input) return;
        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        target.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
        target.setAttribute('aria-pressed', String(visible));
        target.innerHTML = authIcon(visible ? 'eyeOff' : 'eye');
        return;
      }
      if (action === 'auth-mode' && target.dataset.mode === 'signup') accessMode = 'cliente';
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
    const target = event.target?.closest?.('[data-action="admin-login-shortcut"], [data-action="client-login-shortcut"], [data-action="toggle-auth-password"]');
    if (!target || !app.contains(target)) return;
    event.preventDefault();
    event.stopPropagation();
    handleAction(target.dataset.action, target);
  }, true);

  clearClientCache();
  window.__TEFF_LOGIN_PATCH = PATCH_LABEL;

  let attempts = 0;
  const renderTimer = window.setInterval(() => {
    attempts += 1;
    if (!state.loading && !state.session) {
      render();
      window.clearInterval(renderTimer);
    }
    if (attempts > 20) window.clearInterval(renderTimer);
  }, 250);
})();
