/**
 * TARA for Kapruka — Content Script v2
 *
 * Changes from v1:
 *  • Panel is now expandable to 75 % of the viewport via tara-expand postMessage
 *  • Semi-transparent backdrop appears behind the expanded panel
 *  • Clicking the backdrop closes the panel
 *  • closePanel() always resets the expanded state (panel opens compact next time)
 *  • detect.js handles embed-demo page detection; this file only runs on kapruka.com
 */
(async function () {
  'use strict';

  if (document.getElementById('tara-shadow-host')) return;

  const WIDGET_URL    = 'https://tara-green.vercel.app/widget';
  const WIDGET_ORIGIN = 'https://tara-green.vercel.app';

  let isOpen     = false;
  let isExpanded = false;
  let iframeLoaded = false;

  // ── Shadow host ────────────────────────────────────────────────────────────
  const host = document.createElement('div');
  host.id = 'tara-shadow-host';
  Object.assign(host.style, {
    position:   'fixed',
    bottom:     '0',
    right:      '0',
    zIndex:     '2147483647',
    width:      '0',
    height:     '0',
    overflow:   'visible',
    border:     'none',
    background: 'none',
    pointerEvents: 'none',
  });
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  // ── Load widget.css ────────────────────────────────────────────────────────
  try {
    const cssText = await fetch(chrome.runtime.getURL('widget.css')).then(r => r.text());
    const sheet   = new CSSStyleSheet();
    sheet.replaceSync(cssText);
    shadow.adoptedStyleSheets = [sheet];
  } catch (err) {
    console.warn('[TARA] widget.css failed to load:', err);
  }

  // ── Product context extraction ─────────────────────────────────────────────
  // Kapruka's real product URL scheme is /buyonline/{slug}/kid/{id} (verified
  // against the live site 2026-07-04) — it never contains "/product". The old
  // gate below (`/\/product(s)?[/-]/i`) matched zero real Kapruka pages, so
  // context extraction has never fired in production. Kept as a secondary
  // check in case some page templates differ.
  function extractContext() {
    const url = window.location.href;
    const isProductPage = /\/buyonline\//i.test(url) || /\/product(s)?[/-]/i.test(url);
    if (!isProductPage) return null;

    const nameEl =
      document.querySelector('h1.product-title') ||
      document.querySelector('[class*="product-name"] h1') ||
      document.querySelector('[itemprop="name"]') ||
      document.querySelector('h1');

    const priceEl =
      document.querySelector('.product-price') ||
      document.querySelector('[class*="current-price"]') ||
      document.querySelector('[itemprop="price"]') ||
      document.querySelector('[class*="price"]:not([class*="old"]):not([class*="was"])');

    // Kapruka's real ID lives after /kid/ and is alphanumeric with underscores
    // (e.g. "cake00ka002105", "ef_pc_elec0v701pod00603" — verified live across
    // both cakes and electronics categories), not the purely-numeric ID a
    // generic /product/123 scheme would have.
    const idMatch =
      url.match(/\/kid\/([a-z0-9_]+)/i) ||
      url.match(/\/products?\/(\d+)/i) ||
      url.match(/[?&]id=(\d+)/i) ||
      url.match(/\/(\d{5,})(?:[\/?#]|$)/);

    const idEl = document.querySelector('[data-product-id],[data-id],[data-pid]');

    const name = nameEl?.textContent?.trim();
    // Kapruka shows different currencies on its regional domains (verified
    // live: the base kapruka.com/buyonline page displayed "US$11.73", not
    // LKR) — capture whatever currency symbol/code is actually present
    // instead of assuming LKR. Only fall back to an LKR label when the
    // matched text has no currency marker of its own.
    const rawPrice = priceEl?.textContent?.trim();
    const priceMatch = rawPrice?.match(/(LKR|Rs\.?|US\$|A\$|C\$|£|\$)?\s?[\d,]+(?:\.\d+)?/i);
    const price = priceMatch
      ? (priceMatch[1] ? priceMatch[0].trim() : `LKR ${priceMatch[0].trim()}`)
      : undefined;
    const id = idMatch?.[1] || idEl?.dataset?.productId || idEl?.dataset?.id;

    if (!name) return null;
    return {
      name:  encodeURIComponent(name.slice(0, 100)),
      price: price ? encodeURIComponent(price) : '',
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
  const wrapper  = document.createElement('div');
  wrapper.id = 'tara-wrapper';

  // Backdrop — semi-transparent overlay behind expanded panel
  const backdrop = document.createElement('div');
  backdrop.id = 'tara-backdrop';

  // Bubble
  const bubble = document.createElement('button');
  bubble.id = 'tara-bubble';
  bubble.setAttribute('aria-label', 'Open TARA AI assistant');
  bubble.setAttribute('aria-expanded', 'false');
  bubble.setAttribute('aria-haspopup', 'dialog');
  bubble.innerHTML = `
    <span class="tara-logo" aria-hidden="true">T</span>
    <span class="tara-sparkle" aria-hidden="true">✦</span>
    <span id="tara-unread" aria-hidden="true"></span>
    <span id="tara-badge"  aria-hidden="true"></span>
    <span id="tara-tooltip" role="tooltip">Ask TARA ✦</span>
  `;

  // Panel + iframe
  const panel = document.createElement('div');
  panel.id = 'tara-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'TARA AI shopping assistant');
  panel.setAttribute('aria-modal', 'true');

  const iframe = document.createElement('iframe');
  iframe.id    = 'tara-iframe';
  iframe.title = 'TARA AI Shopping Assistant';
  iframe.setAttribute('allow',   'clipboard-write; autoplay');
  
  panel.appendChild(iframe);
  wrapper.appendChild(bubble);
  wrapper.appendChild(panel);
  // Backdrop goes into shadow root directly (behind panel, covers full viewport)
  shadow.appendChild(backdrop);
  shadow.appendChild(wrapper);

  // ── Context detection ──────────────────────────────────────────────────────
  const ctx   = extractContext();
  const badge = shadow.getElementById('tara-badge');
  if (ctx && badge) {
    badge.textContent = '1';
    badge.classList.add('visible');
  }

  // ── Panel dimension helpers ────────────────────────────────────────────────
  /**
   * Apply compact or expanded visual state to the panel.
   * Compact  : 420 × 640 px, bottom-right corner — default
   * Expanded : 75 vw × 88 vh, anchored to bottom-right edge
   *            A backdrop dims and blurs the kapruka page beneath it.
   */
  function applyPanelDimensions() {
    if (isExpanded) {
      panel.classList.add('expanded');
      backdrop.classList.add('visible');
    } else {
      panel.classList.remove('expanded');
      backdrop.classList.remove('visible');
    }
  }

  // ── Open / Close ──────────────────────────────────────────────────────────
  function openPanel() {
    if (isOpen) return;
    isOpen = true;

    if (!iframeLoaded) {
      iframe.src = buildIframeSrc(ctx);
      iframeLoaded = true;

      iframe.addEventListener('load', async () => {
        const data = await new Promise(r => chrome.storage.local.get(['tara_cart', 'tara_lang'], r));
        iframe.contentWindow?.postMessage({ type: 'tara-restore', payload: data }, WIDGET_ORIGIN);
      }, { once: true });
    }

    panel.classList.remove('closing');
    panel.classList.add('open');
    bubble.setAttribute('aria-expanded', 'true');
    bubble.setAttribute('aria-label', 'Close TARA AI assistant');

    const unread = shadow.getElementById('tara-unread');
    if (unread) unread.classList.remove('visible');
    if (badge)  badge.classList.remove('visible');

    requestAnimationFrame(() => iframe.focus());
  }

  function closePanel() {
    if (!isOpen) return;
    isOpen     = false;
    isExpanded = false; // always reset — next open is compact

    panel.classList.remove('open', 'expanded');
    panel.classList.add('closing');
    backdrop.classList.remove('visible');

    bubble.setAttribute('aria-expanded', 'false');
    bubble.setAttribute('aria-label', 'Open TARA AI assistant');

    panel.addEventListener('animationend', () => {
      panel.classList.remove('closing');
    }, { once: true });

    bubble.focus();
  }

  // ── Bubble events ──────────────────────────────────────────────────────────
  bubble.addEventListener('click', () => (isOpen ? closePanel() : openPanel()));
  bubble.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) closePanel(); });
  backdrop.addEventListener('click', closePanel);

  // ── postMessage handler ────────────────────────────────────────────────────
  window.addEventListener('message', async event => {
    if (event.origin !== WIDGET_ORIGIN) return;

    const { type, payload } = event.data ?? {};

    switch (type) {
      case 'tara-close':
        closePanel();
        break;

      case 'tara-expand': {
        // Widget sent expand/collapse request
        const shouldExpand = Boolean(event.data.expanded);
        if (shouldExpand !== isExpanded) {
          isExpanded = shouldExpand;
          applyPanelDimensions();
        }
        break;
      }

      case 'tara-message':
        if (!isOpen) {
          const unread = shadow.getElementById('tara-unread');
          if (unread) unread.classList.add('visible');
        }
        break;

      case 'tara-cart-update':
        if (payload)          chrome.storage.local.set({ tara_cart: payload });
        if (event.data.qty != null) {
          // Update badge if qty > 0 and panel is open (cosmetic only)
        }
        break;

      case 'tara-lang-update':
        if (payload) chrome.storage.local.set({ tara_lang: payload });
        break;

      case 'tara-ready':
        break;
    }
  });

})();
