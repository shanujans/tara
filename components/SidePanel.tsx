'use client';
import { useEffect, useState } from 'react';
import { XIcon, PackageIcon, RewardsIcon, BrowseIcon, SettingsIcon, HelpIcon, ChevronRightIcon, TrashIcon } from './Icons';
import { Lang, STRINGS } from '@/lib/strings';

export type PanelId = 'none' | 'history' | 'rewards' | 'browse' | 'settings' | 'help' | 'notifications';

interface SidePanelProps {
  panel: PanelId;
  lang: Lang;
  onClose: () => void;
  onCategorySearch: (query: string) => void;
  onLangChange: (l: Lang) => void;
  onClearChat: () => void;
}

const CATEGORIES = [
  { emoji: '🎂', name: 'Birthday Cakes',   query: 'birthday cake'      },
  { emoji: '💐', name: 'Flowers',           query: 'flowers bouquet'    },
  { emoji: '🎁', name: 'Gift Hampers',      query: 'gift hamper'        },
  { emoji: '📱', name: 'Electronics',       query: 'electronics mobile' },
  { emoji: '👗', name: 'Fashion',           query: 'fashion clothing'   },
  { emoji: '🛒', name: 'Groceries',         query: 'groceries food'     },
  { emoji: '📚', name: 'Books',             query: 'books'              },
  { emoji: '🎮', name: 'Toys & Games',      query: 'toys games'         },
  { emoji: '💍', name: 'Jewelry',           query: 'jewelry gold'       },
  { emoji: '🌿', name: 'Health & Beauty',   query: 'health beauty'      },
  { emoji: '🏠', name: 'Home & Living',     query: 'home decor'         },
  { emoji: '🍫', name: 'Chocolates',        query: 'chocolates sweets'  },
];

const FAQS = [
  { q: 'How do I place an order?', a: 'Just tell TARA what you want — she\'ll find it, let you add to cart, and guide you to payment.' },
  { q: 'What languages does TARA support?', a: 'Sinhala (සිං), Sihalish (SL), Tamil (த), Tanglish (TL) and English (EN). Switch with the language pills.' },
  { q: 'How does payment work?', a: 'After checkout, TARA hands off to Kapruka\'s secure payment page. Your card details never touch our servers.' },
  { q: 'Can I order from abroad?', a: 'Yes! Tell TARA "I\'m ordering from abroad" and she\'ll switch to Expat mode — perfect for the diaspora.' },
  { q: 'How fast is delivery?', a: 'Express (next-day) and Standard available. TARA will check delivery dates for your city.' },
  { q: 'How do I track my order?', a: 'Just paste your order ID in the chat — e.g. "Track KAP123456".' },
];

const LANG_OPTIONS: { key: Lang; label: string }[] = [
  { key: 'en', label: '🇬🇧 English' },
  { key: 'si', label: '🇱🇰 සිංහල'   },
  { key: 'sl', label: '🇱🇰 Sihalish' },
  { key: 'ta', label: '🇱🇰 தமிழ்'    },
  { key: 'tl', label: '🇱🇰 Tanglish' },
];

interface LastOrder { order_id?: string; items: { id: string; name: string; price: number; image: string }[]; date?: string; }

function HistoryPanel({ lang }: { lang: Lang }) {
  const [order, setOrder] = useState<LastOrder | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('tara_last_order');
      if (raw) setOrder(JSON.parse(raw));
    } catch { /* */ }
  }, []);

  if (!order || order.items.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <PackageIcon size={40} style={{ color: 'var(--c-outline)', margin: '0 auto 12px', display: 'block' }} />
        <p style={{ color: 'var(--c-on-surface-variant)', fontSize: 14 }}>No order history yet.</p>
        <p style={{ color: 'var(--c-outline)', fontSize: 12, marginTop: 4 }}>Your last order will appear here after checkout.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-outline)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        Last Order {order.date ? `· ${new Date(order.date).toLocaleDateString()}` : ''}
      </p>
      {order.items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', gap: 10, alignItems: 'center',
          padding: '10px 12px', borderRadius: 10, marginBottom: 6,
          background: 'var(--c-surface-container)',
          border: '1px solid rgba(74,68,81,0.25)',
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--c-surface-container-high)', flexShrink: 0, overflow: 'hidden' }}>
            {item.image && <img src={`/api/img?url=${encodeURIComponent(item.image)}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-on-surface)', lineHeight: 1.3 }} className="line-clamp-2">{item.name}</p>
            <p style={{ fontSize: 12, color: 'var(--c-secondary)', fontWeight: 700, marginTop: 2 }}>Rs. {item.price.toLocaleString('si-LK')}</p>
          </div>
        </div>
      ))}
      {order.order_id && (
        <p style={{ fontSize: 11, color: 'var(--c-outline)', marginTop: 8, textAlign: 'center' }}>
          Order ID: {order.order_id}
        </p>
      )}
    </div>
  );
}

function RewardsPanel() {
  return (
    <div style={{ padding: 24 }}>
      {/* Points card */}
      <div style={{
        borderRadius: 16, padding: '20px 24px', marginBottom: 16,
        background: 'linear-gradient(135deg, rgba(64,20,120,0.6), rgba(113,74,170,0.4))',
        border: '1px solid rgba(215,186,255,0.25)',
      }}>
        <p style={{ fontSize: 12, color: 'var(--c-primary)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>TARA Points</p>
        <p style={{ fontSize: 42, fontWeight: 700, color: 'var(--c-on-surface)', fontFamily: 'var(--font-headline)', lineHeight: 1.1, margin: '8px 0 4px' }}>0</p>
        <p style={{ fontSize: 12, color: 'var(--c-on-surface-variant)' }}>Points earned on Kapruka orders</p>
      </div>
      {[
        { emoji: '🛍️', label: 'First order',          pts: '+50 pts',  done: false },
        { emoji: '⭐',  label: 'Rate a product',       pts: '+10 pts',  done: false },
        { emoji: '🌍',  label: 'Expat mode order',     pts: '+25 pts',  done: false },
        { emoji: '🎁',  label: 'Send a gift',          pts: '+15 pts',  done: false },
      ].map(r => (
        <div key={r.label} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 12px', borderRadius: 10, marginBottom: 6,
          background: r.done ? 'rgba(197,205,101,0.08)' : 'var(--c-surface-container)',
          border: `1px solid ${r.done ? 'rgba(197,205,101,0.25)' : 'rgba(74,68,81,0.25)'}`,
          opacity: r.done ? 1 : 0.7,
        }}>
          <span style={{ fontSize: 20 }}>{r.emoji}</span>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--c-on-surface)' }}>{r.label}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: r.done ? 'var(--c-secondary)' : 'var(--c-outline)' }}>{r.pts}</span>
        </div>
      ))}
      <p style={{ fontSize: 11, color: 'var(--c-outline)', textAlign: 'center', marginTop: 12 }}>Rewards program — coming soon</p>
    </div>
  );
}

function BrowsePanel({ onCategorySearch, onClose }: { onCategorySearch: (q: string) => void; onClose: () => void }) {
  return (
    <div style={{ padding: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-outline)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        Shop by Category
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.name}
            onClick={() => { onCategorySearch(cat.query); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 12px', borderRadius: 10, cursor: 'pointer',
              background: 'var(--c-surface-container)',
              border: '1px solid rgba(74,68,81,0.25)',
              transition: 'all 0.15s ease',
              textAlign: 'left',
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'var(--c-surface-container-high)'; e.currentTarget.style.borderColor = 'rgba(215,186,255,0.30)'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'var(--c-surface-container)'; e.currentTarget.style.borderColor = 'rgba(74,68,81,0.25)'; }}
          >
            <span style={{ fontSize: 20 }}>{cat.emoji}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-on-surface)', lineHeight: 1.3 }}>{cat.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel({ lang, onLangChange, onClearChat, onClose }: { lang: Lang; onLangChange: (l: Lang) => void; onClearChat: () => void; onClose: () => void }) {
  const [cleared, setCleared] = useState(false);
  return (
    <div style={{ padding: 16 }}>
      {/* Language */}
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-outline)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Language</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
        {LANG_OPTIONS.map(o => (
          <button
            key={o.key}
            onClick={() => onLangChange(o.key)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
              background: lang === o.key ? 'rgba(189,147,249,0.15)' : 'var(--c-surface-container)',
              border: `1px solid ${lang === o.key ? 'rgba(189,147,249,0.40)' : 'rgba(74,68,81,0.25)'}`,
              color: lang === o.key ? 'var(--c-primary)' : 'var(--c-on-surface-variant)',
              fontWeight: lang === o.key ? 700 : 500, fontSize: 14,
              transition: 'all 0.15s',
              fontFamily: 'var(--font-body)',
            }}
          >
            {o.label}
            {lang === o.key && <span style={{ fontSize: 12, color: 'var(--c-primary-container)' }}>✓</span>}
          </button>
        ))}
      </div>

      {/* Chat actions */}
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-outline)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Chat</p>
      <button
        onClick={() => { onClearChat(); setCleared(true); onClose(); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
          background: cleared ? 'rgba(197,205,101,0.10)' : 'var(--c-surface-container)',
          border: '1px solid rgba(74,68,81,0.25)',
          color: cleared ? 'var(--c-secondary)' : 'var(--c-on-surface-variant)',
          fontSize: 14, fontWeight: 500, transition: 'all 0.15s',
          fontFamily: 'var(--font-body)',
        }}
      >
        <TrashIcon size={16} />
        {cleared ? 'Chat cleared!' : 'Clear chat history'}
      </button>

      {/* About */}
      <div style={{ marginTop: 20, padding: '12px 14px', borderRadius: 10, background: 'var(--c-surface-container)', border: '1px solid rgba(74,68,81,0.25)' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-on-surface)', marginBottom: 4 }}>TARA v1.0 · GMEU6</p>
        <p style={{ fontSize: 11, color: 'var(--c-outline)' }}>AI Retail Agent · Kapruka Agent Challenge · Built with Next.js 16 · Powered by Gemini</p>
      </div>
    </div>
  );
}

function HelpPanel() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div style={{ padding: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-outline)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        Frequently Asked Questions
      </p>
      {FAQS.map((faq, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              width: '100%', padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
              background: open === i ? 'rgba(189,147,249,0.12)' : 'var(--c-surface-container)',
              border: `1px solid ${open === i ? 'rgba(189,147,249,0.30)' : 'rgba(74,68,81,0.25)'}`,
              color: 'var(--c-on-surface)', fontSize: 13, fontWeight: 600,
              textAlign: 'left', transition: 'all 0.15s',
              fontFamily: 'var(--font-body)',
            }}
          >
            <span>{faq.q}</span>
            <ChevronRightIcon size={14} style={{ transform: open === i ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0, color: 'var(--c-outline)' }} />
          </button>
          {open === i && (
            <div style={{ padding: '10px 14px', background: 'rgba(34,28,49,0.60)', borderRadius: '0 0 10px 10px', margin: '-4px 0 0', border: '1px solid rgba(74,68,81,0.20)', borderTop: 'none' }}>
              <p style={{ fontSize: 13, color: 'var(--c-on-surface-variant)', lineHeight: 1.6 }}>{faq.a}</p>
            </div>
          )}
        </div>
      ))}
      <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(197,205,101,0.08)', border: '1px solid rgba(197,205,101,0.20)', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--c-secondary)', fontWeight: 700, marginBottom: 4 }}>Still need help?</p>
        <p style={{ fontSize: 12, color: 'var(--c-on-surface-variant)' }}>Type your question in the chat — TARA will help you!</p>
      </div>
    </div>
  );
}

const PANEL_META: Record<Exclude<PanelId,'none'>, { title: string; icon: React.ReactNode }> = {
  history:       { title: 'Order History',   icon: <PackageIcon  size={18} /> },
  rewards:       { title: 'Rewards',          icon: <RewardsIcon  size={18} /> },
  browse:        { title: 'Browse Categories',icon: <BrowseIcon   size={18} /> },
  settings:      { title: 'Settings',         icon: <SettingsIcon size={18} /> },
  help:          { title: 'Help & FAQ',        icon: <HelpIcon     size={18} /> },
  notifications: { title: 'Notifications',    icon: <BellIcon     size={18} /> },
};
import { BellIcon } from './Icons';

export default function SidePanel({ panel, lang, onClose, onCategorySearch, onLangChange, onClearChat }: SidePanelProps) {
  const visible = panel !== 'none';

  return (
    <>
      {/* Backdrop */}
      {visible && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 45,
            background: 'rgba(16,11,31,0.60)',
            backdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* Slide-in panel */}
      <div style={{
        position: 'fixed',
        top: 64, right: 0, bottom: 0,
        width: Math.min(340, typeof window !== 'undefined' ? window.innerWidth - 16 : 340),
        zIndex: 46,
        display: 'flex', flexDirection: 'column',
        background: 'rgba(29,24,45,0.96)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(74,68,81,0.30)',
        transform: visible ? 'translateX(0)' : 'translateX(110%)',
        transition: 'transform 0.30s cubic-bezier(0.32,0.72,0,1)',
      }}>
        {/* Header */}
        {visible && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 16px',
              borderBottom: '1px solid rgba(74,68,81,0.25)',
              flexShrink: 0,
            }}>
              <span style={{ color: 'var(--c-primary)' }}>{PANEL_META[panel].icon}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-on-surface)', flex: 1, fontFamily: 'var(--font-headline)' }}>
                {PANEL_META[panel].title}
              </span>
              <button onClick={onClose} style={{ color: 'var(--c-outline)', cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}>
                <XIcon size={18} />
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {panel === 'history'       && <HistoryPanel lang={lang} />}
              {panel === 'rewards'       && <RewardsPanel />}
              {panel === 'browse'        && <BrowsePanel onCategorySearch={onCategorySearch} onClose={onClose} />}
              {panel === 'settings'      && <SettingsPanel lang={lang} onLangChange={onLangChange} onClearChat={onClearChat} onClose={onClose} />}
              {panel === 'help'          && <HelpPanel />}
              {panel === 'notifications' && (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <BellIcon size={40} style={{ color: 'var(--c-outline)', margin: '0 auto 12px', display: 'block' }} />
                  <p style={{ color: 'var(--c-on-surface-variant)', fontSize: 14 }}>No notifications yet.</p>
                  <p style={{ color: 'var(--c-outline)', fontSize: 12, marginTop: 4 }}>Order updates will appear here.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}