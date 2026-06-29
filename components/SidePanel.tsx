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

const FALLBACK_CATEGORIES = [
  { id:'flowers',   emoji: '💐', name: 'Flowers',         query: 'Show me flowers and bouquets on Kapruka'       },
  { id:'cakes',     emoji: '🎂', name: 'Cakes',            query: 'Show me birthday cakes on Kapruka'              },
  { id:'gifts',     emoji: '🎁', name: 'Gift Hampers',     query: 'Show me gift hampers on Kapruka'                },
  { id:'elec',      emoji: '📱', name: 'Electronics',      query: 'Show me electronics on Kapruka'                 },
  { id:'fashion',   emoji: '👗', name: 'Fashion',          query: 'Show me fashion and clothing on Kapruka'        },
  { id:'grocery',   emoji: '🛒', name: 'Groceries',        query: 'Show me groceries on Kapruka'                   },
  { id:'books',     emoji: '📚', name: 'Books',            query: 'Show me books on Kapruka'                       },
  { id:'toys',      emoji: '🎮', name: 'Toys & Games',     query: 'Show me toys and games on Kapruka'             },
  { id:'jewelry',   emoji: '💍', name: 'Jewelry',          query: 'Show me jewelry on Kapruka'                    },
  { id:'choc',      emoji: '🍫', name: 'Chocolates',       query: 'Show me chocolates and sweets on Kapruka'      },
  { id:'health',    emoji: '🌿', name: 'Health & Beauty',  query: 'Show me health and beauty products on Kapruka' },
  { id:'home',      emoji: '🏠', name: 'Home & Living',    query: 'Show me home and decor on Kapruka'             },
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

/* ─── Types ────────────────────────────────────────────────────────────── */
type CatItem = {
  id:      string;
  name:    string;
  emoji:   string;
  query:   string;
  url?:    string;   // Kapruka page URL — present when MCP returned one
  parent?: string;   // set for level-2 items; absent for top-level
};

type L3Item = {
  name:  string;
  url:   string;
  emoji: string;
  query: string;
};

/* ─── Shared card button ────────────────────────────────────────────────── */
function CatBtn({
  emoji, name, onClick, showArrow = false, disabled = false,
}: {
  emoji: string; name: string; onClick: () => void;
  showArrow?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 12px', borderRadius: 10,
        cursor: disabled ? 'default' : 'pointer',
        background: 'var(--c-surface-container)',
        border: '1px solid rgba(74,68,81,0.25)',
        transition: 'all 0.15s ease', textAlign: 'left',
        opacity: disabled ? 0.5 : 1, width: '100%',
      }}
      onMouseOver={e => {
        if (!disabled) {
          e.currentTarget.style.background    = 'var(--c-surface-container-high)';
          e.currentTarget.style.borderColor   = 'rgba(215,186,255,0.30)';
        }
      }}
      onMouseOut={e => {
        e.currentTarget.style.background  = 'var(--c-surface-container)';
        e.currentTarget.style.borderColor = 'rgba(74,68,81,0.25)';
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-on-surface)', lineHeight: 1.3, flex: 1 }}>
        {name}
      </span>
      {showArrow && (
        <ChevronRightIcon size={12} style={{ color: 'var(--c-outline)', flexShrink: 0 }} />
      )}
    </button>
  );
}

/* ─── Back button ───────────────────────────────────────────────────────── */
function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 10px', borderRadius: 20,
        background: 'rgba(189,147,249,0.12)',
        border: '1px solid rgba(189,147,249,0.30)',
        color: 'var(--c-primary)', fontSize: 12, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'var(--font-body)', flexShrink: 0,
      }}
    >
      <ChevronRightIcon size={12} style={{ transform: 'rotate(180deg)' }} />
      Back
    </button>
  );
}

/* ─── Skeleton grid ─────────────────────────────────────────────────────── */
function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 48, borderRadius: 10 }} />
      ))}
    </div>
  );
}

/* ─── BrowsePanel — 3-level navigation ─────────────────────────────────── */
function BrowsePanel({ onCategorySearch, onClose }: { onCategorySearch: (q: string) => void; onClose: () => void }) {
  /* Level 1+2 from MCP */
  const [categories, setCategories] = useState<CatItem[]>([]);
  const [catLoading, setCatLoading] = useState(true);

  /* Drill-down state */
  const [selected,    setSelected]    = useState<CatItem | null>(null);
  const [selectedSub, setSelectedSub] = useState<CatItem | null>(null);
  const [level3,      setLevel3]      = useState<L3Item[]>([]);
  const [loadingL3,   setLoadingL3]   = useState(false);

  /* Search — only active on top-level view */
  const [search, setSearch] = useState('');

  /* Fetch level 1+2 on mount */
  useEffect(() => {
    fetch('/api/categories')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => setCategories(
        Array.isArray(d.categories) && d.categories.length > 0 ? d.categories : FALLBACK_CATEGORIES
      ))
      .catch(() => setCategories(FALLBACK_CATEGORIES))
      .finally(() => setCatLoading(false));
  }, []);

  /* Derived lists */
  const topLevel  = categories.filter(c => !c.parent);
  const totalSubs = categories.filter(c => !!c.parent).length;
  const subItems  = selected ? categories.filter(c => c.parent === selected.name) : [];

  /* Search — across top-level AND subcategories */
  const q = search.trim().toLowerCase();
  const searchResults: (CatItem & { _isSub?: boolean })[] = q
    ? [
        /* Matching top-level categories */
        ...topLevel
          .filter(c => c.name.toLowerCase().includes(q))
          .map(c => ({ ...c, _isSub: false })),
        /* Matching subcategories (level-2) */
        ...categories
          .filter(c => !!c.parent && c.name.toLowerCase().includes(q))
          .map(c => ({ ...c, _isSub: true })),
      ]
    : [];

  /* ── Handlers ─────────────────────────────────────────────────────── */

  /* Clicking a top-level category */
  const handleTopClick = (cat: CatItem) => {
    const hasSubs = categories.some(c => c.parent === cat.name);
    if (hasSubs) {
      setSelected(cat);
      setSelectedSub(null);
      setLevel3([]);
    } else {
      onCategorySearch(cat.query);
      onClose();
    }
  };

  /* Clicking a level-2 subcategory — try to fetch level-3, else search */
  const handleSubClick = async (cat: CatItem) => {
    if (!cat.url) {
      onCategorySearch(cat.query);
      onClose();
      return;
    }

    setSelectedSub(cat);
    setLoadingL3(true);
    setLevel3([]);

    try {
      const res  = await fetch(`/api/categories?sub=${encodeURIComponent(cat.url)}`);
      const data = await res.json() as { subcategories?: L3Item[] };
      const subs = data.subcategories ?? [];

      if (subs.length > 0) {
        setLevel3(subs);
      } else {
        /* No level-3 exists — trigger search directly */
        onCategorySearch(cat.query);
        onClose();
      }
    } catch {
      onCategorySearch(cat.query);
      onClose();
    } finally {
      setLoadingL3(false);
    }
  };

  /* Clicking a level-3 sub-subcategory */
  const handleL3Click = (item: L3Item) => {
    onCategorySearch(item.query);
    onClose();
  };

  /* ── Breadcrumb / header ──────────────────────────────────────────── */
  const view: 'top' | 'l2' | 'l3' = level3.length > 0 || loadingL3 ? 'l3' : selected ? 'l2' : 'top';

  const handleBack = () => {
    if (view === 'l3') { setLevel3([]); setSelectedSub(null); }
    else               { setSelected(null); setSelectedSub(null); setLevel3([]); setSearch(''); }
  };

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: 16 }}>

      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: view === 'top' ? 2 : 10 }}>
        {view !== 'top' && <BackBtn onClick={handleBack} />}
        <p style={{
          fontSize: 11, fontWeight: 700, color: 'var(--c-outline)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          margin: 0, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {catLoading
            ? 'Loading categories…'
            : view === 'l3' && selectedSub ? `${selectedSub.emoji} ${selectedSub.name}`
            : view === 'l2' && selected    ? `${selected.emoji} ${selected.name}`
            : `${topLevel.length} Kapruka Categories`}
        </p>
        {view === 'l2' && subItems.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--c-outline)', flexShrink: 0 }}>{subItems.length} items</span>
        )}
        {view === 'l3' && level3.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--c-outline)', flexShrink: 0 }}>{level3.length} items</span>
        )}
      </div>

      {/* ── Subcategory count subtitle — top view only ── */}
      {view === 'top' && !catLoading && (
        <p style={{
          fontSize: 10, color: 'var(--c-outline)', margin: '0 0 10px',
          letterSpacing: '0.04em', opacity: 0.75,
        }}>
          {totalSubs} subcategories across all categories
        </p>
      )}

      {/* ── Search bar — top view only ── */}
      {view === 'top' && !catLoading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 10, marginBottom: 12,
          background: 'var(--c-surface-container)',
          border: '1px solid rgba(74,68,81,0.35)',
        }}>
          {/* Search icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--c-outline)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search categories…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 13, color: 'var(--c-on-surface)', fontFamily: 'var(--font-body)',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--c-outline)', padding: 0, lineHeight: 1,
                fontSize: 16, display: 'flex', alignItems: 'center',
              }}
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* ── View: top-level loading skeleton ── */}
      {catLoading && <SkeletonGrid count={8} />}

      {/* ── View: top-level categories (L1) or search results ── */}
      {!catLoading && view === 'top' && (
        q ? (
          /* ── Search results: single-column with parent labels ── */
          searchResults.length === 0
            ? (
              <p style={{ fontSize: 13, color: 'var(--c-outline)', textAlign: 'center', padding: '24px 0' }}>
                No results for &ldquo;{search}&rdquo;
              </p>
            ) : (
              <>
                <p style={{ fontSize: 10, color: 'var(--c-outline)', marginBottom: 8, opacity: 0.75 }}>
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {searchResults.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => cat._isSub ? handleSubClick(cat) : handleTopClick(cat)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                        background: 'var(--c-surface-container)',
                        border: '1px solid rgba(74,68,81,0.25)',
                        transition: 'all 0.15s ease', textAlign: 'left', width: '100%',
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.background   = 'var(--c-surface-container-high)';
                        e.currentTarget.style.borderColor  = 'rgba(215,186,255,0.30)';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.background  = 'var(--c-surface-container)';
                        e.currentTarget.style.borderColor = 'rgba(74,68,81,0.25)';
                      }}
                    >
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{cat.emoji}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          display: 'block', fontSize: 13, fontWeight: 600,
                          color: 'var(--c-on-surface)', lineHeight: 1.3,
                        }}>
                          {cat.name}
                        </span>
                        {cat._isSub && cat.parent && (
                          <span style={{
                            display: 'block', fontSize: 10, color: 'var(--c-outline)',
                            marginTop: 2, opacity: 0.8,
                          }}>
                            in {cat.parent}
                          </span>
                        )}
                      </span>
                      {!cat._isSub && categories.some(c => c.parent === cat.name) && (
                        <ChevronRightIcon size={12} style={{ color: 'var(--c-outline)', flexShrink: 0 }} />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )
        ) : (
          /* ── Normal 2-column grid ── */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {topLevel.map(cat => (
              <CatBtn
                key={cat.id}
                emoji={cat.emoji}
                name={cat.name}
                onClick={() => handleTopClick(cat)}
                showArrow={categories.some(c => c.parent === cat.name)}
              />
            ))}
          </div>
        )
      )}

      {/* ── View: level-2 subcategories ── */}
      {!catLoading && view === 'l2' && selected && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <CatBtn
            key="__all__"
            emoji={selected.emoji}
            name={`All ${selected.name}`}
            onClick={() => { onCategorySearch(selected.query); onClose(); }}
          />
          {subItems.map(sub => (
            <CatBtn
              key={sub.id}
              emoji={sub.emoji}
              name={sub.name}
              onClick={() => handleSubClick(sub)}
              showArrow={!!sub.url}
            />
          ))}
        </div>
      )}

      {/* ── View: level-3 loading skeleton ── */}
      {loadingL3 && (
        <>
          <p style={{ fontSize: 11, color: 'var(--c-outline)', marginBottom: 8 }}>Fetching subcategories…</p>
          <SkeletonGrid count={6} />
        </>
      )}

      {/* ── View: level-3 scraped sub-subcategories ── */}
      {!loadingL3 && view === 'l3' && selectedSub && level3.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <CatBtn
            key="__all_sub__"
            emoji={selectedSub.emoji}
            name={`All ${selectedSub.name}`}
            onClick={() => { onCategorySearch(selectedSub.query); onClose(); }}
          />
          {level3.map((item, i) => (
            <CatBtn
              key={i}
              emoji={item.emoji}
              name={item.name}
              onClick={() => handleL3Click(item)}
            />
          ))}
        </div>
      )}
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