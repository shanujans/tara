'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useReportWebVitals } from 'next/web-vitals';
import dynamic from 'next/dynamic';
import ChatPanel from '@/components/ChatPanel';
import ProductPanel from '@/components/ProductPanel';
import CartDrawer from '@/components/CartDrawer';
import TaraBackground from '@/components/TaraBackground';
import SidePanel, { PanelId } from '@/components/SidePanel';
import SidebarShader from '@/components/SidebarShader';
import LoginModal, { UserInfo } from '@/components/LoginModal';
import Toast from '@/components/Toast';
import { CartProvider, useCart, Product } from '@/context/CartContext';
import { STRINGS, Lang } from '@/lib/strings';
import {
  HomeIcon, HistoryIcon, RewardsIcon, BrowseIcon, CartIcon,
PackageSearchIcon,
  SettingsIcon, HelpIcon, BellIcon, MenuIcon,
  ChatIcon, BagIcon, SparkleIcon, StoreIcon, HeadsetIcon,
} from '@/components/Icons';

// Client-only: SplashScreen uses Math.random() for its star field, plus
// window/WebGL APIs. Rendering it on the server would bake one random
// layout into the HTML, then swap to a different one on hydration —
// exactly the "didn't match" hydration error. ssr:false skips the server
// pass entirely, so it only ever renders (and randomizes) once, client-side.
const SplashScreen = dynamic(() => import('@/components/SplashScreen'), {
  ssr: false,
});

type MobileTab = 'chat' | 'products' | 'discover' | 'menu';
type NavKey    = 'home' | 'history' | 'rewards' | 'browse' | 'settings' | 'help' | 'manual';

const NAV_ITEMS: { key: NavKey; label: string; icon: React.ReactNode }[] = [
  { key:'home',    label:'Home',    icon:<HomeIcon    size={20}/> },
  { key:'history', label:'History', icon:<HistoryIcon size={20}/> },
  { key:'rewards', label:'Rewards', icon:<RewardsIcon size={20}/> },
  { key:'browse',  label:'Browse',  icon:<BrowseIcon  size={20}/> },
  { key:'manual',  label:'Manual',  icon:<span style={{fontSize:18}}>📖</span> },
];

/* ── Sidebar with the exact spec shader as background ──────── */
const TEXT_COLLAPSE = (open: boolean) =>
  `min-w-0 whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${
    open ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0 pointer-events-none'
  }`;

function SideNavBar({ isOpen, isPinned, onTogglePinned, onHoverIn, onHoverOut, activeNav, onNavClick, onCartOpen, totalQty, user, onTrackOrder }:{
  isOpen: boolean; isPinned: boolean; onTogglePinned: () => void;
  onHoverIn: () => void; onHoverOut: () => void;
  activeNav: NavKey; onNavClick:(k:NavKey)=>void;
  onCartOpen:()=>void; totalQty:number; user:UserInfo; onTrackOrder:()=>void;
}) {
  const mutedNavRow = (key: NavKey, icon: React.ReactNode, label: string) => (
    <button key={key} onClick={()=>onNavClick(key)}
      style={{ display:'flex', alignItems:'center',
        gap: isOpen ? 14 : 0,
        width:'100%', padding:'9px 14px',
        justifyContent:'flex-start',
        borderRadius:10, marginBottom:2, fontSize:14, fontWeight:500, color:'rgba(255,255,255,0.45)', background:'transparent', border:'none', cursor:'pointer', transition:'all 0.15s', fontFamily:'var(--font-body)' }}
      onMouseOver={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='rgba(255,255,255,0.80)'; }}
      onMouseOut={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(255,255,255,0.45)'; }}
    >
      <span style={{ display:'flex' }}>{icon}</span>
      <span className={TEXT_COLLAPSE(isOpen)}>{label}</span>
    </button>
  );

  return (
    <aside
      onMouseLeave={onHoverOut}
      style={{
        position:'relative', display:'flex', flexDirection:'column',
        width:'100%', height:'100%', overflow:'hidden',
      }}
    >
      {/* Shader fills the sidebar */}
      <SidebarShader/>

      {/* Dark glass overlay — keeps text readable */}
      <div style={{
        position:'absolute', inset:0,
        background:'rgba(12,8,28,0.72)',
        backdropFilter:'blur(2px)',
      }}/>

      {/* Upper region — hover-triggered: user tile + nav items */}
      <div
        onMouseEnter={onHoverIn}
        style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column',
                 flex:1, minHeight:0, padding:'20px 0' }}
      >
        {/* User profile tile */}
        <div style={{
          display:'flex', alignItems:'center',
          gap: isOpen ? 12 : 0,
          marginBottom:24,
          padding:'10px 14px',
          justifyContent:'flex-start',
          borderRadius:14, background:'rgba(255,255,255,0.07)',
          border:'1px solid rgba(255,255,255,0.10)', backdropFilter:'blur(4px)',
        }}>
          {user.isGuest ? (
            <img src="/cartoon.jpg" alt="Guest"
              style={{ width:20, height:20, borderRadius:'50%', objectFit:'cover', flexShrink:0, background:'rgba(215,186,255,0.20)', border:'1px solid rgba(215,186,255,0.30)' }}
              onError={e=>{(e.target as HTMLImageElement).style.display='none';}}
            />
          ) : (
            <img src="/kapruka-logo.png" alt="User"
              style={{ width:40, height:40, borderRadius:'50%', objectFit:'contain', flexShrink:0, background:'rgba(255,255,255,0.12)', padding:4 }}
              onError={e=>{(e.target as HTMLImageElement).style.display='none';}}
            />
          )}
          <div className={TEXT_COLLAPSE(isOpen)} style={{ minWidth:0 }}>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.55)', fontWeight:500, lineHeight:1.2, margin:0 }}>
              {user.isGuest ? 'Shopping as' : 'Signed in as'}
            </p>
            <p style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.92)', lineHeight:1.2, fontFamily:'var(--font-headline)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', margin:0 }}>
              {user.name}
            </p>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex:1 }}>
          {NAV_ITEMS.map(item => (
            <button key={item.key} onClick={()=>onNavClick(item.key)}
              style={{
                display:'flex', alignItems:'center',
                gap: isOpen ? 14 : 0,
                width:'100%',
                padding:'11px 14px',
                justifyContent:'flex-start',
                borderRadius:12, marginBottom:4,
                fontSize:14, fontWeight: activeNav===item.key ? 700 : 500,
                color: activeNav===item.key ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)',
                background: activeNav===item.key ? 'rgba(255,255,255,0.18)' : 'transparent',
                border:'none', cursor:'pointer', transition:'all 0.15s', textAlign:'left',
                fontFamily:'var(--font-body)',
                backdropFilter: activeNav===item.key ? 'blur(4px)' : 'none',
                boxShadow: activeNav===item.key ? '0 1px 8px rgba(0,0,0,0.25)' : 'none',
              }}
              onMouseOver={e=>{ if(activeNav!==item.key) e.currentTarget.style.background='rgba(255,255,255,0.10)'; }}
              onMouseOut={e=>{  if(activeNav!==item.key) e.currentTarget.style.background='transparent'; }}
            >
              <span style={{ opacity: activeNav===item.key ? 1 : 0.7, display:'flex' }}>{item.icon}</span>
              <span className={TEXT_COLLAPSE(isOpen)}>{item.label}</span>
            </button>
          ))}

          {/* Cart shortcut */}
          <button onClick={onCartOpen}
            style={{ display:'flex', alignItems:'center',
              gap: isOpen ? 14 : 0,
              width:'100%', padding:'11px 14px',
              justifyContent:'flex-start',
              borderRadius:12, marginTop:8, fontSize:14, fontWeight:500, color:'rgba(255,255,255,0.65)', background:'transparent', border:'none', cursor:'pointer', transition:'all 0.15s', fontFamily:'var(--font-body)' }}
            onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.10)'}
            onMouseOut={e=>e.currentTarget.style.background='transparent'}
          >
            <span style={{ opacity:0.7, display:'flex' }}><CartIcon size={20}/></span>
            <span className={TEXT_COLLAPSE(isOpen)}>Cart</span>
            {totalQty > 0 && (
              <span className={TEXT_COLLAPSE(isOpen)} style={{
                marginLeft: isOpen ? 'auto' : 0,
                background:'var(--c-secondary)', color:'var(--c-on-secondary)',
                borderRadius:9999, padding:'1px 7px', fontSize:11, fontWeight:800,
              }}>
                {totalQty > 9 ? '9+' : totalQty}
              </span>
            )}
          </button>

          {/* Track Order */}
          <button onClick={onTrackOrder}
            style={{ display:'flex', alignItems:'center',
              gap: isOpen ? 14 : 0,
              width:'100%', padding:'11px 14px',
              justifyContent:'flex-start',
              borderRadius:12, marginTop:4, fontSize:14, fontWeight:500, color:'rgba(255,255,255,0.65)', background:'transparent', border:'none', cursor:'pointer', transition:'all 0.15s', fontFamily:'var(--font-body)' }}
            onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.10)'}
            onMouseOut={e=>e.currentTarget.style.background='transparent'}
          >
            <span style={{ opacity:0.7, display:'flex' }}><PackageSearchIcon size={20}/></span>
            <span className={TEXT_COLLAPSE(isOpen)}>Track Order</span>
          </button>

          {/* Settings + Help + Manual directly under Track Order */}
          <div style={{ marginTop:10 }}>
            {mutedNavRow('settings', <SettingsIcon size={18}/>, 'Settings')}
            {mutedNavRow('help',     <HelpIcon    size={18}/>, 'Help')}
            {mutedNavRow('manual',   <span style={{fontSize:18}}>📖</span>, 'User Manual')}
          </div>
        </nav>
      </div>

      {/* Lower region — no hover handlers; toggle is click-only */}
      <div style={{ position:'relative', zIndex:1, borderTop:'1px solid rgba(255,255,255,0.12)', padding:'10px 0' }}>
        <button onClick={onTogglePinned}
          title={isPinned ? 'Collapse sidebar (Ctrl+B)' : 'Expand sidebar (Ctrl+B)'}
          style={{ display:'flex', alignItems:'center', justifyContent:'flex-start',
            width:'100%', padding:'11px 14px',
            borderRadius:12,
            background: isPinned ? 'rgba(189,147,249,0.12)' : 'transparent',
            border:'none', cursor:'pointer',
            transition:'all 0.15s',
            color: isPinned ? 'var(--c-primary)' : 'rgba(255,255,255,0.65)',
          }}
          onMouseOver={e=>{ if(!isPinned) e.currentTarget.style.background='rgba(255,255,255,0.08)'; }}
          onMouseOut={e=>{  if(!isPinned) e.currentTarget.style.background='transparent'; }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isPinned ? 1 : 0.7 }}>
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path
              d="M9 3v18"
              className={`transition-transform duration-300 ease-in-out origin-center ${!isPinned ? 'translate-x-[6px]' : 'translate-x-0'}`}
            />
          </svg>
        </button>
      </div>
    </aside>
  );
}

/* ── Icon button ────────────────────────────────────────────── */
function IconBtn({ children, onClick, active=false, title }:{
  children:React.ReactNode; onClick?:()=>void; active?:boolean; title?:string;
}) {
  return (
    <button title={title} onClick={onClick} style={{
      width:38, height:38, borderRadius:'50%', border:'none', cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center',
      background: active?'rgba(189,147,249,0.15)':'transparent',
      color: active?'var(--c-primary)':'var(--c-on-surface-variant)',
      transition:'all 0.15s',
    }}
      onMouseOver={e=>e.currentTarget.style.background=active?'rgba(189,147,249,0.25)':'var(--c-surface-container-high)'}
      onMouseOut={e=>e.currentTarget.style.background=active?'rgba(189,147,249,0.15)':'transparent'}
    >{children}</button>
  );
}

/* ── App content ──────────────────────────────────────────── */
function AppContent({ user }: { user: UserInfo }) {
  const [lang,        setLang]        = useState<Lang>('en');
  const [products,    setProducts]    = useState<(Product & { url?: string })[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [quantum,     setQuantum]     = useState(false);
  const [cartOpen,    setCartOpen]    = useState(false);
  const [speakerOn,   setSpeakerOn]   = useState(true);
  const { totalQty } = useCart();

  const [isPinned, setIsPinned]   = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [toastMsg, setToastMsg]   = useState<string | null>(null);
  const isOpen = isPinned || isHovered;
  const togglePinned = () => setIsPinned(p => !p);
  const pinnedRef = useRef(false);
  useEffect(() => { pinnedRef.current = isPinned; }, [isPinned]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        const next = !pinnedRef.current;
        pinnedRef.current = next;
        setIsPinned(next);
        setToastMsg(next ? 'Sidebar pinned · Ctrl+B' : 'Sidebar collapsed · Ctrl+B');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  /* Open cart drawer when ChatPanel detects a <checkout_fill> tag */
  useEffect(() => {
    const handler = () => setCartOpen(true);
    window.addEventListener('tara:opencart', handler);
    return () => window.removeEventListener('tara:opencart', handler);
  }, []);

  useReportWebVitals((metric) => {
    if (typeof navigator === 'undefined' || !navigator.sendBeacon) return;
    navigator.sendBeacon('/_sys/vitals?p=' + encodeURIComponent(window.location.pathname + window.location.search), JSON.stringify(metric));
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const beacon = navigator.sendBeacon?.bind(navigator);
    if (!beacon) return;

    const vitalsUrl = () => '/_sys/vitals?p=' + encodeURIComponent(window.location.pathname + window.location.search);

    const queue: Array<{ name: string; value: number; entries: Record<string, unknown>[] }> = [];
    let flushTimer: ReturnType<typeof setInterval> | null = null;
    const FLUSH_MS = 4000;
    const MAX_QUEUE = 6;

    const flush = () => {
      if (queue.length === 0) return;
      const batch = queue.splice(0);
      const payload = batch.map((m) => ({
        id: `v3-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: m.name, value: m.value, delta: m.value,
        rating: m.value < 200 ? 'good' : m.value < 800 ? 'needs-improvement' : 'poor',
        entries: m.entries, navigationType: 'navigate',
      }));
      try { beacon(vitalsUrl(), JSON.stringify(payload.length === 1 ? payload[0] : payload)); } catch { /* non-fatal */ }
    };

    const enqueue = (name: string, value: number, entries: Record<string, unknown>[]) => {
      queue.push({ name, value: Math.round(value), entries });
      if (queue.length >= MAX_QUEUE) flush();
    };

    flushTimer = setInterval(flush, FLUSH_MS);

    // Resource timing — capture API endpoint latency + response context
    const origFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      const start = performance.now();
      const reqBody = typeof init?.body === 'string' ? init.body.slice(0, 2000) : '';
      const isStream = url.startsWith('/api/chat');
      const skipResponse = url.startsWith('/api/voice-tts') || url.startsWith('/api/img');

      try {
        const res = await origFetch(input, init);
        const dur = performance.now() - start;
        if (url.startsWith('/api/')) {
          const entry: Record<string, unknown> = {
            name: url, entryType: 'resource', startTime: Math.round(start),
            duration: Math.round(dur), initiatorType: 'fetch',
            transferSize: 0, decodedBodySize: 0,
            nextHopProtocol: method.toLowerCase(), responseStatus: res.status,
          };
          if (reqBody) entry.requestBody = reqBody;
          if (!isStream && !skipResponse && res.ok) {
            try {
              const clone = res.clone();
              clone.text().then((text) => {
                entry.responseBody = text.slice(0, 2000);
                enqueue('TTFB', dur, [entry]);
              }).catch(() => { enqueue('TTFB', dur, [entry]); });
              return res;
            } catch { /* clone failed */ }
          }
          enqueue('TTFB', dur, [entry]);
        }
        return res;
      } catch (err) {
        const dur = performance.now() - start;
        if (url.startsWith('/api/')) {
          enqueue('TTFB', dur, [{
            name: url, entryType: 'resource', startTime: Math.round(start),
            duration: Math.round(dur), initiatorType: 'fetch',
            transferSize: 0, decodedBodySize: 0,
            nextHopProtocol: method.toLowerCase(), responseStatus: 0,
            ...(reqBody ? { requestBody: reqBody } : {}),
          }]);
        }
        throw err;
      }
    };

    // Interaction timing — clicks on key UI elements
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const target = t.closest('.product-card, .chat-product-card, [title*="voice"], [title*="Voice"], .btn-primary');
      if (target) {
        enqueue('INP', 0, [{
          name: 'pointer', entryType: 'event', startTime: performance.now(),
          duration: 0, processingStart: 0, processingEnd: 0,
          cancelable: true, target: target.className || target.tagName.toLowerCase(),
        }]);
      }
    };
    document.addEventListener('click', onClick, true);

    // Navigation timing — SPA route changes
    const onPopState = () => {
      enqueue('TTFB', 0, [{
        name: 'navigation', entryType: 'navigation', startTime: performance.now(),
        duration: 0, transferSize: 0, decodedBodySize: 0,
      }]);
    };
    window.addEventListener('popstate', onPopState);

    // Flush on page hidden
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (flushTimer) clearInterval(flushTimer);
      flush();
      window.fetch = origFetch;
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  /* If checkout was pre-filled before any items were in cart,
     open the cart as soon as the first item is added */
  useEffect(() => {
    if (totalQty > 0 && window.sessionStorage.getItem('tara_opencart_pending') === '1') {
      window.sessionStorage.removeItem('tara_opencart_pending');
      setCartOpen(true);
    }
  }, [totalQty]);
  const [mobileTab,   setMobileTab]   = useState<MobileTab>('chat');
  const [activeNav,   setActiveNav]   = useState<NavKey>('home');
  const [panel,       setPanel]       = useState<PanelId>('none');
  const [autoSend,    setAutoSend]    = useState('');
  const chatClearRef = useRef<(()=>void)|null>(null);
  const s = STRINGS[lang];

  const handleProducts = useCallback((p:(Product&{url?:string})[], q=false) => {
    setProducts(p); setQuantum(q);
    if (p.length>0 && typeof window!=='undefined' && window.innerWidth<768) setMobileTab('products');
  }, []);

  const handleNavClick = (key: NavKey) => {
    setActiveNav(key);
    if (key==='home')    { setPanel('none'); setMobileTab('chat'); chatClearRef.current?.(); }
    else if (key==='browse')   setPanel('browse');
    else if (key==='history')  setPanel('history');
    else if (key==='rewards')  setPanel('rewards');
    else if (key==='settings') setPanel('settings');
    else if (key==='help')     setPanel('help');
    else if (key==='manual')   setPanel('manual');
  };

  const handleCategorySearch = useCallback((q:string) => { setMobileTab('chat'); setAutoSend(q); }, []);
  const handleClearChat = useCallback(() => { chatClearRef.current?.(); setActiveNav('home'); setPanel('none'); }, []);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100dvh', overflow:'hidden', position:'relative', zIndex:1 }}>
      <TaraBackground/>

      {/* ── Header ───────────────────────────────────────── */}
      <header className="glass-header" style={{ height:64, padding:'0 14px', position:'fixed', top:0, left:0, right:0, zIndex:50, display:'flex', alignItems:'center', gap:6 }}>
        {/* Kapruka logo + TARA brand */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginRight:'auto' }}>
          <img src="/kapruka-logo.png" alt="Kapruka"
            style={{ height:34, width:34, borderRadius:'50%', objectFit:'cover', display:'block', background:'#fff', padding:2 }}
            onError={e=>{ const t=e.target as HTMLImageElement; t.style.display='none'; }}
          />
          <div>
            <h1 className="font-headline" style={{ fontSize:18, fontWeight:700, color:'var(--c-primary)', lineHeight:1 }}>TARA</h1>
            <span style={{ fontSize:10, color:'var(--c-on-surface-variant)', opacity:0.7 }}>AI Retail Agent</span>
          </div>
        </div>

        {/* Desktop centre links */}
        <div className="hidden md:flex items-center gap-1" style={{ marginRight:6 }}>
          {([{label:'Shop',icon:<StoreIcon size={15}/>,panel:'browse'},{label:'Support',icon:<HeadsetIcon size={15}/>,panel:'help'}] as {label:string;icon:React.ReactNode;panel:PanelId}[]).map(l=>(
            <button key={l.label} onClick={()=>setPanel(l.panel as PanelId)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, color:'var(--c-on-surface-variant)', fontSize:14, fontWeight:500, background:'transparent', border:'none', cursor:'pointer', transition:'all 0.15s', fontFamily:'var(--font-body)' }}
              onMouseOver={e=>{ e.currentTarget.style.background='var(--c-surface-container-high)'; e.currentTarget.style.color='var(--c-on-surface)'; }}
              onMouseOut={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--c-on-surface-variant)'; }}
            >{l.icon} {l.label}</button>
          ))}
          <button onClick={()=>setSpeakerOn(v=>!v)} title={speakerOn?'Mute TARA voice replies':'Unmute TARA voice replies'}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, color:'var(--c-on-surface-variant)', fontSize:14, fontWeight:500, background:'transparent', border:'none', cursor:'pointer', transition:'all 0.15s', fontFamily:'var(--font-body)' }}
            onMouseOver={e=>{ e.currentTarget.style.background='var(--c-surface-container-high)'; e.currentTarget.style.color='var(--c-on-surface)'; }}
            onMouseOut={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--c-on-surface-variant)'; }}
          >{speakerOn?'🔊':'🔇'}</button>
        </div>

        {/* Right controls */}
        <div style={{ display:'flex', alignItems:'center', gap:3 }}>
          <IconBtn onClick={()=>setPanel(p=>p==='notifications'?'none':'notifications')} active={panel==='notifications'} title="Notifications">
            <BellIcon size={20}/>
          </IconBtn>
          <IconBtn onClick={()=>setPanel(p=>p==='settings'?'none':'settings')} active={panel==='settings'} title="Settings">
            <SettingsIcon size={20}/>
          </IconBtn>
          <button onClick={()=>setCartOpen(true)} className="btn-primary"
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:9999, fontSize:'0.82rem', position:'relative', marginLeft:4, boxShadow:'0 2px 12px rgba(189,147,249,0.25)' }}>
            <CartIcon size={17}/>
            <span className="hidden sm:inline">{s.cartBtn}</span>
            {totalQty>0 && <span style={{ position:'absolute', top:-6, right:-6, width:18, height:18, borderRadius:'50%', background:'var(--c-secondary)', color:'var(--c-on-secondary)', fontSize:'0.6rem', fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center' }}>{totalQty>9?'9+':totalQty}</span>}
          </button>
        </div>
      </header>

      {/* ── Sidebar (always mounted; width/colapses transitions) ── */}
      <div className={`hidden lg:block fixed top-16 left-0 bottom-0 z-30 overflow-hidden flex flex-col transition-all duration-300 ease-in-out ${isOpen ? 'w-64' : 'w-16'} px-2`}>
        <SideNavBar isOpen={isOpen} isPinned={isPinned} onTogglePinned={togglePinned} onHoverIn={() => setIsHovered(true)} onHoverOut={() => setIsHovered(false)} activeNav={activeNav} onNavClick={handleNavClick} onCartOpen={()=>setCartOpen(true)} totalQty={totalQty} user={user} onTrackOrder={()=>setPanel('track')}/>
      </div>

      {/* ── Main ──────────────────────────────────────────── */}
      <div style={{ display:'flex', flex:1, overflow:'hidden', marginTop:64 }}>
        {/* Chat */}
        <div style={{ flex:1, minWidth:0, flexDirection:'column', overflow:'hidden', display:mobileTab==='chat'?'flex':'none' }} className="md:!flex">
          <ChatPanel lang={lang} onLangChange={setLang} onProductsFound={handleProducts} onSearching={setSearching}
            autoSend={autoSend} onAutoSendDone={()=>setAutoSend('')} onClearRef={chatClearRef}
            speakerOn={speakerOn} onSpeakerToggle={()=>setSpeakerOn(v=>!v)}/>
        </div>

        {/* Products panel */}
        {products.length>0 && (
          <div style={{ flexShrink:0, overflow:'hidden', display:mobileTab==='products'?'flex':'none', width:'100%', flexDirection:'column' }}
            className="md:!flex md:!w-[360px] lg:!w-[400px]">
            <ProductPanel products={products} lang={lang} loading={searching} quantum={quantum}/>
          </div>
        )}
      </div>

      {/* ── Mobile bottom nav ─────────────────────────────── */}
      <nav className="lg:hidden glass-tab-bar flex flex-shrink-0" style={{ borderRadius:'10px 10px 0 0' }}>
        {([
          { key:'chat',     icon:<ChatIcon    size={22}/>, label:'Chat' },
          { key:'products', icon:<BagIcon     size={22}/>, label:'Products', badge:products.length||undefined },
          { key:'discover', icon:<SparkleIcon size={22}/>, label:'Discover' },
          { key:'menu',     icon:<MenuIcon    size={22}/>, label:'Menu' },
        ] as {key:MobileTab;icon:React.ReactNode;label:string;badge?:number}[]).map(tab=>(
          <button key={tab.key}
            onClick={()=>{ if(tab.key==='menu'){setPanel('menu');return;} if(tab.key==='discover'){setPanel('browse');return;} setMobileTab(tab.key); }}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', paddingTop:10, paddingBottom:6, gap:2, color:mobileTab===tab.key?'var(--c-primary-container)':'var(--c-outline)', cursor:'pointer', position:'relative', transition:'color 0.18s', background:'transparent', border:'none', fontFamily:'var(--font-body)' }}>
            {tab.icon}
            <span style={{ fontSize:'0.67rem', fontWeight:mobileTab===tab.key?700:500 }}>{tab.label}</span>
            {mobileTab===tab.key && <div className="tab-active-dot"/>}
            {tab.badge!==undefined && <span style={{ position:'absolute', top:8, right:'calc(50% - 20px)', width:16, height:16, borderRadius:'50%', background:'var(--c-primary-container)', color:'var(--c-on-primary-container)', fontSize:'0.6rem', fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center' }}>{tab.badge>9?'9+':tab.badge}</span>}
          </button>
        ))}
      </nav>

      <CartDrawer open={cartOpen} onClose={()=>setCartOpen(false)} lang={lang}/>
      <SidePanel panel={panel} lang={lang} onClose={()=>setPanel('none')}
        onCategorySearch={handleCategorySearch} onLangChange={setLang} onClearChat={handleClearChat}
        onNavigate={setPanel} speakerOn={speakerOn} onSpeakerToggle={()=>setSpeakerOn(v=>!v)}/>

      {toastMsg && <Toast message={toastMsg} onDone={() => setToastMsg(null)} />}
    </div>
  );
}

/* ── Root: splash → login → app ────────────────────────────── */
export default function Home() {
  const [phase, setPhase] = useState<'splash'|'login'|'app'>('splash');
  const [user,  setUser]  = useState<UserInfo>({ email:'', name:'Guest', isGuest:true });

  if (phase==='splash') return <SplashScreen onDone={()=>setPhase('login')}/>;
  if (phase==='login')  return <LoginModal onDone={u=>{ setUser(u); setPhase('app'); }}/>;
  return <CartProvider><AppContent user={user}/></CartProvider>;
}