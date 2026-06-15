'use client';

/**
 * app/widget/page.tsx
 *
 * The TARA widget — a compact, iframe-friendly version of the full TARA UI.
 * Designed to live inside the Chrome extension's 420×640 px panel.
 *
 * Layout (top → bottom):
 *   ┌──────────────────────────────┐
 *   │ Widget header  (56 px)       │  TARA ✦ | Lang | Powered by Kapruka | ✕
 *   ├──────────────────────────────┤
 *   │ ChatPanel      (~60 %)       │  Conversation + input bar
 *   ├──────────────────────────────┤
 *   │ ProductPanel   (~40 %)       │  Search result cards
 *   └──────────────────────────────┘
 *   CartDrawer slides up from bottom (inside iframe, not full-screen)
 *
 * URL params (injected by content.js on product pages):
 *   ?context=<productName>&price=<price>&id=<productId>
 *
 * ⚠ Adjust the import paths below to match your actual file locations.
 */

import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams }                                     from 'next/navigation';

// ── Adjust these import paths to match your actual component locations ─────
// The widget reuses ALL existing components — do not duplicate logic.
import ChatPanel    from '@/components/ChatPanel';
import ProductPanel from '@/components/ProductPanel';
import CartDrawer   from '@/components/CartDrawer';
// If you have a language bar component, import it:
// import LanguageBar from '@/components/LanguageBar';
// ──────────────────────────────────────────────────────────────────────────

/** Languages TARA supports */
const LANGUAGES = [
  { code: 'si', label: 'සිං',  flag: '🇱🇰' },
  { code: 'ta', label: 'த',    flag: '🇱🇰' },
  { code: 'tl', label: 'TL',   flag: '🇱🇰' },
  { code: 'en', label: 'EN',   flag: '🇬🇧' },
] as const;

type LangCode = (typeof LANGUAGES)[number]['code'];

// ── Parent-frame communication ─────────────────────────────────────────────
const PARENT_ORIGIN_PATTERN = /^https?:\/\/(localhost:\d+|tara-green\.vercel\.app|.*\.kapruka\.com)$/;

function postToParent(type: string, payload?: unknown) {
  if (window.parent === window) return; // not in iframe
  window.parent.postMessage({ type, payload }, '*');
}

// ── Widget inner component (needs Suspense for useSearchParams) ─────────────
function WidgetInner() {
  const params = useSearchParams();

  const rawContext = params.get('context') ?? '';
  const rawPrice   = params.get('price')   ?? '';
  const rawId      = params.get('id')      ?? '';

  const productContext = rawContext
    ? {
        name:  decodeURIComponent(rawContext),
        price: rawPrice ? decodeURIComponent(rawPrice) : undefined,
        id:    rawId    ? decodeURIComponent(rawId)    : undefined,
      }
    : null;

  const [activeLang, setActiveLang]       = useState<LangCode>('en');
  const [cartOpen,   setCartOpen]         = useState(false);
  const [contextGreeted, setContextGreeted] = useState(false);

  const chatPanelRef = useRef<{ sendMessage?: (msg: string) => void } | null>(null);

  // ── Notify parent we are ready ───────────────────────────────────────────
  useEffect(() => {
    postToParent('tara-ready');

    // Listen for restore payload from extension (cart / lang persistence)
    const handleMessage = (event: MessageEvent) => {
      if (!PARENT_ORIGIN_PATTERN.test(event.origin)) return;
      const { type, payload } = event.data ?? {};
      if (type === 'tara-restore' && payload) {
        if (payload.tara_lang) setActiveLang(payload.tara_lang as LangCode);
        // Cart restoration is handled by CartProvider via payload.tara_cart
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ── Auto-send product context greeting ───────────────────────────────────
  useEffect(() => {
    if (!productContext || contextGreeted) return;
    // Small delay so the chat panel finishes its own init messages first
    const timer = setTimeout(() => {
      setContextGreeted(true);
      // If ChatPanel exposes an imperative ref, use it to send the greeting;
      // otherwise this message should be passed as an `initialMessage` prop.
      chatPanelRef.current?.sendMessage?.(
        `I see you're looking at **${productContext.name}**${
          productContext.price ? ` (${productContext.price})` : ''
        } — want to add it to your order or find something similar? 🛍️`
      );
    }, 800);
    return () => clearTimeout(timer);
  }, [productContext, contextGreeted]);

  // ── Relay cart open state to parent so it can show unread dot ────────────
  const handleCartChange = useCallback((isOpen: boolean) => {
    setCartOpen(isOpen);
  }, []);

  // ── Lang change ──────────────────────────────────────────────────────────
  const handleLangChange = useCallback((lang: LangCode) => {
    setActiveLang(lang);
    postToParent('tara-lang-update', lang);
  }, []);

  // ── Close button → tell extension to slide panel down ───────────────────
  const handleClose = useCallback(() => {
    postToParent('tara-close');
  }, []);

  return (
    <div className="tara-widget-root">
      {/* ── Widget header ─────────────────────────────────────────────────── */}
      <header className="tara-widget-header">
        {/* Logo */}
        <div className="tara-widget-logo" aria-label="TARA AI Retail Agent">
          <span className="tara-widget-logo-t">T</span>
          <span className="tara-widget-logo-name">TARA</span>
          <span className="tara-widget-logo-spark">✦</span>
        </div>

        {/* Language selector */}
        <nav className="tara-widget-langs" aria-label="Select language">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              className={`tara-widget-lang-btn${activeLang === lang.code ? ' active' : ''}`}
              onClick={() => handleLangChange(lang.code)}
              aria-pressed={activeLang === lang.code}
              title={lang.label}
            >
              <span aria-hidden="true">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </nav>

        {/* Powered by */}
        <span className="tara-widget-powered">
          Powered by{' '}
          <a
            href="https://kapruka.com"
            target="_blank"
            rel="noopener noreferrer"
            className="tara-widget-powered-link"
          >
            Kapruka
          </a>
        </span>

        {/* Close */}
        <button
          className="tara-widget-close"
          onClick={handleClose}
          aria-label="Close TARA assistant"
          title="Close"
        >
          ✕
        </button>
      </header>

      {/* ── Main content area ──────────────────────────────────────────────── */}
      <main className="tara-widget-main">
        {/* Chat panel — 60 % of available height */}
        <section className="tara-widget-chat" aria-label="Chat with TARA">
          <ChatPanel
            ref={chatPanelRef}
            language={activeLang}
            widgetMode
            productContext={productContext ?? undefined}
            onMessageSent={() => postToParent('tara-message')}
          />
        </section>

        {/* Product panel — 40 % */}
        <section className="tara-widget-products" aria-label="Product results">
          <ProductPanel
            language={activeLang}
            widgetMode
          />
        </section>
      </main>

      {/* ── Cart drawer (slides up inside iframe) ─────────────────────────── */}
      <CartDrawer
        open={cartOpen}
        onOpenChange={handleCartChange}
        widgetMode
        onCartUpdate={(cart) => postToParent('tara-cart-update', cart)}
      />

      {/* ── Widget-specific styles ─────────────────────────────────────────── */}
      <style>{`
        .tara-widget-root {
          display: flex;
          flex-direction: column;
          height: 100vh;
          height: 100dvh;
          width: 100%;
          overflow: hidden;
          background: #0d0d1a;
          color: #e2e8f0;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          position: relative;
        }

        /* ── Header ──────────────────────────────────────────────────────── */
        .tara-widget-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
          height: 52px;
          flex-shrink: 0;
          background: rgba(13, 13, 26, 0.95);
          border-bottom: 1px solid rgba(251, 191, 36, 0.15);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .tara-widget-logo {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .tara-widget-logo-t {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: #fff;
          font-size: 14px;
          font-weight: 900;
          line-height: 1;
          flex-shrink: 0;
        }

        .tara-widget-logo-name {
          font-size: 13px;
          font-weight: 700;
          color: #f59e0b;
          letter-spacing: 0.04em;
        }

        .tara-widget-logo-spark {
          font-size: 9px;
          color: #f59e0b;
          opacity: 0.7;
          margin-top: -4px;
        }

        /* ── Language bar ─────────────────────────────────────────────────── */
        .tara-widget-langs {
          display: flex;
          gap: 2px;
          flex-shrink: 0;
        }

        .tara-widget-lang-btn {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 3px 6px;
          border: 1px solid transparent;
          border-radius: 12px;
          background: transparent;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          line-height: 1;
        }

        .tara-widget-lang-btn:hover {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
        }

        .tara-widget-lang-btn.active {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.3);
          color: #f59e0b;
        }

        /* ── Powered by ───────────────────────────────────────────────────── */
        .tara-widget-powered {
          margin-left: auto;
          font-size: 10px;
          color: #475569;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .tara-widget-powered-link {
          color: #f59e0b;
          text-decoration: none;
          opacity: 0.8;
        }

        .tara-widget-powered-link:hover {
          opacity: 1;
          text-decoration: underline;
        }

        /* ── Close button ─────────────────────────────────────────────────── */
        .tara-widget-close {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: #64748b;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
          flex-shrink: 0;
        }

        .tara-widget-close:hover {
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
        }

        .tara-widget-close:focus-visible {
          outline: 2px solid #f59e0b;
          outline-offset: 2px;
        }

        /* ── Main content ─────────────────────────────────────────────────── */
        .tara-widget-main {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .tara-widget-chat {
          flex: 6;         /* 60% */
          min-height: 0;
          overflow: hidden;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .tara-widget-products {
          flex: 4;         /* 40% */
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
        }

        /* Thin amber scrollbar */
        .tara-widget-products::-webkit-scrollbar { width: 4px; }
        .tara-widget-products::-webkit-scrollbar-track { background: transparent; }
        .tara-widget-products::-webkit-scrollbar-thumb {
          background: rgba(245, 158, 11, 0.3);
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}

// ── Page export with Suspense boundary ───────────────────────────────────────
// Required in Next.js 14 when using useSearchParams() in a client component.
export default function WidgetPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            height:         '100vh',
            background:     '#0d0d1a',
            color:          '#f59e0b',
            fontFamily:     'system-ui, sans-serif',
            fontSize:       '14px',
            gap:            '10px',
          }}
        >
          {/* Minimal loading spinner */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#f59e0b" strokeWidth="2" strokeDasharray="40" strokeDashoffset="20">
              <animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="0.8s" repeatCount="indefinite"/>
            </circle>
          </svg>
          Loading TARA…
        </div>
      }
    >
      <WidgetInner />
    </Suspense>
  );
}
