(() => {
  const PREVIEW_LABEL = 'preview-v28-core-login';

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
    } catch (error) {
      console.warn(`[${PREVIEW_LABEL}] cache cleanup skipped`, error);
    }
  }

  clearOldPreviewCache();
  window.__TEFF_PREVIEW_LABEL = PREVIEW_LABEL;
})();
