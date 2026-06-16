'use client';

/**
 * app/embed-demo/page.tsx  v2
 *
 * Judge demo page — two distinct experiences depending on whether the
 * Chrome extension is detected:
 *
 *  DETECTED  → Full-width "Extension Active" banner + prominent
 *               "Open Kapruka.com with TARA →" CTA that redirects
 *               judges directly to kapruka.com where TARA bubble appears
 *               automatically (no mock needed — it's the real site).
 *
 *  NOT DETECTED → Classic side-by-side layout:
 *               Left (55 %): Annotated Kapruka.com mock
 *               Right (45 %): Live /widget iframe
 *               + Extension install guide
 *
 * Detection mechanism:
 *   chrome-extension/detect.js is injected at document_start on
 *   tara-green.vercel.app/embed-demo*. It sets
 *   document.documentElement.setAttribute('data-tara-extension', '1')
 *   and dispatches a 'tara-extension-ready' custom event.
 *   This page listens for both, with a 700 ms timeout as fallback.
 */

import { useState, useEffect, useRef } from 'react';

const KAPRUKA_URL = 'https://www.kapruka.com';

export default function EmbedDemoPage() {
  // null = still checking, true/false = resolved
  const [extInstalled, setExtInstalled] = useState<boolean | null>(null);
  const resolved = useRef(false);

  useEffect(() => {
    const resolve = (value: boolean) => {
      if (resolved.current) return;
      resolved.current = true;
      setExtInstalled(value);
    };

    // detect.js runs at document_start and sets this BEFORE React hydrates
    if (document.documentElement.getAttribute('data-tara-extension') === '1') {
      resolve(true);
      return;
    }

    // Fallback: detect.js dispatches after DOMContentLoaded (already fired by now)
    const handler = () => resolve(true);
    document.addEventListener('tara-extension-ready', handler);

    // If nothing fires within 700 ms, extension is not installed
    const timer = setTimeout(() => resolve(false), 700);

    return () => {
      document.removeEventListener('tara-extension-ready', handler);
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <style>{STYLES}</style>

      <div className="demo-page">

        {/* ── Top banner ──────────────────────────────────────────────── */}
        <header className="demo-banner">
          <div className="demo-banner-logo">
            <div className="demo-bubble-sm" aria-hidden="true">T<span className="demo-spark">✦</span></div>
            <div>
              <div className="demo-banner-title"><span>TARA</span> — AI Retail Agent</div>
              <div className="demo-banner-sub">Kapruka Agent Challenge · GMEU6</div>
            </div>
          </div>

          <div className="demo-banner-spacer" />

          {/* Extension status indicator */}
          {extInstalled !== null && (
            <div className={`demo-ext-pill ${extInstalled ? 'active' : 'inactive'}`}>
              <span className="demo-ext-dot" />
              {extInstalled ? 'Extension Active' : 'Extension Not Detected'}
            </div>
          )}

          <a
            href="/chrome-extension.zip"
            download="tara-extension.zip"
            className="demo-banner-cta"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Extension
          </a>
        </header>

        {/* ── Extension-detected hero ───────────────────────────────── */}
        {extInstalled === true && (
          <div className="demo-detected-hero">
            <div className="demo-detected-inner">
              <div className="demo-detected-icon" aria-hidden="true">
                <span>T</span>
                <span className="demo-detected-check">✓</span>
              </div>
              <div className="demo-detected-text">
                <h2>TARA Extension is Active!</h2>
                <p>
                  Click below to open the real Kapruka.com — TARA&apos;s amber bubble
                  will appear in the bottom-right corner automatically.
                </p>
              </div>
              <a
                href={KAPRUKA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="demo-go-kapruka"
              >
                Open Kapruka.com with TARA
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            </div>

            {/* Steps when on real kapruka */}
            <div className="demo-steps">
              {[
                { n: '1', title: 'Kapruka opens', desc: 'Your browser navigates to kapruka.com' },
                { n: '2', title: 'Bubble appears', desc: 'Amber ✦ circle, bottom-right corner' },
                { n: '3', title: 'Product context', desc: 'Browse a product page for auto-greeting' },
                { n: '4', title: 'Full TARA chat', desc: 'Search · Cart · Checkout · 5 languages' },
              ].map(step => (
                <div key={step.n} className="demo-step">
                  <div className="demo-step-n">{step.n}</div>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Side-by-side demo (no extension / still checking) ─────── */}
        {extInstalled !== true && (
          <div className="demo-split">

            {/* ── Left: Kapruka mock ─────────────────────────────────── */}
            <div className="demo-left">
              <div className="demo-ribbon">
                📸 Kapruka.com Preview
                &nbsp;·&nbsp; X-Frame-Options blocks live embed
                &nbsp;·&nbsp;
                <a href={KAPRUKA_URL} target="_blank" rel="noopener noreferrer"
                  className="demo-ribbon-link">Visit real site →</a>
              </div>

              {/* Kapruka mock */}
              <div className="kp-mock">
                <nav className="kp-nav">
                  <span className="kp-logo">Kapruka</span>
                  <div className="kp-search">
                    <input readOnly placeholder="Search for gifts, groceries, electronics…" />
                    <button>🔍</button>
                  </div>
                  <div className="kp-nav-links">
                    <a href="#">Track</a>
                    <a href="#">Sign In</a>
                    <a href="#">🛒</a>
                  </div>
                </nav>

                <div className="kp-subnav">
                  {['Cakes','Flowers','Electronics','Groceries','Fashion','Gifts'].map(c => (
                    <a key={c} href="#">{c}</a>
                  ))}
                </div>

                <div className="kp-hero">
                  <div className="kp-hero-text">
                    <h2>Father&apos;s Day Gifts 👨</h2>
                    <p>Same-day delivery across Sri Lanka</p>
                    <span className="kp-hero-btn">🎁 Shop Now</span>
                  </div>
                </div>

                <div className="kp-section">
                  <div className="kp-section-title">Popular Gifts</div>
                  <div className="kp-grid">
                    {[
                      { e:'🎂', bg:'#fef3c7', name:'Chocolate Birthday Cake', price:'LKR 2,450' },
                      { e:'💐', bg:'#fce7f3', name:'Mixed Flower Bouquet',    price:'LKR 1,890' },
                      { e:'📱', bg:'#e0e7ff', name:'Samsung Galaxy A14',      price:'LKR 42,500' },
                      { e:'🛒', bg:'#dcfce7', name:'Monthly Grocery Pack',    price:'LKR 3,200' },
                      { e:'🎁', bg:'#fff7ed', name:'Premium Gift Hamper',     price:'LKR 5,900' },
                      { e:'👕', bg:'#f0fdf4', name:"Men's Polo Shirt",        price:'LKR 1,450' },
                    ].map(p => (
                      <div key={p.name} className="kp-card">
                        <div className="kp-card-img" style={{ background: p.bg }}>{p.e}</div>
                        <div className="kp-card-info">
                          <div className="kp-card-name">{p.name}</div>
                          <div className="kp-card-price">{p.price}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Annotated TARA bubble */}
              <div className="demo-callout" aria-hidden="true">
                <div className="demo-callout-label">← TARA injects here via extension</div>
                <div className="demo-callout-arrow">↘</div>
                <div className="demo-tara-bubble">T<span>✦</span></div>
              </div>
            </div>

            {/* ── Right: live /widget iframe ──────────────────────────── */}
            <div className="demo-right">
              <div className="demo-right-bar">
                <span className="demo-right-label">✦ TARA Live Widget</span>
                <div className="demo-right-status">
                  <span className="demo-live-dot" />
                  <span>Live · All features enabled</span>
                </div>
              </div>

              <iframe
                src="/widget"
                title="TARA AI Shopping Assistant"
                className="demo-iframe"
                allow="clipboard-write; autoplay"
                loading="eager"
              />

              {/* Install guide — shown only while checking / not installed */}
              {extInstalled === false && (
                <div className="demo-install-guide">
                  <p className="demo-install-title">
                    Want to try it on the real Kapruka.com?
                  </p>
                  <ol className="demo-install-steps">
                    <li>
                      <a href="/chrome-extension.zip" download className="demo-install-link">
                        Download the extension ↓
                      </a>
                    </li>
                    <li>Open <code>chrome://extensions</code> · Enable Dev mode</li>
                    <li>Click <strong>Load unpacked</strong> → select the unzipped folder</li>
                    <li>
                      <a href={KAPRUKA_URL} target="_blank" rel="noopener noreferrer"
                        className="demo-install-link">
                        Visit Kapruka.com →
                      </a>
                      &nbsp;and look for the amber ✦ bubble
                    </li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  );
}

// ── All styles ─────────────────────────────────────────────────────────────────
const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    height: 100%;
    background: #060610;
    color: #e2e8f0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  a { color: inherit; }

  /* ── Page shell ──────────────────────────────────────────────────────── */
  .demo-page {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }

  /* ── Banner ──────────────────────────────────────────────────────────── */
  .demo-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 20px;
    background: rgba(10, 10, 22, 0.96);
    border-bottom: 1px solid rgba(245, 158, 11, 0.18);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    position: sticky;
    top: 0;
    z-index: 100;
    flex-shrink: 0;
  }

  .demo-banner-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .demo-bubble-sm {
    position: relative;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 900;
    color: #fff;
    box-shadow: 0 2px 10px rgba(245,158,11,0.4);
    flex-shrink: 0;
  }

  .demo-spark {
    position: absolute;
    bottom: 3px;
    right: 3px;
    font-size: 7px;
    color: rgba(255,255,255,0.85);
  }

  .demo-banner-title {
    font-size: 13px;
    font-weight: 700;
    color: #f1f5f9;
  }

  .demo-banner-title span { color: #f59e0b; }

  .demo-banner-sub {
    font-size: 11px;
    color: #475569;
  }

  .demo-banner-spacer { flex: 1; }

  .demo-ext-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .demo-ext-pill.active {
    background: rgba(34, 197, 94, 0.12);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #4ade80;
  }

  .demo-ext-pill.inactive {
    background: rgba(100, 116, 139, 0.12);
    border: 1px solid rgba(100, 116, 139, 0.25);
    color: #64748b;
  }

  .demo-ext-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .demo-ext-pill.active .demo-ext-dot {
    background: #22c55e;
    box-shadow: 0 0 6px rgba(34,197,94,0.6);
    animation: demo-blink 2s ease infinite;
  }

  .demo-ext-pill.inactive .demo-ext-dot { background: #475569; }

  @keyframes demo-blink {
    0%,100% { opacity:1; }
    50%      { opacity:0.4; }
  }

  .demo-banner-cta {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 7px;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #000;
    font-size: 11px;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(245,158,11,0.3);
    transition: opacity 0.15s, transform 0.15s;
  }

  .demo-banner-cta:hover { opacity: 0.88; transform: translateY(-1px); }

  /* ── Extension-detected hero ─────────────────────────────────────────── */
  .demo-detected-hero {
    padding: 48px 24px 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 40px;
    background: radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.07) 0%, transparent 65%);
    flex: 1;
  }

  .demo-detected-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    text-align: center;
    max-width: 520px;
  }

  .demo-detected-icon {
    position: relative;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    font-weight: 900;
    color: #fff;
    box-shadow: 0 8px 32px rgba(245,158,11,0.45);
    animation: demo-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
  }

  @keyframes demo-pop {
    from { transform: scale(0.5); opacity:0; }
    to   { transform: scale(1);   opacity:1; }
  }

  .demo-detected-check {
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #22c55e;
    border: 3px solid #060610;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 800;
    color: #fff;
  }

  .demo-detected-text h2 {
    font-size: 26px;
    font-weight: 800;
    color: #f8fafc;
    margin-bottom: 10px;
  }

  .demo-detected-text p {
    font-size: 14px;
    color: #94a3b8;
    line-height: 1.6;
  }

  .demo-go-kapruka {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 14px 32px;
    border-radius: 12px;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #000;
    font-size: 16px;
    font-weight: 800;
    text-decoration: none;
    box-shadow: 0 4px 24px rgba(245,158,11,0.4);
    transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s;
  }

  .demo-go-kapruka:hover {
    transform: scale(1.04) translateY(-2px);
    box-shadow: 0 8px 32px rgba(245,158,11,0.55);
  }

  .demo-steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    width: 100%;
    max-width: 800px;
  }

  .demo-step {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
  }

  .demo-step-n {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(245,158,11,0.15);
    border: 1px solid rgba(245,158,11,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 800;
    color: #f59e0b;
    flex-shrink: 0;
  }

  .demo-step strong {
    display: block;
    font-size: 12px;
    color: #e2e8f0;
    margin-bottom: 3px;
  }

  .demo-step p {
    font-size: 11px;
    color: #64748b;
    line-height: 1.4;
  }

  /* ── Split pane ──────────────────────────────────────────────────────── */
  .demo-split {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    height: calc(100dvh - 52px);
  }

  /* ── Left mock ───────────────────────────────────────────────────────── */
  .demo-left {
    flex: 0 0 55%;
    min-width: 0;
    overflow-y: auto;
    background: #fff;
    border-right: 1px solid rgba(245,158,11,0.12);
    position: relative;
  }

  .demo-ribbon {
    position: sticky;
    top: 0;
    z-index: 10;
    padding: 5px 14px;
    background: rgba(245,158,11,0.9);
    color: #000;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-align: center;
  }

  .demo-ribbon-link { color: #000; font-weight: 800; text-decoration: underline; }

  /* Kapruka mock styles */
  .kp-mock { font-family: Arial, sans-serif; color: #333; }

  .kp-nav {
    background: #c0392b;
    padding: 0 16px;
    display: flex;
    align-items: center;
    height: 52px;
    gap: 12px;
    position: sticky;
    top: 28px;
    z-index: 5;
  }

  .kp-logo {
    color: #fff;
    font-size: 20px;
    font-weight: 800;
    font-family: Georgia, serif;
    flex-shrink: 0;
  }

  .kp-search {
    flex: 1;
    display: flex;
    max-width: 360px;
  }

  .kp-search input {
    flex: 1;
    padding: 6px 10px;
    border: none;
    border-radius: 4px 0 0 4px;
    font-size: 12px;
    color: #333;
    outline: none;
  }

  .kp-search button {
    padding: 6px 12px;
    background: #e74c3c;
    color: #fff;
    border: none;
    border-radius: 0 4px 4px 0;
    font-size: 12px;
    cursor: pointer;
  }

  .kp-nav-links {
    display: flex;
    gap: 12px;
    margin-left: auto;
    flex-shrink: 0;
  }

  .kp-nav-links a { color: rgba(255,255,255,0.9); text-decoration: none; font-size: 11px; }

  .kp-subnav {
    background: #a93226;
    padding: 0 16px;
    display: flex;
    overflow-x: auto;
  }

  .kp-subnav a {
    color: rgba(255,255,255,0.85);
    text-decoration: none;
    font-size: 11px;
    padding: 8px 12px;
    white-space: nowrap;
  }

  .kp-subnav a:hover { background: rgba(0,0,0,0.15); }

  .kp-hero {
    background: linear-gradient(135deg, #2c3e50, #1a252f);
    padding: 28px 16px;
    min-height: 160px;
    display: flex;
    align-items: center;
  }

  .kp-hero-text { color: #fff; }
  .kp-hero-text h2 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
  .kp-hero-text p  { font-size: 12px; color: rgba(255,255,255,0.65); }

  .kp-hero-btn {
    display: inline-flex;
    margin-top: 10px;
    padding: 6px 14px;
    background: #e74c3c;
    color: #fff;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .kp-section { padding: 20px 16px; }
  .kp-section-title {
    font-size: 16px;
    font-weight: 700;
    color: #2c3e50;
    margin-bottom: 14px;
    padding-bottom: 6px;
    border-bottom: 2px solid #e74c3c;
    display: inline-block;
  }

  .kp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 12px;
  }

  .kp-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    background: #fff;
    transition: box-shadow 0.15s, transform 0.15s;
  }

  .kp-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-2px); }

  .kp-card-img {
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    border-bottom: 1px solid #f3f4f6;
  }

  .kp-card-info { padding: 8px; }
  .kp-card-name  { font-size: 11px; color: #374151; font-weight: 600; line-height: 1.3; margin-bottom: 3px; }
  .kp-card-price { font-size: 12px; color: #c0392b; font-weight: 700; }

  /* TARA bubble callout annotation */
  .demo-callout {
    position: sticky;
    bottom: 20px;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    pointer-events: none;
    padding-right: 20px;
    z-index: 20;
  }

  .demo-callout-label {
    background: rgba(13,13,26,0.92);
    color: #f59e0b;
    font-size: 10px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 20px;
    border: 1px solid rgba(245,158,11,0.3);
    white-space: nowrap;
  }

  .demo-callout-arrow { color: #f59e0b; font-size: 18px; line-height: 1; padding-right: 20px; }

  .demo-tara-bubble {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 900;
    color: #fff;
    box-shadow: 0 4px 20px rgba(245,158,11,0.5);
    position: relative;
    animation: demo-pulse 2.5s ease infinite;
  }

  .demo-tara-bubble span {
    position: absolute;
    bottom: 8px;
    right: 8px;
    font-size: 8px;
    color: rgba(255,255,255,0.85);
    font-weight: 600;
  }

  @keyframes demo-pulse {
    0%,100% { box-shadow: 0 4px 20px rgba(245,158,11,0.5), 0 0 0 0 rgba(245,158,11,0.35); }
    50%      { box-shadow: 0 4px 20px rgba(245,158,11,0.5), 0 0 0 12px rgba(245,158,11,0); }
  }

  /* ── Right side ──────────────────────────────────────────────────────── */
  .demo-right {
    flex: 0 0 45%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: #0d0d1a;
    border-left: 1px solid rgba(245,158,11,0.08);
  }

  .demo-right-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 14px;
    background: rgba(13,13,26,0.99);
    border-bottom: 1px solid rgba(245,158,11,0.1);
    flex-shrink: 0;
  }

  .demo-right-label {
    font-size: 11px;
    font-weight: 700;
    color: #f59e0b;
    letter-spacing: 0.08em;
  }

  .demo-right-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #475569;
  }

  .demo-live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #22c55e;
    animation: demo-blink 2s ease infinite;
  }

  .demo-iframe {
    flex: 1;
    width: 100%;
    border: none;
    display: block;
    background: #0d0d1a;
    min-height: 0;
  }

  /* Install guide */
  .demo-install-guide {
    flex-shrink: 0;
    padding: 14px 16px;
    background: rgba(13,13,26,0.98);
    border-top: 1px solid rgba(255,255,255,0.05);
  }

  .demo-install-title {
    font-size: 11px;
    font-weight: 700;
    color: #f59e0b;
    margin-bottom: 8px;
  }

  .demo-install-steps {
    list-style: none;
    counter-reset: install-step;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .demo-install-steps li {
    counter-increment: install-step;
    display: flex;
    align-items: baseline;
    gap: 7px;
    font-size: 11px;
    color: #64748b;
    line-height: 1.4;
  }

  .demo-install-steps li::before {
    content: counter(install-step);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(245,158,11,0.15);
    color: #f59e0b;
    font-size: 9px;
    font-weight: 800;
    flex-shrink: 0;
  }

  .demo-install-steps code {
    background: rgba(255,255,255,0.07);
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 10px;
  }

  .demo-install-link {
    color: #f59e0b;
    font-weight: 700;
    text-decoration: none;
  }

  .demo-install-link:hover { text-decoration: underline; }

  /* ── Mobile ──────────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .demo-split {
      flex-direction: column;
      overflow-y: auto;
      height: auto;
    }

    .demo-left {
      flex: none;
      width: 100%;
      max-height: 50vh;
    }

    .demo-right {
      flex: none;
      width: 100%;
      min-height: 65vh;
      border-left: none;
      border-top: 1px solid rgba(245,158,11,0.12);
    }

    .demo-banner { flex-wrap: wrap; gap: 8px; }
    .demo-banner-sub { display: none; }

    .demo-detected-hero { padding: 32px 16px 24px; }
    .demo-detected-text h2 { font-size: 20px; }
    .demo-go-kapruka { font-size: 14px; padding: 12px 24px; }
    .demo-steps { grid-template-columns: 1fr 1fr; }
  }

  @media (max-width: 480px) {
    .demo-ext-pill { display: none; }
    .demo-steps { grid-template-columns: 1fr; }
  }
`;
