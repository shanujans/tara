'use client';

/**
 * app/widget/page.tsx  v2
 *
 * Changes from v1:
 *  • Uses ONLY real prop interfaces (lang/onLangChange/onProductsFound/onSearching/
 *    speakerOn/onSpeakerToggle for ChatPanel; products/lang/loading/quantum for
 *    ProductPanel; open/onClose/lang for CartDrawer)
 *  • Expand/Collapse toggle button → sends tara-expand postMessage to content.js
 *    which resizes the panel to 75 % of the viewport
 *  • Product strip is no longer fixed h-64 — it flexes with the available space:
 *      No products : Chat  = flex-1  (100 %)
 *      Has products: Chat  = flex-[3] (~60 %), Products = flex-[2] (~40 %)
 *  • "Clear ✕" button in the products sub-header dismisses results entirely
 *  • Searching spinner shown inline in the products sub-header
 */

import { useState, useEffect, useCallback } from 'react';
import ChatPanel    from '@/components/ChatPanel';
import ProductPanel from '@/components/ProductPanel';
import CartDrawer   from '@/components/CartDrawer';
import { CartProvider, useCart, Product } from '@/context/CartContext';
import { Lang, STRINGS } from '@/lib/strings';

// ── Expand / Compress icon SVGs ───────────────────────────────────────────────
function ExpandIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M1 4.5V1.5h3M11 4.5V1.5H8M1 7.5v3h3M11 7.5v3H8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CompressIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M4 1.5v3H1M8 1.5v3h3M4 10.5v-3H1M8 10.5v-3h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Spinner for "searching" state ─────────────────────────────────────────────
function Spinner() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="10">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 6 6"
          to="360 6 6"
          dur="0.75s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

// ── Inner widget (needs CartProvider above) ────────────────────────────────────
function WidgetContent() {
  const [lang,         setLang]         = useState<Lang>('en');
  const [products,     setProducts]     = useState<(Product & { url?: string })[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [quantum,      setQuantum]      = useState(false);
  const [cartOpen,     setCartOpen]     = useState(false);
  const [speakerOn,    setSpeakerOn]    = useState(false);
  const [context,      setContext]      = useState<{ name: string; price?: string } | null>(null);
  const [ctxDismissed, setCtxDismissed] = useState(false);
  const [expanded,     setExpanded]     = useState(false);

  const { totalQty } = useCart();
  const s = STRINGS[lang];

  const hasProducts = products.length > 0 || searching;

  // ── URL params → product context (set by Chrome extension) ─────────────────
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const name = p.get('context');
    if (name) setContext({ name, price: p.get('price') ?? undefined });
  }, []);

  // ── Announce readiness to parent ─────────────────────────────────────────
  useEffect(() => {
    try { window.parent.postMessage({ type: 'tara-ready' }, '*'); } catch { /* ok */ }
  }, []);

  // ── Relay cart qty to bubble badge ────────────────────────────────────────
  useEffect(() => {
    try { window.parent.postMessage({ type: 'tara-cart-update', qty: totalQty }, '*'); } catch { /* ok */ }
  }, [totalQty]);

  // ── Relay expand state to parent so it can resize the panel ───────────────
  useEffect(() => {
    try { window.parent.postMessage({ type: 'tara-expand', expanded }, '*'); } catch { /* ok */ }
  }, [expanded]);

  // ── Accept messages from parent (language sync, etc.) ─────────────────────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data) return;
      if (e.data.type === 'tara-lang-update' && e.data.lang) {
        setLang(e.data.lang as Lang);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ── Button handlers ───────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    // If expanded, collapse first; the panel will animate down after
    if (expanded) setExpanded(false);
    try { window.parent.postMessage({ type: 'tara-close' }, '*'); } catch { /* ok */ }
  }, [expanded]);

  const handleProducts = useCallback(
    (p: (Product & { url?: string })[], q = false) => {
      setProducts(p);
      setQuantum(q);
    },
    []
  );

  /** Remove all product results — user can return to pure chat view */
  const clearProducts = useCallback(() => {
    setProducts([]);
    setSearching(false);
    setQuantum(false);
  }, []);

  const toggleExpand = useCallback(() => setExpanded(v => !v), []);

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {/* Logo */}
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
            <span className="text-slate-900 text-xs font-black">T</span>
          </div>
          <span className="text-white font-bold text-sm">TARA ✦</span>

          {/* Kapruka context pill */}
          {context && !ctxDismissed && (
            <span className="text-xs bg-amber-400/20 text-amber-400 border border-amber-400/30 px-2 py-0.5 rounded-full whitespace-nowrap">
              Kapruka ✓
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Cart button */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-1 text-slate-400 hover:text-amber-400 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path
                d="M1 1h2.5L5.5 9h7L15 4H4.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="7.5"  cy="13" r="1.2" fill="currentColor" />
              <circle cx="11.5" cy="13" r="1.2" fill="currentColor" />
            </svg>
            <span className="text-xs font-medium">{s.cartBtn}</span>
            {totalQty > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-slate-900 text-xs font-black rounded-full flex items-center justify-center">
                {totalQty > 9 ? '9+' : totalQty}
              </span>
            )}
          </button>

          {/* Expand / Compress toggle */}
          <button
            onClick={toggleExpand}
            title={expanded ? 'Compact view' : 'Expand to full panel'}
            className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            {expanded ? <CompressIcon /> : <ExpandIcon />}
          </button>

          {/* Close */}
          <button
            onClick={handleClose}
            title="Close"
            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Product context banner ─────────────────────────────────────── */}
      {context && !ctxDismissed && (
        <div className="flex-shrink-0 bg-amber-400/10 border-b border-amber-400/20 px-4 py-2 flex items-center gap-2">
          <span className="text-amber-400 text-xs" aria-hidden="true">📦</span>
          <p className="text-xs text-amber-300 flex-1 leading-snug line-clamp-1 min-w-0">
            <span className="font-semibold">{context.name}</span>
            {context.price && (
              <span className="text-slate-400 ml-1">· {context.price}</span>
            )}
          </p>
          <button
            onClick={() => setCtxDismissed(true)}
            className="text-slate-500 hover:text-slate-300 text-xs flex-shrink-0 p-1"
            aria-label="Dismiss context banner"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Main content area ──────────────────────────────────────────── */}
      {/*
          Layout logic:
            No products  → Chat takes entire remaining space (flex-1)
            Has products → Chat: flex-[3] (~60 %)  |  Products: flex-[2] (~40 %)

          This proportional split works at any panel height: compact (640 px)
          or expanded (88 vh), giving more room for products when the panel grows.
      */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

        {/* Chat panel */}
        <div
          className={[
            'min-h-0 overflow-hidden transition-[flex] duration-300',
            hasProducts ? 'flex-[3]' : 'flex-1',
          ].join(' ')}
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

        {/* Products panel — only when there are results or a search is running */}
        {hasProducts && (
          <div className="flex-[2] min-h-0 flex flex-col border-t border-slate-800">

            {/* Products sub-header with status + clear button */}
            <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800/60">
              <span className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
                {searching ? (
                  <>
                    <Spinner />
                    <span>Searching…</span>
                  </>
                ) : (
                  <>
                    <span>
                      {products.length} result{products.length !== 1 ? 's' : ''}
                    </span>
                    {quantum && (
                      <span className="text-purple-400 font-medium">⚛ Quantum</span>
                    )}
                  </>
                )}
              </span>

              {/* Clear button — hides the products strip entirely */}
              {!searching && (
                <button
                  onClick={clearProducts}
                  title="Clear search results"
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 hover:bg-red-400/10 px-2 py-0.5 rounded-md transition-colors flex-shrink-0 ml-2"
                >
                  <span>Clear</span>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                    <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

      {/* ── Cart drawer ──────────────────────────────────────────────── */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        lang={lang}
      />
    </div>
  );
}

// ── Page export ────────────────────────────────────────────────────────────────
export default function WidgetPage() {
  return (
    <CartProvider>
      <WidgetContent />
    </CartProvider>
  );
}
