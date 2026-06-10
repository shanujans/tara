'use client';
import { useState } from 'react';
import ChatPanel from '@/components/ChatPanel';
import ProductPanel from '@/components/ProductPanel';
import CartDrawer from '@/components/CartDrawer';
import { CartProvider, useCart, Product } from '@/context/CartContext';
import { STRINGS, Lang } from '@/lib/strings';

const LANG_FLAGS: { key: Lang; label: string; active: string }[] = [
  { key: 'si', label: '🇱🇰 සිං', active: 'bg-green-600 text-white' },
  { key: 'ta', label: '🇱🇰 த',   active: 'bg-orange-500 text-white' },
  { key: 'tl', label: '🇱🇰 TL',  active: 'bg-amber-400 text-slate-900' },
  { key: 'en', label: '🇬🇧 EN',  active: 'bg-blue-600 text-white' },
];

function AppContent() {
  const [lang,      setLang]      = useState<Lang>('en');
  const [products,  setProducts]  = useState<(Product & { url?: string })[]>([]);
  const [searching, setSearching] = useState(false);
  const [quantum,   setQuantum]   = useState(false);
  const [cartOpen,  setCartOpen]  = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [tab,       setTab]       = useState<'chat' | 'products'>('chat');
  const { totalQty } = useCart();
  const s = STRINGS[lang];

  const handleProducts = (p: (Product & { url?: string })[], q = false) => {
    setProducts(p);
    setQuantum(q);
    // Auto-switch to products tab on mobile when results arrive
    if (p.length > 0) setTab('products');
  };

  const currentFlag = LANG_FLAGS.find(f => f.key === lang) ?? LANG_FLAGS[3];

  return (
    <div className="flex flex-col bg-slate-950 overflow-hidden" style={{ height: '100dvh' }}>

      {/* ── Header ── */}
      <header className="bg-slate-900 border-b border-slate-800 px-3 md:px-4 py-2.5 flex items-center justify-between flex-shrink-0 z-10 gap-2">
        {/* Brand */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-white font-black text-lg tracking-tight">
            TARA <span className="text-amber-400">✦</span>
          </span>
          <span className="hidden sm:block text-slate-500 text-xs border-l border-slate-700 pl-2">
            AI Retail Agent
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          {/* Language switcher — scrollable on mobile */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-full overflow-hidden divide-x divide-slate-700 flex-shrink-0">
            {LANG_FLAGS.map(({ key, label, active }) => (
              <button key={key} onClick={() => setLang(key)}
                className={`px-2 py-1 text-xs font-bold transition-all duration-200 whitespace-nowrap ${lang === key ? active : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Speaker */}
          <button onClick={() => setSpeakerOn(v => !v)}
            className="w-8 h-8 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full flex items-center justify-center transition-all flex-shrink-0"
            title={speakerOn ? 'Mute' : 'Unmute'}>
            {speakerOn
              ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 4.5h3l4-3v11l-4-3H1V4.5z" fill="#f59e0b"/><path d="M10 4a4 4 0 010 6" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/></svg>
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 4.5h3l4-3v11l-4-3H1V4.5z" stroke="#64748b" strokeWidth="1.5" strokeLinejoin="round"/><line x1="10.5" y1="5" x2="13" y2="9" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/><line x1="13" y1="5" x2="10.5" y2="9" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/></svg>
            }
          </button>

          {/* Cart */}
          <button onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-400/50 px-2.5 py-1.5 rounded-full transition-all group flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1h2l2.5 8h6L14 4H4" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-amber-400 transition-colors"/>
              <circle cx="7" cy="12.5" r="1" fill="#94a3b8" className="group-hover:fill-amber-400 transition-colors"/>
              <circle cx="11" cy="12.5" r="1" fill="#94a3b8" className="group-hover:fill-amber-400 transition-colors"/>
            </svg>
            <span className="text-slate-300 text-xs font-medium group-hover:text-amber-400 transition-colors hidden sm:block">{s.cartBtn}</span>
            {totalQty > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 text-slate-900 text-xs font-black rounded-full flex items-center justify-center leading-none">
                {totalQty > 9 ? '9+' : totalQty}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Main — desktop: side-by-side, mobile: tabbed ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Chat panel */}
        <div className={`flex-col overflow-hidden md:flex md:w-[40%] md:flex-shrink-0 md:border-r md:border-slate-800 ${tab === 'chat' ? 'flex w-full' : 'hidden'}`}>
          <ChatPanel
            lang={lang}
            onLangChange={setLang}
            onProductsFound={handleProducts}
            onSearching={setSearching}
            speakerOn={speakerOn}
            onSpeakerToggle={() => setSpeakerOn(v => !v)}
          />
        </div>

        {/* Products panel */}
        <div className={`flex-col overflow-hidden md:flex md:flex-1 ${tab === 'products' ? 'flex w-full' : 'hidden'}`}>
          <ProductPanel
            products={products}
            lang={lang}
            loading={searching}
            quantum={quantum}
          />
        </div>
      </div>

      {/* ── Mobile tab bar ── */}
      <div className="md:hidden flex border-t border-slate-800 bg-slate-900 flex-shrink-0">
        <button
          onClick={() => setTab('chat')}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-xs font-semibold transition-colors ${tab === 'chat' ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 3h14a1 1 0 011 1v8a1 1 0 01-1 1H5l-4 3V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          Chat
        </button>
        <button
          onClick={() => setTab('products')}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-xs font-semibold transition-colors relative ${tab === 'products' ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M1 1h3l2.5 10h8L17 5H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="8" cy="16" r="1.5" fill="currentColor"/>
            <circle cx="14" cy="16" r="1.5" fill="currentColor"/>
          </svg>
          Products
          {products.length > 0 && (
            <span className="absolute top-1.5 right-5 bg-amber-400 text-slate-900 text-xs font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">
              {products.length > 9 ? '9+' : products.length}
            </span>
          )}
        </button>
      </div>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} lang={lang} />
    </div>
  );
}

export default function Home() {
  return <CartProvider><AppContent /></CartProvider>;
}
