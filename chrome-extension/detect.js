/**
 * detect.js — TARA Extension Detection Script
 *
 * Injected into tara-green.vercel.app/embed-demo by the Chrome extension at
 * document_start, before React hydrates. Sets a data attribute + dispatches
 * a custom event so the embed-demo page can detect the extension without
 * needing the extension ID or externally_connectable config.
 *
 * No permissions required. Read-only flag; no user data is touched.
 */
(function () {
  // Attribute readable immediately (document_start = before DOMContentLoaded)
  document.documentElement.setAttribute('data-tara-extension', '1');

  // Custom event for React useEffect that runs after hydration
  document.addEventListener('DOMContentLoaded', function () {
    document.dispatchEvent(
      new CustomEvent('tara-extension-ready', {
        bubbles: true,
        detail: { version: '1.0.0' },
      })
    );
  });
})();
