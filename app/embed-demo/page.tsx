'use client';

import { useState, useEffect, useRef } from 'react';

const KAPRUKA_URL = 'https://www.kapruka.com';

export default function EmbedDemoPage() {
  const [extInstalled,  setExtInstalled]  = useState<boolean | null>(null);
  const [widgetClosed,  setWidgetClosed]  = useState(false);
  const [widgetKey,     setWidgetKey]     = useState(0);   // bump to force iframe reload
  const resolved = useRef(false);

  /* ── Extension detection ─────────────────────────────────────────────────── */
  useEffect(() => {
    const resolve = (v: boolean) => {
      if (resolved.current) return;
      resolved.current = true;
      setExtInstalled(v);
    };
    if (document.documentElement.getAttribute('data-tara-extension') === '1') {
      resolve(true); return;
    }
    const h = () => resolve(true);
    document.addEventListener('tara-extension-ready', h);
    const t = setTimeout(() => resolve(false), 700);
    return () => { document.removeEventListener('tara-extension-ready', h); clearTimeout(t); };
  }, []);

  /* ── Handle messages from the embedded /widget iframe ───────────────────── */
  /*
     FIX: the widget's close button sends tara-close to its parent window.
     When the parent is embed-demo (not content.js), we catch it here and show
     a "Reopen TARA" overlay instead of doing nothing.
  */
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'tara-close')  setWidgetClosed(true);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const reopenWidget = () => {
    setWidgetKey(k => k + 1);   // remount iframe → fresh widget session
    setWidgetClosed(false);
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="demo-root">

        {/* ── Banner ──────────────────────────────────────────────────────── */}
        <header className="demo-banner">
          <div className="demo-logo">
            <div className="demo-bubble-sm">T<span className="demo-spark">✦</span></div>
            <div>
              <div className="demo-title"><em>TARA</em> — AI Retail Agent</div>
              <div className="demo-sub">Kapruka Agent Challenge · GMEU6</div>
            </div>
          </div>

          <div className="demo-spacer" />

          {extInstalled !== null && (
            <div className={`demo-pill ${extInstalled ? 'pill-on' : 'pill-off'}`}>
              <span className="pill-dot" />
              {extInstalled ? 'Extension Active' : 'Extension Not Detected'}
            </div>
          )}

          <a href="/chrome-extension.zip" download className="demo-dl-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Extension
          </a>
        </header>

        {/* ── Extension detected → go to real Kapruka ─────────────────────── */}
        {extInstalled === true && (
          <div className="demo-detected">
            <div className="demo-det-badge">T<span className="det-check">✓</span></div>
            <h2>Extension is Active!</h2>
            <p>Open the real Kapruka.com — TARA&apos;s amber bubble will appear automatically.</p>
            <a href={KAPRUKA_URL} target="_blank" rel="noopener noreferrer" className="demo-go-btn">
              Open Kapruka.com with TARA
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>

            <div className="demo-steps">
              {[
                ['1', 'Kapruka opens',    'Browser navigates to kapruka.com'],
                ['2', 'Bubble appears',   'Amber ✦ circle, bottom-right'],
                ['3', 'Product context',  'Browse a product for auto-greeting'],
                ['4', 'Full TARA chat',   'Search · Cart · 5 languages'],
              ].map(([n, title, desc]) => (
                <div key={n} className="demo-step">
                  <span className="step-n">{n}</span>
                  <div><strong>{title}</strong><p>{desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Side-by-side demo ───────────────────────────────────────────── */}
        {extInstalled !== true && (
          <div className="demo-split">

            {/* Left: Kapruka mock */}
            <div className="demo-left">
              <div className="demo-ribbon">
                📸 Kapruka.com Preview ·
                <a href={KAPRUKA_URL} target="_blank" rel="noopener noreferrer"> Visit real site →</a>
              </div>

              <div className="kp-mock">
                <nav className="kp-nav">
                  <span className="kp-logo">Kapruka</span>
                  <div className="kp-search">
                    <input readOnly placeholder="Search gifts, groceries, electronics…" />
                    <button>🔍</button>
                  </div>
                  <div className="kp-links"><a href="#">🛒</a><a href="#">Sign In</a></div>
                </nav>

                <div className="kp-cats">
                  {['Cakes','Flowers','Electronics','Groceries','Fashion','Gifts'].map(c=>(
                    <a key={c} href="#">{c}</a>
                  ))}
                </div>

                <div className="kp-hero">
                  <h2>Father&apos;s Day Gifts 👨</h2>
                  <p>Same-day delivery across Sri Lanka</p>
                  <span className="kp-shop-btn">🎁 Shop Now</span>
                </div>

                <div className="kp-section">
                  <div className="kp-section-title">Popular Gifts</div>
                  <div className="kp-grid">
                    {[
                      {e:'🎂',bg:'#fef3c7',name:'Chocolate Cake',   price:'LKR 2,450'},
                      {e:'💐',bg:'#fce7f3',name:'Flower Bouquet',   price:'LKR 1,890'},
                      {e:'📱',bg:'#e0e7ff',name:'Samsung Galaxy',   price:'LKR 42,500'},
                      {e:'🛒',bg:'#dcfce7',name:'Grocery Pack',     price:'LKR 3,200'},
                      {e:'🎁',bg:'#fff7ed',name:'Gift Hamper',      price:'LKR 5,900'},
                      {e:'👕',bg:'#f0fdf4',name:"Men's Polo",       price:'LKR 1,450'},
                    ].map(p=>(
                      <div key={p.name} className="kp-card">
                        <div className="kp-card-img" style={{background:p.bg}}>{p.e}</div>
                        <div className="kp-card-body">
                          <div className="kp-card-name">{p.name}</div>
                          <div className="kp-card-price">{p.price}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Annotated bubble */}
              <div className="demo-callout" aria-hidden="true">
                <span className="callout-label">← TARA injects here</span>
                <span className="callout-arrow">↘</span>
                <div className="callout-bubble">T<span>✦</span></div>
              </div>
            </div>

            {/* Right: live /widget iframe */}
            <div className="demo-right">
              <div className="demo-right-bar">
                <span className="right-label">✦ TARA Live Widget</span>
                <div className="right-status"><span className="live-dot"/><span>Live</span></div>
              </div>

              {/* Iframe wrapper — shows reopen overlay when widget was closed */}
              <div className="iframe-wrap">
                {widgetClosed ? (
                  <div className="reopen-overlay">
                    <div className="reopen-bubble">T</div>
                    <p>TARA was closed</p>
                    <button onClick={reopenWidget} className="reopen-btn">
                      Reopen TARA ↩
                    </button>
                  </div>
                ) : (
                  <iframe
                    key={widgetKey}
                    src="/widget"
                    title="TARA AI Shopping Assistant"
                    className="demo-iframe"
                    allow="clipboard-write; autoplay"
                    loading="eager"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Production setup strip ──────────────────────────────────────── */}
        <div className="prod-strip">
          <span className="prod-label">🚀 Production setup for Kapruka team</span>
          <code className="prod-code">
            {'<script src="https://tara-green.vercel.app/embed.js" async></script>'}
          </code>
          <span className="prod-hint">Drop anywhere in {'<body>'} — no extension needed</span>
        </div>

      </div>
    </>
  );
}

/* ── Styles ────────────────────────────────────────────────────────────────── */
const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:#060610;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}

.demo-root{display:flex;flex-direction:column;min-height:100dvh}

/* Banner */
.demo-banner{display:flex;align-items:center;gap:12px;padding:10px 20px;background:rgba(8,8,18,0.97);border-bottom:1px solid rgba(245,158,11,0.18);position:sticky;top:0;z-index:100;flex-shrink:0;backdrop-filter:blur(8px)}
.demo-logo{display:flex;align-items:center;gap:10px;flex-shrink:0}
.demo-bubble-sm{position:relative;width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#fff;box-shadow:0 2px 10px rgba(245,158,11,.4);flex-shrink:0}
.demo-spark{position:absolute;bottom:3px;right:3px;font-size:7px;color:rgba(255,255,255,.85)}
.demo-title{font-size:13px;font-weight:700;color:#f1f5f9}.demo-title em{font-style:normal;color:#f59e0b}
.demo-sub{font-size:11px;color:#475569}
.demo-spacer{flex:1}
.demo-pill{display:flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;flex-shrink:0}
.pill-on{background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);color:#4ade80}
.pill-off{background:rgba(100,116,139,.1);border:1px solid rgba(100,116,139,.2);color:#64748b}
.pill-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.pill-on .pill-dot{background:#22c55e;box-shadow:0 0 6px rgba(34,197,94,.6);animation:blink 2s ease infinite}
.pill-off .pill-dot{background:#475569}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}
.demo-dl-btn{display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:7px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;font-size:11px;font-weight:700;text-decoration:none;white-space:nowrap;flex-shrink:0;transition:opacity .15s,transform .15s}
.demo-dl-btn:hover{opacity:.88;transform:translateY(-1px)}

/* Detected hero */
.demo-detected{display:flex;flex-direction:column;align-items:center;gap:20px;padding:48px 24px 40px;text-align:center;background:radial-gradient(ellipse at 50% 0%,rgba(245,158,11,.07) 0%,transparent 60%);flex:1}
.demo-det-badge{position:relative;width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;color:#fff;box-shadow:0 8px 32px rgba(245,158,11,.45);animation:pop .4s cubic-bezier(.34,1.56,.64,1) both}
@keyframes pop{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
.det-check{position:absolute;bottom:2px;right:2px;width:22px;height:22px;border-radius:50%;background:#22c55e;border:2.5px solid #060610;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff}
.demo-detected h2{font-size:24px;font-weight:800;color:#f8fafc}
.demo-detected p{font-size:13px;color:#94a3b8;max-width:420px;line-height:1.6}
.demo-go-btn{display:inline-flex;align-items:center;gap:10px;padding:13px 28px;border-radius:10px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;font-size:15px;font-weight:800;text-decoration:none;box-shadow:0 4px 24px rgba(245,158,11,.4);transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s}
.demo-go-btn:hover{transform:scale(1.04) translateY(-2px);box-shadow:0 8px 32px rgba(245,158,11,.55)}
.demo-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;width:100%;max-width:720px}
.demo-step{display:flex;align-items:flex-start;gap:10px;padding:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px}
.step-n{width:24px;height:24px;border-radius:50%;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#f59e0b;flex-shrink:0}
.demo-step strong{display:block;font-size:11px;color:#e2e8f0;margin-bottom:2px}
.demo-step p{font-size:10px;color:#64748b;line-height:1.4}

/* Split layout */
.demo-split{display:flex;flex:1;min-height:0;height:calc(100dvh - 52px - 40px)}

/* Left mock */
.demo-left{flex:0 0 55%;min-width:0;overflow-y:auto;background:#fff;border-right:1px solid rgba(245,158,11,.1);position:relative;color:#333;font-family:Arial,sans-serif}
.demo-ribbon{position:sticky;top:0;z-index:10;padding:5px 14px;background:rgba(245,158,11,.9);color:#000;font-size:10px;font-weight:700;letter-spacing:.05em;text-align:center}
.demo-ribbon a{color:#000;font-weight:800}
.kp-mock{}
.kp-nav{background:#c0392b;padding:0 14px;display:flex;align-items:center;height:50px;gap:10px;position:sticky;top:28px;z-index:5}
.kp-logo{color:#fff;font-size:19px;font-weight:800;font-family:Georgia,serif;flex-shrink:0}
.kp-search{flex:1;display:flex;max-width:340px}
.kp-search input{flex:1;padding:6px 10px;border:none;border-radius:4px 0 0 4px;font-size:12px;color:#333;outline:none}
.kp-search button{padding:6px 11px;background:#e74c3c;color:#fff;border:none;border-radius:0 4px 4px 0;font-size:12px;cursor:pointer}
.kp-links{display:flex;gap:10px;margin-left:auto}
.kp-links a{color:rgba(255,255,255,.9);text-decoration:none;font-size:11px}
.kp-cats{background:#a93226;padding:0 14px;display:flex;overflow-x:auto}
.kp-cats a{color:rgba(255,255,255,.85);text-decoration:none;font-size:11px;padding:8px 11px;white-space:nowrap}
.kp-cats a:hover{background:rgba(0,0,0,.15)}
.kp-hero{background:linear-gradient(135deg,#2c3e50,#1a252f);padding:24px 16px;color:#fff}
.kp-hero h2{font-size:20px;font-weight:700;margin-bottom:5px}
.kp-hero p{font-size:12px;color:rgba(255,255,255,.65)}
.kp-shop-btn{display:inline-flex;margin-top:10px;padding:6px 13px;background:#e74c3c;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer}
.kp-section{padding:18px 14px}
.kp-section-title{font-size:15px;font-weight:700;color:#2c3e50;margin-bottom:12px;padding-bottom:5px;border-bottom:2px solid #e74c3c;display:inline-block}
.kp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.kp-card{border:1px solid #e5e7eb;border-radius:7px;overflow:hidden;cursor:pointer;background:#fff;transition:box-shadow .15s,transform .15s}
.kp-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.1);transform:translateY(-2px)}
.kp-card-img{width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:28px;border-bottom:1px solid #f3f4f6}
.kp-card-body{padding:7px}
.kp-card-name{font-size:10px;color:#374151;font-weight:600;line-height:1.3;margin-bottom:2px}
.kp-card-price{font-size:11px;color:#c0392b;font-weight:700}
.demo-callout{position:sticky;bottom:16px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;pointer-events:none;padding-right:16px}
.callout-label{background:rgba(13,13,26,.92);color:#f59e0b;font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;border:1px solid rgba(245,158,11,.3);white-space:nowrap}
.callout-arrow{color:#f59e0b;font-size:16px;padding-right:20px}
.callout-bubble{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#fff;box-shadow:0 4px 18px rgba(245,158,11,.5);position:relative;animation:pulse-ring 2.5s ease infinite}
.callout-bubble span{position:absolute;bottom:7px;right:7px;font-size:8px;color:rgba(255,255,255,.85)}
@keyframes pulse-ring{0%,100%{box-shadow:0 4px 18px rgba(245,158,11,.5),0 0 0 0 rgba(245,158,11,.35)}50%{box-shadow:0 4px 18px rgba(245,158,11,.5),0 0 0 10px rgba(245,158,11,0)}}

/* Right: widget iframe */
.demo-right{flex:0 0 45%;min-width:0;display:flex;flex-direction:column;background:#0d0d1a;border-left:1px solid rgba(245,158,11,.08)}
.demo-right-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:rgba(13,13,26,.99);border-bottom:1px solid rgba(245,158,11,.1);flex-shrink:0}
.right-label{font-size:11px;font-weight:700;color:#f59e0b;letter-spacing:.08em}
.right-status{display:flex;align-items:center;gap:5px;font-size:10px;color:#475569}
.live-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;animation:blink 2s ease infinite}
.iframe-wrap{flex:1;position:relative;min-height:0}
.demo-iframe{width:100%;height:100%;border:none;display:block;background:#0d0d1a}

/* Reopen overlay */
.reopen-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#0d0d1a;color:#94a3b8}
.reopen-bubble{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#fff;opacity:.5}
.reopen-overlay p{font-size:13px}
.reopen-btn{padding:9px 20px;border-radius:8px;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.3);color:#f59e0b;font-size:12px;font-weight:700;cursor:pointer;transition:background .15s}
.reopen-btn:hover{background:rgba(245,158,11,.25)}

/* Production strip */
.prod-strip{flex-shrink:0;display:flex;align-items:center;gap:12px;padding:8px 20px;background:rgba(13,13,26,.98);border-top:1px solid rgba(245,158,11,.1);flex-wrap:wrap}
.prod-label{font-size:11px;font-weight:700;color:#f59e0b;white-space:nowrap;flex-shrink:0}
.prod-code{flex:1;font-size:11px;color:#94a3b8;background:rgba(255,255,255,.05);padding:5px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.07);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;font-family:monospace}
.prod-hint{font-size:10px;color:#475569;white-space:nowrap;flex-shrink:0}

/* Mobile */
@media(max-width:768px){
  .demo-split{flex-direction:column;height:auto;overflow-y:auto}
  .demo-left{flex:none;width:100%;max-height:50vh}
  .demo-right{flex:none;width:100%;min-height:65vh;border-left:none;border-top:1px solid rgba(245,158,11,.1)}
  .demo-banner{flex-wrap:wrap;gap:8px}
  .demo-sub{display:none}
  .prod-code{display:none}
}
@media(max-width:480px){.demo-pill{display:none}.demo-steps{grid-template-columns:1fr 1fr}}
`;
