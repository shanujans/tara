'use client';
import { useState } from 'react';
import ChatPanel from '@/components/ChatPanel';
import ProductPanel from '@/components/ProductPanel';
import CartDrawer from '@/components/CartDrawer';
import { CartProvider, useCart, Product } from '@/context/CartContext';
import { STRINGS, Lang } from '@/lib/strings';

function AppContent() {
  const [lang, setLang] = useState<Lang>('en');
  const [products, setProducts] = useState<Product[]>([]);
  const [quantum, setQuantum] = useState(false);
  const [searching, setSearching] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const { totalQty } = useCart();
  const s = STRINGS[lang];

  const handleProducts = (p: Product[], q = false) => {
    setProducts(p);
    setQuantum(q);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden font-[family-name:var(--font-geist-sans)]">
      {/* ── Header ── */}
      <header className="bg-slate-900 border-b border-slate-800 px-5 py-3 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-white font-black text-xl tracking-tight">
            TARA <span className="text-amber-400">✦</span>
          </span>
          <span className="hidden sm:block text-slate-500 text-xs border-l border-slate-700 pl-3">
            The AI Retail Agent
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Language badge */}
          <div className="bg-slate-800 border border-slate-700 px-3 py-1 rounded-full">
            <span className="text-amber-400 text-xs font-bold">{s.langBadge}</span>
          </div>

          {/* Kapruka powered badge */}
          <span className="hidden md:block text-slate-500 text-xs">
            Powered by{' '}
            <span className="text-slate-400 font-semibold">Kapruka</span>
          </span>

          {/* Cart button */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-400/50 px-3 py-1.5 rounded-full transition-all duration-200 group"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M1 1.5h2l2.5 8h6.5l2-5.5H5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-amber-400 transition-colors"/>
              <circle cx="7" cy="13" r="1" fill="#94a3b8" className="group-hover:fill-amber-400 transition-colors"/>
              <circle cx="11" cy="13" r="1" fill="#94a3b8" className="group-hover:fill-amber-400 transition-colors"/>
            </svg>
            <span className="text-slate-300 text-xs font-medium group-hover:text-amber-400 transition-colors">
              {s.cartBtn}
            </span>
            {totalQty > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 text-slate-900 text-xs font-black rounded-full flex items-center justify-center leading-none">
                {totalQty > 9 ? '9+' : totalQty}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Split layout ── */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Chat — 40% on desktop, full on mobile */}
        <div className="w-full md:w-[40%] flex-shrink-0 h-[50vh] md:h-full overflow-hidden">
          <ChatPanel
            lang={lang}
            onLangChange={setLang}
            onProductsFound={handleProducts}
            onSearching={setSearching}
          />
        </div>

        {/* Products — 60% on desktop, full on mobile */}
        <div className="w-full md:w-[60%] flex-1 overflow-hidden">
          <ProductPanel
            products={products}
            lang={lang}
            loading={searching}
            quantum={quantum}
          />
        </div>
      </div>

      {/* Cart Drawer */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        lang={lang}
      />
    </div>
  );
}

export default function Home() {
  return (
    <CartProvider>
      <AppContent />
    </CartProvider>
  );
}