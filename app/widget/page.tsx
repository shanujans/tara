'use client';
import { useState, useEffect } from 'react';
import ChatPanel    from '@/components/ChatPanel';
import ProductPanel from '@/components/ProductPanel';
import CartDrawer   from '@/components/CartDrawer';
import { CartProvider, useCart, Product } from '@/context/CartContext';
import { Lang, STRINGS } from '@/lib/strings';

function WidgetContent() {
  const [lang,      setLang]      = useState<Lang>('en');
  const [products,  setProducts]  = useState<(Product & { url?: string })[]>([]);
  const [searching, setSearching] = useState(false);
  const [quantum,   setQuantum]   = useState(false);
  const [cartOpen,  setCartOpen]  = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [context,   setContext]   = useState<{ name: string; price?: string } | null>(null);
  const [ctxDismissed, setCtxDismissed] = useState(false);
  const { totalQty } = useCart();
  const s = STRINGS[lang];

  // Read product context from URL params (injected by Chrome extension)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const name = p.get('context');
    if (name) setContext({ name, price: p.get('price') ?? undefined });
  }, []);

  // Tell parent iframe is ready
  useEffect(() => {
    try { window.parent.postMessage({ type: 'tara-ready' }, '*'); } catch { /* */ }
  }, []);

  // Relay cart count to bubble badge
  useEffect(() => {
    try { window.parent.postMessage({ type: 'tara-cart-update', qty: totalQty }, '*'); } catch { /* */ }
  }, [totalQty]);

  // Accept language sync from parent
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'tara-lang-update' && e.data.lang) setLang(e.data.lang as Lang);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleClose = () => {
    try { window.parent.postMessage({ type: 'tara-close' }, '*'); } catch { /* */ }
  };

  const handleProducts = (p: (Product & { url?: string })[], q = false) => {
    setProducts(p); setQuantum(q);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">

      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <span className="text-slate-900 text-xs font-black">T</span>
          </div>
          <span className="text-white font-bold text-sm">TARA ✦</span>
          {context && !ctxDismissed && (
            <span className="text-xs bg-amber-400/20 text-amber-400 border border-amber-400/30 px-2 py-0.5 rounded-full">
              Kapruka ✓
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-1 text-slate-400 hover:text-amber-400 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M1 1h2.5L5.5 9h7L15 4H4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="7.5" cy="13" r="1.2" fill="currentColor"/>
              <circle cx="11.5" cy="13" r="1.2" fill="currentColor"/>
            </svg>
            <span className="text-xs font-medium">{s.cartBtn}</span>
            {totalQty > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-slate-900 text-xs font-black rounded-full flex items-center justify-center">
                {totalQty > 9 ? '9+' : totalQty}
              </span>
            )}
          </button>
          <button onClick={handleClose}
            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Close">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Product context banner */}
      {context && !ctxDismissed && (
        <div className="flex-shrink-0 bg-amber-400/10 border-b border-amber-400/20 px-4 py-2 flex items-center gap-2">
          <span className="text-amber-400 text-xs">📦</span>
          <p className="text-xs text-amber-300 flex-1 leading-snug line-clamp-1">
            <span className="font-semibold">{context.name}</span>
            {context.price && <span className="text-slate-400 ml-1">· Rs. {context.price}</span>}
          </p>
          <button onClick={() => setCtxDismissed(true)} className="text-slate-500 hover:text-slate-300 text-xs flex-shrink-0">✕</button>
        </div>
      )}

      {/* Chat panel */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatPanel
          lang={lang}
          onLangChange={setLang}
          onProductsFound={handleProducts}
          onSearching={setSearching}
          speakerOn={speakerOn}
          onSpeakerToggle={() => setSpeakerOn(v => !v)}
        />
      </div>

      {/* Products strip — shown only when results exist */}
      {(products.length > 0 || searching) && (
        <div className="flex-shrink-0 h-64 border-t border-slate-800 overflow-hidden">
          <ProductPanel products={products} lang={lang} loading={searching} quantum={quantum} />
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} lang={lang} />
    </div>
  );
}

export default function WidgetPage() {
  return <CartProvider><WidgetContent /></CartProvider>;
}
