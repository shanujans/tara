/**
 * TARA Embed Script — Production
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop one line into any page and TARA appears:
 *
 *   <script src="https://tara-green.vercel.app/embed.js" async></script>
 *
 * Works WITHOUT the Chrome extension.
 * Uses shadow DOM so the host page's CSS never bleeds in.
 * State (cart, language) is stored in localStorage.
 * Product context is auto-extracted on Kapruka product pages.
 * ─────────────────────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  if (document.getElementById('tara-embed-host')) return;

  const WIDGET_URL    = 'https://tara-green.vercel.app/widget';
  const WIDGET_ORIGIN = 'https://tara-green.vercel.app';

  let isOpen     = false;
  let isExpanded = false;
  let loaded     = false;

  /* ── Inline CSS (shadow-DOM scoped) ─────────────────────────────────────── */
  const CSS = `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    #tw{position:fixed;bottom:24px;right:24px;z-index:2147483647;pointer-events:none;font-family:system-ui,-apple-system,sans-serif}
    #tb{position:fixed;inset:0;background:rgba(0,0,0,.42);backdrop-filter:blur(2px);z-index:2147483646;display:none;pointer-events:all;cursor:pointer;opacity:0}
    #tb.v{display:block;animation:fi .3s ease forwards}
    @keyframes fi{from{opacity:0}to{opacity:1}}
    #tbb{position:relative;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);box-shadow:0 4px 20px rgba(245,158,11,.5),0 2px 6px rgba(0,0,0,.3);cursor:pointer;border:none;display:flex;align-items:center;justify-content:center;pointer-events:all;transition:transform .18s cubic-bezier(.34,1.56,.64,1),box-shadow .18s}
    #tbb:hover{transform:scale(1.09);box-shadow:0 6px 28px rgba(245,158,11,.65)}
    #tbb:active{transform:scale(.95)}
    #tbb::before{content:'';position:absolute;inset:-3px;border-radius:50%;border:2.5px solid rgba(245,158,11,.55);animation:tp 2.5s ease infinite;pointer-events:none}
    @keyframes tp{0%{transform:scale(1);opacity:.8}70%{transform:scale(1.28);opacity:0}100%{transform:scale(1.28);opacity:0}}
    #tbb[aria-expanded="true"]::before{animation:none;opacity:0}
    .tl{color:#fff;font-size:25px;font-weight:900;user-select:none;text-shadow:0 1px 3px rgba(0,0,0,.2)}
    .ts{position:absolute;bottom:9px;right:9px;color:rgba(255,255,255,.85);font-size:9px;user-select:none}
    #tu{position:absolute;top:0;right:0;width:14px;height:14px;background:#ef4444;border:2.5px solid #fff;border-radius:50%;display:none;animation:pop .25s cubic-bezier(.34,1.56,.64,1) both}
    #tu.v{display:block}
    #tbg{position:absolute;top:-3px;left:-3px;min-width:19px;height:19px;background:#22c55e;border:2px solid #fff;border-radius:9.5px;display:none;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;padding:0 4px}
    #tbg.v{display:flex}
    @keyframes pop{from{transform:scale(0)}to{transform:scale(1)}}
    #ttt{position:absolute;bottom:calc(100% + 10px);right:0;background:rgba(13,13,26,.96);color:#f59e0b;font-size:12px;font-weight:600;padding:6px 14px;border-radius:20px;white-space:nowrap;border:1px solid rgba(245,158,11,.25);opacity:0;transform:translateY(5px);transition:opacity .2s,transform .2s;pointer-events:none;user-select:none}
    #tbb:hover #ttt{opacity:1;transform:translateY(0)}
    #tbb[aria-expanded="true"] #ttt{display:none}
    #tp{position:fixed;bottom:92px;right:24px;width:420px;height:640px;border-radius:20px;overflow:hidden;border:1px solid rgba(251,191,36,.18);box-shadow:0 32px 80px rgba(0,0,0,.55),0 8px 24px rgba(245,158,11,.14);transform:translateY(calc(100% + 32px));opacity:0;pointer-events:none;transition:width .4s cubic-bezier(.4,0,.2,1),height .4s cubic-bezier(.4,0,.2,1),right .4s,bottom .4s,border-radius .4s}
    #tp.open{animation:su .48s cubic-bezier(.34,1.56,.64,1) forwards;pointer-events:all}
    #tp.expanded{width:min(75vw,1100px);height:min(88vh,920px);right:0;bottom:0;border-radius:16px 0 0 0}
    #tp.closing{animation:sd .3s cubic-bezier(.4,0,.2,1) forwards;pointer-events:none}
    @keyframes su{0%{transform:translateY(calc(100% + 32px));opacity:0}100%{transform:translateY(0);opacity:1}}
    @keyframes sd{0%{transform:translateY(0);opacity:1}100%{transform:translateY(calc(100% + 32px));opacity:0}}
    #tf{width:100%;height:100%;border:none;display:block;background:#0d0d1a;outline:none}
    @media(max-width:480px){#tw{bottom:16px;right:16px}#tp{right:0!important;bottom:0!important;width:100vw!important;height:100dvh!important;border-radius:0!important;border:none!important}#tb{display:none!important}}
    @media(prefers-reduced-motion:reduce){#tbb::before,#tu,#tbg{animation:none}#tp{transition:none}#tp.open{animation:none;transform:translateY(0);opacity:1}#tp.closing{animation:none;display:none}#tb.v{animation:none;opacity:1}}
  `;

  /* ── Product context extraction ──────────────────────────────────────────── */
  function getContext() {
    const url = location.href;
    if (!/\/product(s)?[/-]/i.test(url)) return null;

    const nameEl =
      document.querySelector('h1.product-title') ||
      document.querySelector('[itemprop="name"]') ||
      document.querySelector('h1');

    const priceEl =
      document.querySelector('.product-price') ||
      document.querySelector('[itemprop="price"]') ||
      document.querySelector('[class*="price"]:not([class*="old"])');

    const idMatch =
      url.match(/\/products?\/(\d+)/i) ||
      url.match(/[?&]id=(\d+)/i);

    const name  = nameEl?.textContent?.trim();
    const price = priceEl?.textContent?.trim()?.match(/[\d,]+(?:\.\d+)?/)?.[0];
    const id    = idMatch?.[1];

    if (!name) return null;
    return { name: encodeURIComponent(name.slice(0, 100)), price: price ? encodeURIComponent(`LKR ${price}`) : '', id: id ? encodeURIComponent(id) : '' };
  }

  function buildSrc(ctx) {
    if (!ctx) return WIDGET_URL;
    const p = new URLSearchParams();
    if (ctx.name)  p.set('context', ctx.name);
    if (ctx.price) p.set('price', ctx.price);
    if (ctx.id)    p.set('id', ctx.id);
    return `${WIDGET_URL}?${p}`;
  }

  /* ── Wait for body, then mount ───────────────────────────────────────────── */
  function mount() {
    /* Shadow host */
    const host = document.createElement('div');
    host.id = 'tara-embed-host';
    Object.assign(host.style, { position:'fixed', bottom:'0', right:'0', zIndex:'2147483647', width:'0', height:'0', overflow:'visible', border:'none', background:'none', pointerEvents:'none' });
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    /* Inject CSS */
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    shadow.adoptedStyleSheets = [sheet];

    /* Backdrop */
    const backdrop = document.createElement('div');
    backdrop.id = 'tb';
    shadow.appendChild(backdrop);

    /* Wrapper */
    const wrap = document.createElement('div');
    wrap.id = 'tw';
    shadow.appendChild(wrap);

    /* Bubble */
    const bubble = document.createElement('button');
    bubble.id = 'tbb';
    bubble.setAttribute('aria-label', 'Open TARA AI assistant');
    bubble.setAttribute('aria-expanded', 'false');
    bubble.innerHTML = `<span class="tl">T</span><span class="ts">✦</span><span id="tu"></span><span id="tbg"></span><span id="ttt">Ask TARA ✦</span>`;
    wrap.appendChild(bubble);

    /* Panel + iframe */
    const panel  = document.createElement('div');
    panel.id = 'tp';
    const iframe = document.createElement('iframe');
    iframe.id = 'tf';
    iframe.title = 'TARA AI Shopping Assistant';
    iframe.setAttribute('allow', 'clipboard-write; autoplay');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
    panel.appendChild(iframe);
    shadow.appendChild(panel);

    /* Context badge */
    const ctx   = getContext();
    const badge = shadow.getElementById('tbg');
    if (ctx && badge) { badge.textContent = '1'; badge.classList.add('v'); }

    /* localStorage helpers (replaces chrome.storage) */
    function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
    function load(key) { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } }

    /* Open / close */
    function openPanel() {
      if (isOpen) return;
      isOpen = true;

      if (!loaded) {
        iframe.src = buildSrc(ctx);
        loaded = true;
        iframe.addEventListener('load', () => {
          iframe.contentWindow?.postMessage({
            type: 'tara-restore',
            payload: { tara_cart: load('tara_cart'), tara_lang: load('tara_lang') }
          }, WIDGET_ORIGIN);
        }, { once: true });
      }

      panel.classList.remove('closing');
      panel.classList.add('open');
      bubble.setAttribute('aria-expanded', 'true');
      bubble.setAttribute('aria-label', 'Close TARA AI assistant');

      shadow.getElementById('tu')?.classList.remove('v');
      badge?.classList.remove('v');
    }

    function closePanel() {
      if (!isOpen) return;
      isOpen = isExpanded = false;

      panel.classList.remove('open', 'expanded');
      panel.classList.add('closing');
      backdrop.classList.remove('v');

      bubble.setAttribute('aria-expanded', 'false');
      bubble.setAttribute('aria-label', 'Open TARA AI assistant');

      panel.addEventListener('animationend', () => panel.classList.remove('closing'), { once: true });
    }

    bubble.addEventListener('click', () => isOpen ? closePanel() : openPanel());
    backdrop.addEventListener('click', closePanel);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) closePanel(); });

    /* postMessage from widget */
    window.addEventListener('message', e => {
      if (e.origin !== WIDGET_ORIGIN) return;
      const { type, payload, expanded, qty } = e.data ?? {};

      if (type === 'tara-close')  closePanel();
      if (type === 'tara-message' && !isOpen) shadow.getElementById('tu')?.classList.add('v');
      if (type === 'tara-cart-update') {
        if (payload) save('tara_cart', payload);
        /* Update bubble badge with cart qty */
        const existing = shadow.getElementById('tara-cart-badge');
        if (qty != null && qty > 0) {
          if (!existing) {
            const b = document.createElement('span');
            b.id = 'tara-cart-badge';
            Object.assign(b.style, { position:'absolute', top:'-4px', left:'-4px', width:'16px', height:'16px', borderRadius:'50%', background:'#f59e0b', color:'#000', fontSize:'9px', fontWeight:'900', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #fff' });
            b.textContent = String(qty > 9 ? '9+' : qty);
            bubble.appendChild(b);
          } else {
            existing.textContent = String(qty > 9 ? '9+' : qty);
          }
        } else if (existing) {
          existing.remove();
        }
      }
      if (type === 'tara-lang-update' && payload) save('tara_lang', payload);
      if (type === 'tara-expand') {
        isExpanded = Boolean(expanded);
        if (isExpanded) { panel.classList.add('expanded'); backdrop.classList.add('v'); }
        else            { panel.classList.remove('expanded'); backdrop.classList.remove('v'); }
      }
    });
  }

  /* ── Entry point ─────────────────────────────────────────────────────────── */
  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  }

})();
