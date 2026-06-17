'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ChatPanel    from '@/components/ChatPanel';
import ProductPanel from '@/components/ProductPanel';
import CartDrawer   from '@/components/CartDrawer';
import { CartProvider, useCart, Product } from '@/context/CartContext';
import { Lang, STRINGS } from '@/lib/strings';

function WidgetContent() {
  const [lang,         setLang]         = useState<Lang>('en');
  const [products,     setProducts]     = useState<(Product & { url?: string })[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [quantum,      setQuantum]      = useState(false);
  const [cartOpen,     setCartOpen]     = useState(false);
  const [speakerOn,    setSpeakerOn]    = useState(false);
  const [context,      setContext]      = useState<{ name: string; price?: string } | null>(null);
  const [ctxDismissed, setCtxDismissed] = useState(false);
  const [isInIframe,   setIsInIframe]   = useState(false);
  // null = default 62 %, number = user-dragged percentage
  const [chatPct, setChatPct]           = useState<number | null>(null);

  const containerRef  = useRef<HTMLDivElement>(null);
  const isDragging    = useRef(false);

  const { totalQty }     = useCart();
  const s                = STRINGS[lang];
  const hasProducts      = products.length > 0 || searching;
  const effectiveChatPct = chatPct ?? 62;

  /* ── Iframe detection ───────────────────────────────────────────────────── */
  useEffect(() => {
    try { setIsInIframe(window.self !== window.top); } catch { setIsInIframe(true); }
  }, []);

  /* ── URL params → product context ───────────────────────────────────────── */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const name = p.get('context');
    if (name) setContext({ name, price: p.get('price') ?? undefined });
  }, []);

  /* ── Signal readiness & listen for parent messages ──────────────────────── */
  useEffect(() => {
    try { window.parent.postMessage({ type: 'tara-ready' }, '*'); } catch { /* ok */ }

    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'tara-lang-update' && e.data.lang)
        setLang(e.data.lang as Lang);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  /* ── Relay cart qty to extension bubble badge ───────────────────────────── */
  useEffect(() => {
    try { window.parent.postMessage({ type: 'tara-cart-update', qty: totalQty }, '*'); }
    catch { /* ok */ }
  }, [totalQty]);

  /* ── Close ──────────────────────────────────────────────────────────────── */
  /*
     FIX: When accessed directly (tara-green.vercel.app/widget) window.parent
     === window, so postMessage goes nowhere. Detect that case and navigate home.
  */
  const handleClose = useCallback(() => {
    if (isInIframe) {
      try { window.parent.postMessage({ type: 'tara-close' }, '*'); } catch { /* ok */ }
    } else {
      window.location.href = '/';
    }
  }, [isInIframe]);

  /* ── Product callbacks ──────────────────────────────────────────────────── */
  const handleProducts = useCallback((p: (Product & { url?: string })[], q = false) => {
    setProducts(p);
    setQuantum(q);
  }, []);

  const clearProducts = useCallback(() => {
    setProducts([]);
    setSearching(false);
    setQuantum(false);
  }, []);

  /* ── Drag-resize handle (mouse) ─────────────────────────────────────────── */
  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct  = ((ev.clientY - rect.top) / rect.height) * 100;
      setChatPct(Math.min(78, Math.max(22, Math.round(pct))));
    };

    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor     = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  }, []);

  /* ── Drag-resize handle (touch) ─────────────────────────────────────────── */
  const startTouchDrag = useCallback((e: React.TouchEvent) => {
    const onMove = (ev: TouchEvent) => {
      if (!containerRef.current) return;
      const touch = ev.touches[0];
      const rect  = containerRef.current.getBoundingClientRect();
      const pct   = ((touch.clientY - rect.top) / rect.height) * 100;
      setChatPct(Math.min(78, Math.max(22, Math.round(pct))));
    };
    const onEnd = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend',  onEnd);
    };
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend',  onEnd);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
            <span className="text-slate-900 text-xs font-black">T</span>
          </div>
          <span className="text-white font-bold text-sm">TARA ✦</span>
          {context && !ctxDismissed && (
            <span className="text-xs bg-amber-400/20 text-amber-400 border border-amber-400/30 px-2 py-0.5 rounded-full whitespace-nowrap">
              Kapruka ✓
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Cart */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-1 text-slate-400 hover:text-amber-400 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M1 1h2.5L5.5 9h7L15 4H4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="7.5"  cy="13" r="1.2" fill="currentColor"/>
              <circle cx="11.5" cy="13" r="1.2" fill="currentColor"/>
            </svg>
            <span className="text-xs font-medium">{s.cartBtn}</span>
            {totalQty > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-slate-900 text-xs font-black rounded-full flex items-center justify-center">
                {totalQty > 9 ? '9+' : totalQty}
              </span>
            )}
          </button>

          {/* Close — navigates home when opened directly, closes panel when in iframe */}
          <button
            onClick={handleClose}
            title={isInIframe ? 'Close' : 'Back to home'}
            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Product context banner ─────────────────────────────────────────── */}
      {context && !ctxDismissed && (
        <div className="flex-shrink-0 bg-amber-400/10 border-b border-amber-400/20 px-4 py-2 flex items-center gap-2">
          <span className="text-amber-400 text-xs" aria-hidden="true">📦</span>
          <p className="text-xs text-amber-300 flex-1 leading-snug line-clamp-1 min-w-0">
            <span className="font-semibold">{context.name}</span>
            {context.price && <span className="text-slate-400 ml-1">· {context.price}</span>}
          </p>
          <button
            onClick={() => setCtxDismissed(true)}
            className="text-slate-500 hover:text-slate-300 text-xs flex-shrink-0 p-1"
          >✕</button>
        </div>
      )}

      {/* ── Resizable content area ────────────────────────────────────────── */}
      {/*
          Layout:
            No products  → chat fills 100 % of remaining height
            Has products → split at effectiveChatPct (default 62 %)
                           user can drag the handle between them
      */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
        style={{ userSelect: isDragging.current ? 'none' : undefined }}
      >
        {/* Chat panel */}
        <div
          className="min-h-0 overflow-hidden"
          style={{ height: hasProducts ? `${effectiveChatPct}%` : '100%' }}
        >
          <ChatPanel
            lang={lang}
            onLangChange={setLang}
            onProductsFound={handleProducts}
            onSearching={setSearching}
            speakerOn={speakerOn}
            onSpeakerToggle={() => setSpeakerOn(v => !v)}
          />
        </div>

        {/* ── Drag handle (only when products are visible) ───────────────── */}
        {hasProducts && (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Drag to resize chat and products panels"
            onMouseDown={startDrag}
            onTouchStart={startTouchDrag}
            className="flex-shrink-0 h-3 bg-slate-900 border-y border-slate-800/80 flex items-center justify-center cursor-row-resize group z-10 relative select-none"
          >
            {/* Five grip dots — visually indicate draggability */}
            <div className="flex items-center gap-[3px]">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="w-3.5 h-[2px] rounded-full bg-slate-700 group-hover:bg-amber-400/60 transition-colors duration-150"
                />
              ))}
            </div>
            {/* ↕ hint that fades in on hover */}
            <span className="absolute right-3 text-[9px] text-slate-600 group-hover:text-amber-400/60 transition-colors select-none pointer-events-none">
              ↕
            </span>
          </div>
        )}

        {/* Products panel */}
        {hasProducts && (
          <div
            className="flex flex-col min-h-0"
            style={{ height: `${100 - effectiveChatPct}%` }}
          >
            {/* Products sub-header */}
            <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800/60">
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                {searching ? (
                  <>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"
                        strokeDasharray="20" strokeDashoffset="10">
                        <animateTransform attributeName="transform" type="rotate"
                          from="0 6 6" to="360 6 6" dur="0.75s" repeatCount="indefinite"/>
                      </circle>
                    </svg>
                    Searching…
                  </>
                ) : (
                  <>
                    {products.length} result{products.length !== 1 ? 's' : ''}
                    {quantum && <span className="text-purple-400 ml-1">⚛</span>}
                  </>
                )}
              </span>

              {!searching && (
                <button
                  onClick={clearProducts}
                  title="Clear search results"
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 hover:bg-red-400/10 px-2 py-0.5 rounded-md transition-colors"
                >
                  Clear
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Product cards */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ProductPanel
                products={products}
                lang={lang}
                loading={searching}
                quantum={quantum}
              />
            </div>
          </div>
        )}
      </div>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} lang={lang} />
    </div>
  );
}

export default function WidgetPage() {
  return (
    <CartProvider>
      <WidgetContent />
    </CartProvider>
  );
}
