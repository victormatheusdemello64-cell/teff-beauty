(() => {
  const BUILD_LABEL = 'v21 local';

  function modeIsLogin() {
    try {
      return state.authMode === 'login';
    } catch (_error) {
      return true;
    }
  }

  function authModeButton(mode, label, active) {
    return `<button class="tab-button ${active ? 'active' : ''}" data-action="auth-mode" data-mode="${mode}">${label}</button>`;
  }

  if (typeof renderAuth === 'function') {
    renderAuth = function renderAuthV21() {
      const isLogin = modeIsLogin();
      return `
        <section class="auth-page auth-page-v21" data-build="${BUILD_LABEL}">
          <div class="auth-art" aria-hidden="true"></div>
          <div class="auth-panel auth-panel-v21">
            <div class="auth-version-row">
              <div>
                <span class="mini-brand">TEFF</span>
                <strong>Teff Exclusivo</strong>
              </div>
              <span class="build-pill">${BUILD_LABEL}</span>
            </div>
            <div class="auth-tabs">
              ${authModeButton('login', 'Entrar', isLogin)}
              ${authModeButton('signup', 'Criar conta', !isLogin)}
            </div>
            ${isLogin ? renderLoginForm() : renderSignupForm()}
          </div>
        </section>
      `;
    };
  }

  if (typeof render === 'function' && !window.__teffV21RenderWrapped) {
    const originalRender = render;
    window.__teffV21RenderWrapped = true;
    render = function renderWithBuildChip() {
      originalRender();
      let chip = document.querySelector('.build-chip');
      if (!chip) {
        chip = document.createElement('div');
        chip.className = 'build-chip';
        document.body.appendChild(chip);
      }
      chip.textContent = BUILD_LABEL;
    };
  }

  window.setTimeout(() => {
    const app = document.getElementById('app');
    if (!app || !app.classList.contains('boot-screen')) return;
    app.className = 'load-error';
    app.innerHTML = `
      <div class="load-error-card">
        <strong>Teff Exclusivo</strong>
        <p>O APK v21 abriu, mas alguma biblioteca online nao carregou. Confira a internet do aparelho e tente abrir novamente.</p>
      </div>
    `;
  }, 6000);
})();
