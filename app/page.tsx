'use client';
import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import ChatPanel from '@/components/ChatPanel';
import ProductPanel from '@/components/ProductPanel';
import CartDrawer from '@/components/CartDrawer';
import TaraBackground from '@/components/TaraBackground';
import SidePanel, { PanelId } from '@/components/SidePanel';
import SidebarShader from '@/components/SidebarShader';
import LoginModal, { UserInfo } from '@/components/LoginModal';
import { CartProvider, useCart, Product } from '@/context/CartContext';
import { STRINGS, Lang } from '@/lib/strings';
import {
  HomeIcon, HistoryIcon, RewardsIcon, BrowseIcon, CartIcon,
  SettingsIcon, HelpIcon, BellIcon, MenuIcon, XIcon,
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
type NavKey    = 'home' | 'history' | 'rewards' | 'browse' | 'settings' | 'help';

const NAV_ITEMS: { key: NavKey; label: string; icon: React.ReactNode }[] = [
  { key:'home',    label:'Home',    icon:<HomeIcon    size={20}/> },
  { key:'history', label:'History', icon:<HistoryIcon size={20}/> },
  { key:'rewards', label:'Rewards', icon:<RewardsIcon size={20}/> },
  { key:'browse',  label:'Browse',  icon:<BrowseIcon  size={20}/> },
];

/* ── Sidebar with the exact spec shader as background ──────── */
function SideNavBar({ activeNav, onNavClick, onCartOpen, totalQty, user }:{
  activeNav: NavKey; onNavClick:(k:NavKey)=>void;
  onCartOpen:()=>void; totalQty:number; user:UserInfo;
}) {
  return (
    <aside style={{
      position:'fixed', left:0, top:64, bottom:0, width:256, zIndex:30,
      display:'flex', flexDirection:'column', overflow:'hidden',
    }}>
      {/* Shader fills the sidebar */}
      <SidebarShader/>

      {/* Dark glass overlay — keeps text readable */}
      <div style={{
        position:'absolute', inset:0,
        background:'rgba(12,8,28,0.72)',
        backdropFilter:'blur(2px)',
      }}/>

      {/* Content above the shader */}
      <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', height:'100%', padding:'20px 12px' }}>

        {/* User profile tile */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24, padding:'10px 12px', borderRadius:14, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.10)', backdropFilter:'blur(4px)' }}>
          {user.isGuest ? (
            <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(215,186,255,0.20)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'1px solid rgba(215,186,255,0.30)' }}>
              <span style={{ fontSize:18 }}>👤</span>
            </div>
          ) : (
            <img src="/kapruka-logo.png" alt="User"
              style={{ width:40, height:40, borderRadius:'50%', objectFit:'contain', flexShrink:0, background:'rgba(255,255,255,0.12)', padding:4 }}
              onError={e=>{(e.target as HTMLImageElement).style.display='none';}}
            />
          )}
          <div style={{ minWidth:0 }}>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.55)', fontWeight:500 }}>
              {user.isGuest ? 'Shopping as' : 'Signed in as'}
            </p>
            <p style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.92)', lineHeight:1.2, fontFamily:'var(--font-headline)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user.name}
            </p>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex:1 }}>
          {NAV_ITEMS.map(item => (
            <button key={item.key} onClick={()=>onNavClick(item.key)}
              style={{
                display:'flex', alignItems:'center', gap:14, width:'100%',
                padding:'11px 14px', borderRadius:12, marginBottom:4,
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
              <span style={{ opacity: activeNav===item.key ? 1 : 0.7 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          {/* Cart shortcut */}
          <button onClick={onCartOpen}
            style={{ display:'flex', alignItems:'center', gap:14, width:'100%', padding:'11px 14px', borderRadius:12, marginTop:8, fontSize:14, fontWeight:500, color:'rgba(255,255,255,0.65)', background:'transparent', border:'none', cursor:'pointer', transition:'all 0.15s', fontFamily:'var(--font-body)' }}
            onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.10)'}
            onMouseOut={e=>e.currentTarget.style.background='transparent'}
          >
            <span style={{ opacity:0.7 }}><CartIcon size={20}/></span>
            Cart
            {totalQty > 0 && (
              <span style={{ marginLeft:'auto', background:'var(--c-secondary)', color:'var(--c-on-secondary)', borderRadius:9999, padding:'1px 7px', fontSize:11, fontWeight:800 }}>
                {totalQty > 9 ? '9+' : totalQty}
              </span>
            )}
          </button>
        </nav>

        {/* Bottom nav */}
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.12)', paddingTop:10 }}>
          {([{key:'settings',icon:<SettingsIcon size={18}/>,label:'Settings'},{key:'help',icon:<HelpIcon size={18}/>,label:'Help'}] as {key:NavKey;icon:React.ReactNode;label:string}[]).map(item=>(
            <button key={item.key} onClick={()=>onNavClick(item.key)}
              style={{ display:'flex', alignItems:'center', gap:14, width:'100%', padding:'9px 14px', borderRadius:10, marginBottom:2, fontSize:13, fontWeight:500, color:'rgba(255,255,255,0.45)', background:'transparent', border:'none', cursor:'pointer', transition:'color 0.15s', fontFamily:'var(--font-body)' }}
              onMouseOver={e=>e.currentTarget.style.color='rgba(255,255,255,0.80)'}
              onMouseOut={e=>e.currentTarget.style.color='rgba(255,255,255,0.45)'}
            >
              {item.icon}{item.label}
            </button>
          ))}
        </div>
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileTab,   setMobileTab]   = useState<MobileTab>('chat');
  const [activeNav,   setActiveNav]   = useState<NavKey>('home');
  const [panel,       setPanel]       = useState<PanelId>('none');
  const [autoSend,    setAutoSend]    = useState('');
  const chatClearRef = useRef<(()=>void)|null>(null);
  const { totalQty } = useCart();
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
  };

  const handleCategorySearch = useCallback((q:string) => { setMobileTab('chat'); setAutoSend(q); }, []);
  const handleClearChat = useCallback(() => { chatClearRef.current?.(); setActiveNav('home'); setPanel('none'); }, []);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100dvh', overflow:'hidden', position:'relative', zIndex:1 }}>
      <TaraBackground/>

      {/* ── Header ───────────────────────────────────────── */}
      <header className="glass-header" style={{ height:64, padding:'0 14px', position:'fixed', top:0, left:0, right:0, zIndex:50, display:'flex', alignItems:'center', gap:6 }}>
        <div className="hidden lg:block">
          <IconBtn onClick={()=>setSidebarOpen(v=>!v)} title={sidebarOpen?'Close sidebar':'Open sidebar'}>
            {sidebarOpen ? <XIcon size={20}/> : <MenuIcon size={20}/>}
          </IconBtn>
        </div>

        {/* Kapruka logo + TARA brand */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginRight:'auto' }}>
          <img src="/kapruka-logo.png" alt="Kapruka"
            style={{ height:34, width:'auto', objectFit:'contain', display:'block' }}
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

      {/* ── Sidebar spacer + sidebar ─────────────────────── */}
      <div className="hidden lg:block" style={{ position:'fixed', top:64, left:0, bottom:0, width:sidebarOpen?256:0, zIndex:30, overflow:'hidden', transition:'width 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
        {sidebarOpen && <SideNavBar activeNav={activeNav} onNavClick={handleNavClick} onCartOpen={()=>setCartOpen(true)} totalQty={totalQty} user={user}/>}
      </div>

      {/* ── Main ──────────────────────────────────────────── */}
      <div style={{ display:'flex', flex:1, overflow:'hidden', marginTop:64 }}>
        <div className="hidden lg:block flex-shrink-0" style={{ width:sidebarOpen?256:0, transition:'width 0.25s cubic-bezier(0.4,0,0.2,1)' }}/>

        {/* Chat */}
        <div style={{ flex:1, minWidth:0, flexDirection:'column', overflow:'hidden', display:mobileTab==='chat'?'flex':'none' }} className="md:!flex">
          <ChatPanel lang={lang} onLangChange={setLang} onProductsFound={handleProducts} onSearching={setSearching}
            autoSend={autoSend} onAutoSendDone={()=>setAutoSend('')} onClearRef={chatClearRef}
            speakerOn={false} onSpeakerToggle={()=>{}}/>
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
            onClick={()=>{ if(tab.key==='menu'){setPanel('settings');return;} if(tab.key==='discover'){setPanel('browse');return;} setMobileTab(tab.key); }}
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
        onCategorySearch={handleCategorySearch} onLangChange={setLang} onClearChat={handleClearChat}/>
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