/**
 * app/embed-demo/page.tsx
 *
 * Public demo URL for judges who cannot install the Chrome extension.
 *
 * Layout:
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  TARA Live Demo — How it appears on Kapruka.com        [CTA] │  ← banner
 *  ├────────────────────────────────┬────────────────────────────┤
 *  │                                │                            │
 *  │   Kapruka.com mock (55 %)      │   Live /widget iframe (45%)│
 *  │   (static — X-Frame-Options    │   Full TARA chat + search  │
 *  │    prevents real embed)        │   + cart                   │
 *  │                                │                            │
 *  └────────────────────────────────┴────────────────────────────┘
 *
 * Mobile: stacked (screenshot → widget)
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TARA Live Demo — Kapruka.com Embed',
  description:
    'See TARA, the AI Retail Agent, live inside Kapruka.com — as judges would via the Chrome extension.',
  robots: { index: true, follow: true },
};

export default function EmbedDemoPage() {
  return (
    <>
      <style>{`
        /* ── Base ─────────────────────────────────────────────────────────── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
          height: 100%;
          background: #080812;
          color: #e2e8f0;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        /* ── Page shell ────────────────────────────────────────────────────── */
        .demo-page {
          display: flex;
          flex-direction: column;
          min-height: 100dvh;
        }

        /* ── Top banner ────────────────────────────────────────────────────── */
        .demo-banner {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 24px;
          background: linear-gradient(90deg, rgba(13,13,26,0.95) 0%, rgba(30,20,10,0.95) 100%);
          border-bottom: 1px solid rgba(245, 158, 11, 0.2);
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
          gap: 8px;
          flex-shrink: 0;
        }

        .demo-banner-bubble {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 12px rgba(245,158,11,0.4);
          font-size: 17px;
          font-weight: 900;
          color: #fff;
          flex-shrink: 0;
          position: relative;
        }

        .demo-banner-bubble::after {
          content: '✦';
          position: absolute;
          bottom: 3px;
          right: 3px;
          font-size: 7px;
          color: rgba(255,255,255,0.85);
        }

        .demo-banner-title {
          font-size: 14px;
          font-weight: 600;
          color: #f1f5f9;
          white-space: nowrap;
        }

        .demo-banner-title span {
          color: #f59e0b;
        }

        .demo-banner-sub {
          font-size: 12px;
          color: #64748b;
          white-space: nowrap;
        }

        .demo-banner-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 20px;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.25);
          font-size: 11px;
          font-weight: 600;
          color: #f59e0b;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .demo-banner-spacer { flex: 1; }

        .demo-banner-cta {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 16px;
          border-radius: 8px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: #000;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
          transition: opacity 0.15s ease, transform 0.15s ease;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(245,158,11,0.3);
        }

        .demo-banner-cta:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .demo-banner-cta svg { flex-shrink: 0; }

        /* ── Split pane ────────────────────────────────────────────────────── */
        .demo-split {
          display: flex;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        /* ── Left: Kapruka mock ────────────────────────────────────────────── */
        .demo-left {
          flex: 0 0 55%;
          min-width: 0;
          overflow-y: auto;
          overflow-x: hidden;
          background: #ffffff;
          border-right: 1px solid rgba(245, 158, 11, 0.15);
          position: relative;
        }

        /* Annotation overlay ribbon */
        .demo-left-ribbon {
          position: sticky;
          top: 0;
          z-index: 10;
          padding: 6px 16px;
          background: rgba(245, 158, 11, 0.92);
          color: #000;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-align: center;
        }

        /* TARA bubble annotation callout */
        .demo-bubble-callout {
          position: absolute;
          bottom: 96px;
          right: 88px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
          pointer-events: none;
          z-index: 20;
        }

        .demo-callout-label {
          background: rgba(13,13,26,0.92);
          color: #f59e0b;
          font-size: 11px;
          font-weight: 700;
          padding: 5px 12px;
          border-radius: 20px;
          border: 1px solid rgba(245,158,11,0.3);
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          white-space: nowrap;
        }

        .demo-callout-arrow {
          color: #f59e0b;
          font-size: 20px;
          line-height: 1;
          margin-right: 18px;
        }

        .demo-tara-bubble {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(245,158,11,0.5);
          font-size: 24px;
          font-weight: 900;
          color: #fff;
          position: relative;
          animation: demo-pulse-ring 2.5s ease-in-out infinite;
          margin-right: 8px;
        }

        .demo-tara-bubble::after {
          content: '✦';
          position: absolute;
          bottom: 9px;
          right: 9px;
          font-size: 9px;
          color: rgba(255,255,255,0.85);
          font-weight: 600;
        }

        @keyframes demo-pulse-ring {
          0%, 100% { box-shadow: 0 4px 20px rgba(245,158,11,0.5), 0 0 0 0 rgba(245,158,11,0.4); }
          50%       { box-shadow: 0 4px 20px rgba(245,158,11,0.5), 0 0 0 12px rgba(245,158,11,0); }
        }

        /* Kapruka site mock */
        .kapruka-mock {
          min-height: calc(100vh - 60px);
          font-family: Arial, sans-serif;
          color: #333;
        }

        .kapruka-nav {
          background: #c0392b;
          padding: 0 20px;
          display: flex;
          align-items: center;
          height: 56px;
          gap: 16px;
          position: sticky;
          top: 32px;
          z-index: 5;
        }

        .kapruka-logo-text {
          color: #fff;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.5px;
          font-family: Georgia, serif;
        }

        .kapruka-nav-search {
          flex: 1;
          display: flex;
          gap: 0;
          max-width: 400px;
        }

        .kapruka-nav-search input {
          flex: 1;
          padding: 7px 12px;
          border: none;
          border-radius: 4px 0 0 4px;
          font-size: 13px;
          outline: none;
          color: #333;
        }

        .kapruka-nav-search button {
          padding: 7px 14px;
          background: #e74c3c;
          color: #fff;
          border: none;
          border-radius: 0 4px 4px 0;
          font-size: 13px;
          cursor: pointer;
        }

        .kapruka-nav-links {
          display: flex;
          gap: 16px;
          margin-left: auto;
        }

        .kapruka-nav-links a {
          color: rgba(255,255,255,0.9);
          text-decoration: none;
          font-size: 12px;
        }

        .kapruka-subnav {
          background: #a93226;
          padding: 0 20px;
          display: flex;
          gap: 0;
          overflow-x: auto;
        }

        .kapruka-subnav a {
          color: rgba(255,255,255,0.85);
          text-decoration: none;
          font-size: 12px;
          padding: 9px 14px;
          white-space: nowrap;
          transition: background 0.15s;
        }

        .kapruka-subnav a:hover { background: rgba(0,0,0,0.15); }

        /* Hero banner */
        .kapruka-hero {
          background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%);
          padding: 32px 20px;
          display: flex;
          align-items: center;
          gap: 24px;
          min-height: 200px;
          position: relative;
          overflow: hidden;
        }

        .kapruka-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }

        .kapruka-hero-text { color: #fff; position: relative; z-index: 1; }
        .kapruka-hero-text h2 { font-size: 26px; font-weight: 700; line-height: 1.2; margin-bottom: 8px; }
        .kapruka-hero-text p { font-size: 14px; color: rgba(255,255,255,0.7); }

        .kapruka-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: #e74c3c;
          color: #fff;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 700;
          margin-top: 12px;
          cursor: pointer;
        }

        /* Product grid */
        .kapruka-section { padding: 24px 20px; }
        .kapruka-section-title {
          font-size: 18px;
          font-weight: 700;
          color: #2c3e50;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #e74c3c;
          display: inline-block;
        }

        .kapruka-product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 16px;
        }

        .kapruka-product-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          transition: box-shadow 0.2s ease, transform 0.2s ease;
          background: #fff;
        }

        .kapruka-product-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          transform: translateY(-2px);
        }

        .kapruka-product-img {
          width: 100%;
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          border-bottom: 1px solid #f3f4f6;
        }

        .kapruka-product-info { padding: 10px; }
        .kapruka-product-name { font-size: 12px; color: #374151; font-weight: 600; margin-bottom: 4px; line-height: 1.3; }
        .kapruka-product-price { font-size: 13px; color: #c0392b; font-weight: 700; }

        /* Emoji backgrounds for product cards */
        .bg-cake     { background: linear-gradient(135deg, #fef3c7, #fde68a); }
        .bg-flowers  { background: linear-gradient(135deg, #fce7f3, #fbcfe8); }
        .bg-phone    { background: linear-gradient(135deg, #e0e7ff, #c7d2fe); }
        .bg-grocery  { background: linear-gradient(135deg, #dcfce7, #bbf7d0); }
        .bg-gift     { background: linear-gradient(135deg, #fff7ed, #fed7aa); }
        .bg-clothes  { background: linear-gradient(135deg, #f0fdf4, #bbf7d0); }

        /* ── Right: live widget iframe ───────────────────────────────────────── */
        .demo-right {
          flex: 0 0 45%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          background: #0d0d1a;
          border-left: 1px solid rgba(245, 158, 11, 0.1);
          position: relative;
        }

        .demo-right-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: rgba(13,13,26,0.98);
          border-bottom: 1px solid rgba(245,158,11,0.12);
          flex-shrink: 0;
        }

        .demo-right-label {
          font-size: 11px;
          font-weight: 700;
          color: #f59e0b;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .demo-right-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          animation: demo-blink 2s ease-in-out infinite;
        }

        @keyframes demo-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }

        .demo-right-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #64748b;
        }

        .demo-widget-iframe {
          flex: 1;
          width: 100%;
          border: none;
          display: block;
          background: #0d0d1a;
        }

        /* ── How it works strip ─────────────────────────────────────────────── */
        .demo-how {
          display: flex;
          gap: 0;
          background: rgba(13,13,26,0.97);
          border-top: 1px solid rgba(245,158,11,0.1);
          flex-shrink: 0;
        }

        .demo-step {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-right: 1px solid rgba(255,255,255,0.04);
        }

        .demo-step:last-child { border-right: none; }

        .demo-step-num {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(245,158,11,0.15);
          border: 1px solid rgba(245,158,11,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 800;
          color: #f59e0b;
          flex-shrink: 0;
        }

        .demo-step-text {
          font-size: 10px;
          color: #64748b;
          line-height: 1.4;
        }

        .demo-step-text strong {
          display: block;
          color: #94a3b8;
          font-size: 11px;
        }

        /* ── Mobile ─────────────────────────────────────────────────────────── */
        @media (max-width: 768px) {
          .demo-split {
            flex-direction: column;
            overflow-y: auto;
            overflow-x: hidden;
          }

          .demo-left, .demo-right {
            flex: none;
            width: 100%;
          }

          .demo-left { min-height: 50vh; }

          .demo-right {
            min-height: 70vh;
            border-left: none;
            border-top: 1px solid rgba(245,158,11,0.15);
          }

          .demo-banner {
            flex-wrap: wrap;
            gap: 8px;
          }

          .demo-banner-sub { display: none; }

          .demo-how { display: none; }

          .kapruka-product-grid {
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          }
        }

        @media (max-width: 480px) {
          .demo-banner-badge { display: none; }
          .demo-banner-title { font-size: 13px; }
        }
      `}</style>

      <div className="demo-page">
        {/* ── Banner ────────────────────────────────────────────────────────── */}
        <header className="demo-banner">
          <div className="demo-banner-logo">
            <div className="demo-banner-bubble" aria-hidden="true">T</div>
            <div>
              <div className="demo-banner-title">
                <span>TARA</span> Live Demo
              </div>
              <div className="demo-banner-sub">How it appears on Kapruka.com</div>
            </div>
          </div>

          <div className="demo-banner-badge">
            <span aria-hidden="true">🏆</span> Kapruka Agent Challenge · GMEU6
          </div>

          <div className="demo-banner-spacer" />

          <a
            href="/chrome-extension.zip"
            download="tara-extension.zip"
            className="demo-banner-cta"
            aria-label="Download Chrome Extension ZIP"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Install Chrome Extension →
          </a>
        </header>

        {/* ── Split pane ────────────────────────────────────────────────────── */}
        <div className="demo-split">
          {/* ── Left: Kapruka.com annotated mock ─────────────────────────── */}
          <div className="demo-left">
            <div className="demo-left-ribbon">
              📸 KAPRUKA.COM — Static Preview
              &nbsp;·&nbsp;
              X-Frame-Options prevents live embed
            </div>

            {/* Kapruka mock markup */}
            <div className="kapruka-mock">
              {/* Nav */}
              <nav className="kapruka-nav">
                <span className="kapruka-logo-text">Kapruka</span>
                <div className="kapruka-nav-search">
                  <input type="text" placeholder="Search for gifts, groceries, electronics…" readOnly />
                  <button>🔍</button>
                </div>
                <div className="kapruka-nav-links">
                  <a href="#">Track Order</a>
                  <a href="#">Sign In</a>
                  <a href="#">🛒 Cart</a>
                </div>
              </nav>

              {/* Sub-nav */}
              <div className="kapruka-subnav">
                {['Cakes', 'Flowers', 'Electronics', 'Groceries', 'Fashion', 'Gift Packs', 'International'].map(cat => (
                  <a key={cat} href="#">{cat}</a>
                ))}
              </div>

              {/* Hero */}
              <div className="kapruka-hero">
                <div className="kapruka-hero-text">
                  <h2>Father&apos;s Day Gifts 👨<br/>Delivered Anywhere in Sri Lanka</h2>
                  <p>Same-day delivery available in Colombo & suburbs</p>
                  <div className="kapruka-hero-badge">🎁 Shop Now</div>
                </div>
              </div>

              {/* Product grid */}
              <div className="kapruka-section">
                <div className="kapruka-section-title">Popular Gifts</div>
                <div className="kapruka-product-grid">
                  {[
                    { emoji: '🎂', bg: 'bg-cake',    name: 'Chocolate Birthday Cake', price: 'LKR 2,450' },
                    { emoji: '💐', bg: 'bg-flowers', name: 'Mixed Flower Bouquet',    price: 'LKR 1,890' },
                    { emoji: '📱', bg: 'bg-phone',   name: 'Samsung Galaxy A14',      price: 'LKR 42,500' },
                    { emoji: '🛒', bg: 'bg-grocery', name: 'Monthly Grocery Pack',    price: 'LKR 3,200' },
                    { emoji: '🎁', bg: 'bg-gift',    name: 'Premium Gift Hamper',     price: 'LKR 5,900' },
                    { emoji: '👕', bg: 'bg-clothes', name: 'Men&apos;s Polo Shirt',  price: 'LKR 1,450' },
                  ].map(p => (
                    <div key={p.name} className="kapruka-product-card">
                      <div className={`kapruka-product-img ${p.bg}`}>{p.emoji}</div>
                      <div className="kapruka-product-info">
                        <div className="kapruka-product-name"
                             dangerouslySetInnerHTML={{ __html: p.name }} />
                        <div className="kapruka-product-price">{p.price}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="kapruka-section">
                <div className="kapruka-section-title">Electronics</div>
                <div className="kapruka-product-grid">
                  {[
                    { emoji: '💻', bg: 'bg-phone',   name: 'HP Laptop 15.6"',       price: 'LKR 138,500' },
                    { emoji: '🎧', bg: 'bg-clothes', name: 'Sony WH-1000XM5',        price: 'LKR 64,900' },
                    { emoji: '⌚', bg: 'bg-cake',    name: 'Apple Watch SE',          price: 'LKR 89,000' },
                    { emoji: '📷', bg: 'bg-flowers', name: 'Canon EOS M50',           price: 'LKR 112,000' },
                  ].map(p => (
                    <div key={p.name} className="kapruka-product-card">
                      <div className={`kapruka-product-img ${p.bg}`}>{p.emoji}</div>
                      <div className="kapruka-product-info">
                        <div className="kapruka-product-name">{p.name}</div>
                        <div className="kapruka-product-price">{p.price}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* TARA bubble annotation overlay */}
            <div className="demo-bubble-callout" aria-hidden="true">
              <div className="demo-callout-label">← TARA appears here via Chrome Extension</div>
              <div className="demo-callout-arrow">↘</div>
              <div className="demo-tara-bubble">T</div>
            </div>
          </div>

          {/* ── Right: live /widget iframe ───────────────────────────────── */}
          <div className="demo-right">
            <div className="demo-right-header">
              <span className="demo-right-label">✦ TARA · Live Widget</span>
              <div className="demo-right-status">
                <div className="demo-right-dot" />
                <span>Active · All features enabled</span>
              </div>
            </div>

            <iframe
              className="demo-widget-iframe"
              src="/widget"
              title="TARA AI Shopping Assistant — Live Demo"
              allow="clipboard-write; autoplay"
              loading="eager"
            />

            {/* How it works strip */}
            <div className="demo-how">
              <div className="demo-step">
                <div className="demo-step-num">1</div>
                <div className="demo-step-text">
                  <strong>Install Extension</strong>
                  Injects TARA bubble on Kapruka
                </div>
              </div>
              <div className="demo-step">
                <div className="demo-step-num">2</div>
                <div className="demo-step-text">
                  <strong>Click the Bubble</strong>
                  Panel slides up from bottom-right
                </div>
              </div>
              <div className="demo-step">
                <div className="demo-step-num">3</div>
                <div className="demo-step-text">
                  <strong>Shop with AI</strong>
                  Chat · Search · Cart · Checkout
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
