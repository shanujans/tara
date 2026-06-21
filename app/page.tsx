'use client';
import { useState, useCallback } from 'react';
import ChatPanel from '@/components/ChatPanel';
import ProductPanel from '@/components/ProductPanel';
import CartDrawer from '@/components/CartDrawer';
import TaraBackground from '@/components/TaraBackground';
import SplashScreen from '@/components/SplashScreen';
import { CartProvider, useCart, Product } from '@/context/CartContext';
import { STRINGS, Lang } from '@/lib/strings';

const LANG_KEYS: Lang[]                 = ['si', 'sl', 'ta', 'tl', 'en'];
const LANG_LABELS: Record<Lang, string> = {
  si: '🇱🇰 සිං', sl: '🇱🇰 SL', ta: '🇱🇰 த', tl: '🇱🇰 TL', en: '🇬🇧 EN',
};

/* ── shared inline style objects ──────────────────────────────── */
const BORDER_COLOR = 'rgba(107, 77, 171, 0.42)';

function AppContent() {
  const [lang,       setLang]       = useState<Lang>('en');
  const [products,   setProducts]   = useState<(Product & { url?: string })[]>([]);
  const [searching,  setSearching]  = useState(false);
  const [quantum,    setQuantum]    = useState(false);
  const [cartOpen,   setCartOpen]   = useState(false);
  const [speakerOn,  setSpeakerOn]  = useState(false);
  const [tab,        setTab]        = useState<'chat' | 'products'>('chat');
  const { totalQty } = useCart();
  const s = STRINGS[lang];

  const handleProducts = useCallback((p: (Product & { url?: string })[], q = false) => {
    setProducts(p);
    setQuantum(q);
    if (p.length > 0) setTab('products');
  }, []);

  return (
    <>
      <div className="flex flex-col overflow-hidden" style={{ height: '100dvh' }}>

        {/* ── Animated aurora background ──────────────────────── */}
        <TaraBackground />

        {/* ── Header ─────────────────────────────────────────── */}
        <header
          className="flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-20"
          style={{
            height: 60,
            background: 'rgba(5,3,15,0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: `1px solid ${BORDER_COLOR}`,
          }}
        >
          {/* Brand */}
          <div className="flex items-center gap-3">
            {/* T avatar */}
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg,#f97316,#f59e0b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ color: 'white', fontWeight: 900, fontSize: '0.8rem' }}>T</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span style={{
                fontFamily: 'var(--font-jakarta,"Plus Jakarta Sans",sans-serif)',
                fontWeight: 800, fontSize: '1.15rem',
                color: '#F5E9E2', letterSpacing: '-0.02em',
              }}>TARA</span>
              <span style={{
                background: 'linear-gradient(90deg,#FAE555,#F5A623)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 800, fontSize: '1.1rem',
              }}>✦</span>
              <span className="hidden sm:block" style={{ color: '#8878a0', fontSize: '0.8rem' }}>
                AI Retail Agent
              </span>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

            {/* Segmented lang control — desktop, using inline styles for guaranteed render */}
            <div className="hidden sm:flex" style={{
              background: 'rgba(10,6,32,0.70)',
              border: `1px solid ${BORDER_COLOR}`,
              borderRadius: 9999,
              overflow: 'hidden',
            }}>
              {LANG_KEYS.map((k, idx) => (
                <button key={k} onClick={() => setLang(k)}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.68rem',
                    fontWeight: lang === k ? 700 : 600,
                    color: lang === k ? '#fff' : '#8878a0',
                    background: lang === k
                      ? 'linear-gradient(135deg,#402970,#6b4dab)'
                      : 'transparent',
                    borderRight: idx < LANG_KEYS.length - 1 ? `1px solid ${BORDER_COLOR}` : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}>
                  {LANG_LABELS[k]}
                </button>
              ))}
            </div>

            {/* Speaker */}
            <button onClick={() => setSpeakerOn(v => !v)}
              title={speakerOn ? 'Mute' : 'Unmute'}
              style={{
                width: 34, height: 34,
                borderRadius: '50%',
                background: 'rgba(26,18,58,0.70)',
                border: `1px solid ${BORDER_COLOR}`,
                color: speakerOn ? '#FAE555' : '#8878a0',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}>
              {speakerOn ? '🔊' : '🔇'}
            </button>

            {/* Cart */}
            <button onClick={() => setCartOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px',
                borderRadius: 9999,
                background: 'rgba(26,18,58,0.70)',
                border: `1px solid ${BORDER_COLOR}`,
                color: '#c9b8d8',
                fontSize: '0.8rem', fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
                position: 'relative',
                transition: 'all 0.15s ease',
              }}>
              <span>🛒</span>
              <span className="hidden sm:inline">{s.cartBtn}</span>
              {totalQty > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#402970,#6b4dab)',
                  color: 'white',
                  fontSize: '0.62rem', fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {totalQty > 9 ? '9+' : totalQty}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* ── Main ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* Chat panel — the glass sidebar */}
          <div
            className={`flex-col overflow-hidden md:flex md:flex-shrink-0 ${
              tab === 'chat' ? 'flex w-full' : 'hidden'
            }`}
            style={{
              width: undefined,
              /* desktop width via md class isn't available here, use max-content trick */
            }}
          >
            {/* Inner wrapper handles the glass + border */}
            <div style={{
              display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
              background: 'rgba(8,5,22,0.80)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRight: `1px solid ${BORDER_COLOR}`,
              boxShadow: `4px 0 32px rgba(0,0,0,0.40)`,
              /* Fixed sidebar width on desktop */
              minWidth: 0,
            }}
              className="w-full md:w-[400px] lg:w-[420px]"
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
          </div>

          {/* Products panel */}
          <div
            className={`flex-col overflow-hidden flex-1 md:flex ${
              tab === 'products' ? 'flex w-full' : 'hidden'
            }`}
            style={{ background: 'rgba(5,3,15,0.30)' }}
          >
            <ProductPanel
              products={products}
              lang={lang}
              loading={searching}
              quantum={quantum}
            />
          </div>
        </div>

        {/* ── Mobile tab bar ─────────────────────────────────── */}
        <div
          className="md:hidden flex flex-shrink-0"
          style={{
            background: 'rgba(5,3,15,0.93)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderTop: `1px solid ${BORDER_COLOR}`,
            paddingBottom: 'env(safe-area-inset-bottom,0px)',
          }}
        >
          <MobileTab icon="💬" label="Chat"     active={tab === 'chat'}     onClick={() => setTab('chat')} />
          <MobileTab icon="🛍️" label="Products" active={tab === 'products'} onClick={() => setTab('products')}
            badge={products.length > 0 ? products.length : undefined} />
        </div>

        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} lang={lang} />
      </div>
    </>
  );
}

function MobileTab({
  icon, label, active, onClick, badge,
}: { icon: string; label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button onClick={onClick}
      style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingTop: 10, paddingBottom: 6, gap: 3,
        color: active ? '#c7abff' : '#52436a',
        cursor: 'pointer',
        position: 'relative',
        transition: 'color 0.18s ease',
        background: 'transparent',
        border: 'none',
      }}>
      <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: '0.67rem', fontWeight: 600, letterSpacing: '0.01em' }}>{label}</span>
      {active && (
        <div style={{
          width: 20, height: 3, borderRadius: 2,
          background: 'linear-gradient(90deg,#402970,#6b4dab)',
          marginTop: 2,
        }} />
      )}
      {badge !== undefined && (
        <span style={{
          position: 'absolute', top: 8, right: 'calc(50% - 24px)',
          width: 16, height: 16, borderRadius: '50%',
          background: 'linear-gradient(135deg,#402970,#6b4dab)',
          color: 'white',
          fontSize: '0.6rem', fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

// ── Root: splash gate — AppContent never mounts until splash completes ──
export default function Home() {
  const [ready, setReady] = useState(false);

  if (!ready) {
    return <SplashScreen onDone={() => setReady(true)} />;
  }

  return <CartProvider><AppContent /></CartProvider>;
}
