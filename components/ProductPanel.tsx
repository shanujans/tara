'use client';
import { useState } from 'react';
import ProductCard from './ProductCard';
import ProductModal from './ProductModal';
import { Product } from '@/context/CartContext';
import { STRINGS, Lang } from '@/lib/strings';

interface ProductPanelProps {
  products: (Product & { url?: string })[];
  lang: Lang;
  loading: boolean;
  quantum?: boolean;
}

export default function ProductPanel({ products, lang, loading, quantum }: ProductPanelProps) {
  const s = STRINGS[lang];
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string>('');

  return (
    <div className="flex flex-col h-full relative" style={{ background: 'transparent' }}>

      {/* Panel header */}
      <div className="flex-shrink-0 flex items-center gap-2.5 px-5 py-3"
        style={{
          borderBottom: '1px solid rgba(107,77,171,0.40)',
          background: 'rgba(5,3,15,0.65)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}>
        <span className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--t-text-3)' }}>
          Products
        </span>

        {products.length > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(64,41,112,0.30)',
              border: '1px solid rgba(107,77,171,0.40)',
              color: '#c7abff',
            }}>
            {products.length}
          </span>
        )}

        {quantum && products.length > 0 && (
          <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ml-auto animate-quantum"
            style={{
              background: 'rgba(64,41,112,0.25)',
              border: '1px solid rgba(107,77,171,0.40)',
              color: '#c7abff',
            }}>
            ✦ Quantum
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* Skeleton loading */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--t-glass-card)', border: '1px solid var(--t-border)' }}>
                {/* 4:3 skeleton */}
                <div className="skeleton" style={{ paddingTop: '75%' }} />
                <div className="p-3 space-y-2">
                  <div className="skeleton rounded h-3 w-full" />
                  <div className="skeleton rounded h-3 w-3/4" />
                  <div className="skeleton rounded h-4 w-1/2 mt-1" />
                  <div className="skeleton rounded h-8 w-full mt-1" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && products.length === 0 && (
          <div className="flex items-center justify-center h-full min-h-[300px]">
            <div className="glass-card rounded-3xl p-10 flex flex-col items-center gap-5 text-center max-w-xs"
              style={{ boxShadow: '0 24px 64px rgba(64,41,112,0.18)' }}>
              {/* Kapruka logo — place your PNG at public/kapruka-logo.png */}
              <div className="relative flex items-center justify-center"
                style={{ width: 88, height: 88 }}>
                <div className="absolute inset-0 rounded-2xl"
                  style={{ background: 'rgba(64,41,112,0.18)', backdropFilter: 'blur(8px)', border: '1px solid rgba(107,77,171,0.25)' }} />
                <img
                  src="/kapruka-logo.png"
                  alt="Kapruka"
                  style={{
                    width: 58, height: 58,
                    objectFit: 'contain',
                    position: 'relative', zIndex: 1,
                    filter: 'drop-shadow(0 4px 12px rgba(64,41,112,0.40))',
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <p className="font-bold text-lg leading-snug"
                  style={{ color: 'var(--t-text-1)', fontFamily: 'var(--font-jakarta, "Plus Jakarta Sans", sans-serif)' }}>
                  {s.emptyProducts}
                </p>
                <p className="text-sm" style={{ color: 'var(--t-text-3)' }}>
                  {s.emptyProductsSub}
                </p>
              </div>

              {/* Decorative gradient line */}
              <div className="h-0.5 w-16 rounded-full"
                style={{ background: 'var(--t-grad-purple)', opacity: 0.6 }} />
            </div>
          </div>
        )}

        {/* Product grid */}
        {!loading && products.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {products.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                lang={lang}
                index={i}
                onViewDetail={(id, url) => { setSelectedId(id); setSelectedUrl(url); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedId && (
        <ProductModal
          productId={selectedId}
          productUrl={selectedUrl}
          lang={lang}
          onClose={() => { setSelectedId(null); setSelectedUrl(''); }}
        />
      )}
    </div>
  );
}
