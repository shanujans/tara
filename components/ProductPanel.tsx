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

  const handleViewDetail = (id: string, url: string) => {
    setSelectedId(id);
    setSelectedUrl(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 relative">

      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2 flex-shrink-0">
        <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Products</span>
        {products.length > 0 && (
          <span className="bg-amber-400/20 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
            {products.length}
          </span>
        )}
        {quantum && products.length > 0 && (
          <span className="flex items-center gap-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold px-2.5 py-0.5 rounded-full animate-quantum ml-auto">
            ✦ Quantum
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col bg-slate-800 rounded-xl overflow-hidden border border-slate-700 animate-pulse">
                <div className="aspect-square bg-slate-700" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-slate-700 rounded w-full" />
                  <div className="h-3 bg-slate-700 rounded w-3/4" />
                  <div className="h-4 bg-slate-600 rounded w-1/2 mt-1" />
                  <div className="h-8 bg-slate-700 rounded w-full mt-1" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 text-center px-8">
            <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <span className="text-4xl">🛍️</span>
            </div>
            <div>
              <p className="text-slate-300 font-semibold text-base">{s.emptyProducts}</p>
              <p className="text-slate-500 text-sm mt-1">{s.emptyProductsSub}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {products.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                lang={lang}
                index={i}
                onViewDetail={handleViewDetail}
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