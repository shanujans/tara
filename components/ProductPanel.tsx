'use client';
import { useState } from 'react'; // ← added
import ProductCard from './ProductCard';
import { Product } from '@/context/CartContext';
import { STRINGS, Lang } from '@/lib/strings';

interface ProductPanelProps {
  products: Product[];
  lang: Lang;
  loading: boolean;
  quantum?: boolean;   // ← new
}

export default function ProductPanel({ products, lang, loading, quantum }: ProductPanelProps) {
  const s = STRINGS[lang];

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Panel header */}
      <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2">
        <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">
          Products
        </span>
        {products.length > 0 && (
          <span className="bg-amber-400/20 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
            {products.length}
          </span>
        )}
        {/* Quantum badge — added */}
        {quantum && products.length > 0 && (
          <span className="flex items-center gap-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
            ✦ Quantum search active
          </span>
        )}
      </div>

      {/* Scrollable grid */}
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
            {/* Decorative SVG */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 8h4l5.5 22h17L37 14H14" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="22" cy="38" r="2.5" fill="#f59e0b"/>
                  <circle cx="33" cy="38" r="2.5" fill="#f59e0b"/>
                  <path d="M20 22l4 4 6-7" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                <span className="text-amber-400 text-xs">✦</span>
              </div>
            </div>
            <div>
              <p className="text-slate-300 font-semibold text-base">{s.emptyProducts}</p>
              <p className="text-slate-500 text-sm mt-1">{s.emptyProductsSub}</p>
            </div>
            {/* Animated hint dots */}
            <div className="flex gap-1.5 mt-2">
              {['Electronics', 'Groceries', 'Fashion', 'Books'].map((hint) => (
                <span
                  key={hint}
                  className="text-xs bg-slate-800 text-slate-400 border border-slate-700 px-2 py-1 rounded-full hover:border-amber-400/50 hover:text-amber-400 transition-colors cursor-default"
                >
                  {hint}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {products.map(p => (
              <ProductCard key={p.id} product={p} lang={lang} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}