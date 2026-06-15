/**
 * TARA for Kapruka — Content Script
 * Injects the TARA floating widget into every kapruka.com page via Shadow DOM.
 * Zero coupling to Kapruka's CSS/JS. MV3-compatible, vanilla JS only.
 */
(async function () {
  'use strict';

  // ── Guard: avoid double injection ─────────────────────────────────────────
  if (document.getElementById('tara-shadow-host')) return;

  const WIDGET_URL   = 'https://tara-green.vercel.app/widget';
  const WIDGET_ORIGIN = 'https://tara-green.vercel.app';

  let isOpen    = false;
  let iframeLoaded = false;

  // ── Shadow host ────────────────────────────────────────────────────────────
  const host = document.createElement('div');
  host.id = 'tara-shadow-host';
  // Absolute minimum footprint on the parent page
  Object.assign(host.style, {
    position: 'fixed',
    bottom:   '0',
    right:    '0',
    zIndex:   '2147483647',
    width:    '0',
    height:   '0',
    overflow: 'visible',
    border:   'none',
    background: 'none',
    pointerEvents: 'none',
  });
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  // ── Load widget.css into shadow root via adoptedStyleSheets ───────────────
  try {
    const cssURL  = chrome.runtime.getURL('widget.css');
    const cssText = await fetch(cssURL).then(r => r.text());
    const sheet   = new CSSStyleSheet();
    sheet.replaceSync(cssText);
    shadow.adoptedStyleSheets = [sheet];
  } catch (err) {
    console.warn('[TARA] Could not load widget.css, falling back to inline styles.', err);
  }

  // ── Product context extraction ─────────────────────────────────────────────
  function extractContext() {
    const url = window.location.href;
    // Kapruka product page patterns: /products/123, /product/slug
    if (!/\/product(s)?[/-]/i.test(url)) return null;

    const nameEl =
      document.querySelector('h1.product-title') ||
      document.querySelector('[class*="product-name"] h1') ||
      document.querySelector('[class*="productName"]') ||
      document.querySelector('[itemprop="name"]') ||
      document.querySelector('h1');

    const priceEl =
      document.querySelector('.product-price') ||
      document.querySelector('[class*="current-price"]') ||
      document.querySelector('[itemprop="price"]') ||
      document.querySelector('[class*="price"]:not([class*="old"]):not([class*="was"])');

    const idMatch =
      url.match(/\/products?\/(\d+)/i) ||
      url.match(/[?&]id=(\d+)/i) ||
      url.match(/\/(\d{5,})(?:[\/?#]|$)/);

    const idEl = document.querySelector('[data-product-id],[data-id],[data-pid]');

    const name  = nameEl?.textContent?.trim();
    const price = priceEl?.textContent?.trim()
      ?.replace(/\s+/g, ' ')
      ?.match(/[\d,]+(?:\.\d+)?/)?.[0];
    const id    = idMatch?.[1]
      || idEl?.dataset?.productId
      || idEl?.dataset?.id
      || idEl?.dataset?.pid;

    if (!name) return null;

    return {
      name:  encodeURIComponent(name.slice(0, 100)),
      price: price ? encodeURIComponent(`LKR ${price}`) : '',
      id:    id    ? encodeURIComponent(id)             : '',
    };
  }

  function buildIframeSrc(ctx) {
    if (!ctx) return WIDGET_URL;
    const p = new URLSearchParams();
    if (ctx.name)  p.set('context', ctx.name);
    if (ctx.price) p.set('price',   ctx.price);
    if (ctx.id)    p.set('id',      ctx.id);
    return `${WIDGET_URL}?${p.toString()}`;
  }

  // ── DOM construction ───────────────────────────────────────────────────────
  const wrapper = document.createElement('div');
  wrapper.id = 'tara-wrapper';

  // Bubble button
  const bubble = document.createElement('button');
  bubble.id = 'tara-bubble';
  bubble.setAttribute('aria-label', 'Open TARA AI assistant');
  bubble.setAttribute('aria-expanded', 'false');
  bubble.setAttribute('aria-haspopup', 'dialog');
  bubble.innerHTML = `
    <span class="tara-logo" aria-hidden="true">T</span>
    <span class="tara-sparkle" aria-hidden="true">✦</span>
    <span id="tara-unread" aria-hidden="true" title="New message from TARA"></span>
    <span id="tara-badge"  aria-hidden="true"></span>
    <span id="tara-tooltip" role="tooltip">Ask TARA ✦</span>
  `;

  // Panel
  const panel = document.createElement('div');
  panel.id = 'tara-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'TARA AI shopping assistant');
  panel.setAttribute('aria-modal', 'true');

  // Iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'tara-iframe';
  iframe.title = 'TARA AI Shopping Assistant';
  iframe.setAttribute('allow', 'clipboard-write; autoplay');
  iframe.setAttribute('sandbox',
    'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');

  panel.appendChild(iframe);
  wrapper.appendChild(bubble);
  wrapper.appendChild(panel);
  shadow.appendChild(wrapper);

  // ── Context detection ──────────────────────────────────────────────────────
  const ctx = extractContext();
  const badge = shadow.getElementById('tara-badge');
  if (ctx && badge) {
    badge.textContent = '1';
    badge.classList.add('visible');
  }

  // ── Persist cart state via chrome.storage.local ───────────────────────────
  // Widget loads fresh each iframe open; we relay storage events via postMessage
  async function loadPersistedData() {
    return new Promise(resolve => {
      chrome.storage.local.get(['tara_cart', 'tara_lang'], resolve);
    });
  }

  // ── Panel open / close ─────────────────────────────────────────────────────
  function openPanel() {
    if (isOpen) return;
    isOpen = true;

    if (!iframeLoaded) {
      iframe.src = buildIframeSrc(ctx);
      iframeLoaded = true;

      // Relay persisted storage to widget once it signals ready
      iframe.addEventListener('load', async () => {
        const data = await loadPersistedData();
        iframe.contentWindow?.postMessage(
          { type: 'tara-restore', payload: data },
          WIDGET_ORIGIN
        );
      }, { once: true });
    }

    panel.classList.remove('closing');
    panel.classList.add('open');
    bubble.setAttribute('aria-expanded', 'true');
    bubble.setAttribute('aria-label', 'Close TARA AI assistant');

    // Clear unread
    const unread = shadow.getElementById('tara-unread');
    if (unread) unread.classList.remove('visible');
    if (badge)  badge.classList.remove('visible');

    // Trap focus inside panel on next frame
    requestAnimationFrame(() => iframe.focus());
  }

  function closePanel() {
    if (!isOpen) return;
    isOpen = false;

    panel.classList.remove('open');
    panel.classList.add('closing');
    bubble.setAttribute('aria-expanded', 'false');
    bubble.setAttribute('aria-label', 'Open TARA AI assistant');

    panel.addEventListener('animationend', () => {
      panel.classList.remove('closing');
    }, { once: true });

    bubble.focus();
  }

  // ── Bubble click ───────────────────────────────────────────────────────────
  bubble.addEventListener('click', () => (isOpen ? closePanel() : openPanel()));

  bubble.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePanel();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

  // ── postMessage handler ────────────────────────────────────────────────────
  window.addEventListener('message', async event => {
    // ⚠ Always validate origin before trusting payload
    if (event.origin !== WIDGET_ORIGIN) return;

    const { type, payload } = event.data ?? {};

    switch (type) {
      case 'tara-close':
        closePanel();
        break;

      case 'tara-message':
        // TARA sent a proactive message; show unread dot when panel is closed
        if (!isOpen) {
          const unread = shadow.getElementById('tara-unread');
          if (unread) unread.classList.add('visible');
        }
        break;

      case 'tara-cart-update':
        // Persist cart state so it survives iframe reload
        if (payload) {
          chrome.storage.local.set({ tara_cart: payload });
        }
        break;

      case 'tara-lang-update':
        if (payload) {
          chrome.storage.local.set({ tara_lang: payload });
        }
        break;

      case 'tara-ready':
        // Widget is loaded; no-op (could relay context again as fallback)
        break;
    }
  });

  // ── Auto-open hint on product pages ───────────────────────────────────────
  // Pulse the bubble once if we detected product context, to hint TARA knows
  if (ctx) {
    setTimeout(() => {
      bubble.style.animation = 'none';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          bubble.style.animation = '';
        });
      });
    }, 1200);
  }

})();
