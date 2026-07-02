'use client';
import { useState, useMemo } from 'react';
import ProductCard from './ProductCard';
import ProductModal from './ProductModal';
import { Product } from '@/context/CartContext';
import { STRINGS, Lang } from '@/lib/strings';
import { ChevronRightIcon } from './Icons';

interface ProductPanelProps {
  products: (Product & { url?: string })[];
  lang: Lang;
  loading: boolean;
  quantum?: boolean;
}

type SortMode = 'default' | 'asc' | 'desc';

const SORT_OPTS: { key: SortMode; label: string; title: string }[] = [
  { key: 'default', label: '≈',  title: 'Relevance (default)' },
  { key: 'asc',     label: '↑₂', title: 'Price: Low → High'   },
  { key: 'desc',    label: '↓₂', title: 'Price: High → Low'   },
];

export default function ProductPanel({ products, lang, loading, quantum }: ProductPanelProps) {
  const s = STRINGS[lang];
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string>('');
  const [sortMode,    setSortMode]    = useState<SortMode>('default');
  const [stockOnly,   setStockOnly]   = useState(false);
  const [panelOpen,   setPanelOpen]   = useState(true);

  const sorted = useMemo(() => {
    if (sortMode === 'default') return products;
    return [...products].sort((a, b) =>
      sortMode === 'asc' ? a.price - b.price : b.price - a.price
    );
  }, [products, sortMode]);

  /* Apply in-stock filter after sort */
  const filtered = useMemo(() => {
    if (!stockOnly) return sorted;
    return sorted.filter(p =>
      p.in_stock === true ||
      (typeof p.stock === 'string' && /in.?stock/i.test(p.stock))
    );
  }, [sorted, stockOnly]);

  const inStockCount = useMemo(() =>
    products.filter(p =>
      p.in_stock === true ||
      (typeof p.stock === 'string' && /in.?stock/i.test(p.stock))
    ).length
  , [products]);

  return (
    <div className="flex flex-col h-full relative" style={{ background: 'transparent' }}>

      {/* ── Panel header ─────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 flex-wrap"
        style={{
          borderBottom: '1px solid rgba(74,68,81,0.30)',
          background: 'rgba(16,11,36,0.65)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}>

        {/* Title + count */}
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-outline)' }}>
          Products
        </span>

        {products.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 8px', borderRadius: 9999, background: 'rgba(189,147,249,0.15)', border: '1px solid rgba(189,147,249,0.30)', color: 'var(--c-primary)' }}>
            {products.length}
          </span>
        )}

        {quantum && products.length > 0 && (
          <span className="animate-quantum flex items-center gap-1"
            style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 9999, background: 'rgba(189,147,249,0.12)', border: '1px solid rgba(189,147,249,0.25)', color: 'var(--c-primary)' }}>
            ✦ Quantum
          </span>
        )}

        {/* In-stock toggle */}
        {products.length > 0 && (
          <button
            onClick={() => setStockOnly(v => !v)}
            title={stockOnly ? 'Show all products' : 'Show in-stock only'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 9px', borderRadius: 8,
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: stockOnly ? 'rgba(74,222,128,0.15)' : 'rgba(44,39,60,0.70)',
              color:      stockOnly ? '#4ade80'               : 'var(--c-outline)',
              border: `1px solid ${stockOnly ? 'rgba(74,222,128,0.40)' : 'rgba(74,68,81,0.35)'}`,
              transition: 'all 0.15s', fontFamily: 'var(--font-body)',
              boxShadow: stockOnly ? '0 2px 8px rgba(74,222,128,0.15)' : 'none',
            }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: stockOnly ? '#4ade80' : 'var(--c-outline)', flexShrink: 0, boxShadow: stockOnly ? '0 0 4px #4ade80' : 'none' }}/>
            In Stock{inStockCount > 0 && !stockOnly ? ` (${inStockCount})` : ''}
          </button>
        )}

        {/* Right-aligned group: sort controls + collapse toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {products.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 10, color: 'var(--c-outline)', marginRight: 2 }}>Sort</span>
              {SORT_OPTS.map(opt => (
                <button
                  key={opt.key}
                  title={opt.title}
                  onClick={() => setSortMode(opt.key)}
                  style={{
                    padding: '3px 8px', borderRadius: 8,
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: sortMode === opt.key ? 'var(--c-primary-container)' : 'rgba(44,39,60,0.70)',
                    color:      sortMode === opt.key ? 'var(--c-on-primary-container)' : 'var(--c-outline)',
                    border: `1px solid ${sortMode === opt.key ? 'transparent' : 'rgba(74,68,81,0.35)'}`,
                    transition: 'all 0.15s',
                    fontFamily: 'var(--font-body)',
                    boxShadow: sortMode === opt.key ? '0 2px 8px rgba(189,147,249,0.25)' : 'none',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Collapse / expand whole product list */}
          {products.length > 0 && (
            <button
              onClick={() => setPanelOpen(v => !v)}
              title={panelOpen ? 'Hide products' : 'Show products'}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 9px', borderRadius: 8,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(44,39,60,0.70)', color: 'var(--c-outline)',
                border: '1px solid rgba(74,68,81,0.35)',
                transition: 'all 0.15s', fontFamily: 'var(--font-body)',
              }}>
              <span style={{ display: 'inline-flex', transform: panelOpen ? 'rotate(90deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
                <ChevronRightIcon size={12}/>
              </span>
              {panelOpen ? 'Hide' : 'Show'}
            </button>
          )}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────── */}
      {panelOpen && (
      <div className="flex-1 overflow-y-auto p-3">

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden"
                style={{ background: 'var(--c-surface-container)', border: '1px solid rgba(74,68,81,0.30)' }}>
                <div className="skeleton" style={{ paddingTop: '75%' }}/>
                <div className="p-3 space-y-2">
                  <div className="skeleton rounded h-3 w-full"/>
                  <div className="skeleton rounded h-3 w-3/4"/>
                  <div className="skeleton rounded h-4 w-1/2 mt-1"/>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && products.length === 0 && (
          <div className="flex items-center justify-center h-full min-h-[260px]">
            <div style={{ textAlign: 'center', padding: 24 }}>
              <img src="/kapruka-logo.png" alt="Kapruka"
                style={{ width: 56, height: 56, objectFit: 'contain', margin: '0 auto 12px', opacity: 0.5 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-on-surface)', marginBottom: 4 }}>{s.emptyProducts}</p>
              <p style={{ fontSize: 12, color: 'var(--c-outline)' }}>{s.emptyProductsSub}</p>
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <>
            {/* Active filter/sort indicators */}
            {(sortMode !== 'default' || stockOnly) && (
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {sortMode !== 'default' && (
                  <span style={{ fontSize: 11, color: 'var(--c-on-surface-variant)', fontWeight: 500 }}>
                    {sortMode === 'asc' ? '↑ Price: low to high' : '↓ Price: high to low'}
                  </span>
                )}
                {stockOnly && (
                  <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700 }}>
                    ● In stock only · {filtered.length} item{filtered.length !== 1 ? 's' : ''}
                  </span>
                )}
                <button onClick={() => { setSortMode('default'); setStockOnly(false); }}
                  style={{ fontSize: 11, color: 'var(--c-outline)', cursor: 'pointer', background: 'transparent', border: 'none', fontFamily: 'var(--font-body)', marginLeft: 2 }}>
                  ✕ clear
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filtered.map((p, i) => (
                <ProductCard key={p.id} product={p} lang={lang} index={i}
                  onViewDetail={(id, url) => { setSelectedId(id); setSelectedUrl(url); }}
                />
              ))}
            </div>
          </>
        )}

        {/* Empty after filter */}
        {!loading && filtered.length === 0 && products.length > 0 && (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <p style={{ fontSize: 14, color: 'var(--c-on-surface-variant)', marginBottom: 8 }}>No in-stock items found.</p>
            <button onClick={() => setStockOnly(false)}
              style={{ fontSize: 13, color: 'var(--c-primary)', cursor: 'pointer', background: 'transparent', border: 'none', fontFamily: 'var(--font-body)' }}>
              Show all {products.length} products →
            </button>
          </div>
        )}
      </div>
      )}

      {/* Modal */}
      {selectedId && (
        <ProductModal
          productId={selectedId}
          productUrl={selectedUrl}
          lang={lang}
          allProducts={filtered}
          onClose={() => { setSelectedId(null); setSelectedUrl(''); }}
        />
      )}
    </div>
  );
}