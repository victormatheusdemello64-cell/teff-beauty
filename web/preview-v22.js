(() => {
  const PREVIEW_LABEL = 'preview-v23-vitrine-real';

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

  clearOldPreviewCache();

  if (typeof renderAuth === 'function') {
    renderAuth = function renderAuthPreviewV23() {
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
          </div>
        </section>
      `;
    };
  }
})();
