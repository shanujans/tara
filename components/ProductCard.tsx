'use client';
import { useCart, Product } from '@/context/CartContext';
import { STRINGS, Lang } from '@/lib/strings';
import { useState } from 'react';

/**
 * Route kapruka.com images through our server-side proxy to bypass hotlink protection.
 * Skip partnercentral.kapruka.com — that's the vendor portal and requires auth.
 */
function proxyImg(url: string): string {
  if (!url) return '';
  if (/partnercentral\.|partner\.|admin\./i.test(url)) return ''; // blocked — use CSS fallback
  if (url.includes('kapruka.com')) return `/api/img?url=${encodeURIComponent(url)}`;
  return url;
}

function categoryEmoji(cat = '', name = ''): string {
  const s = `${cat} ${name}`.toLowerCase();
  if (/phone|mobile|smart/i.test(s))              return '📱';
  if (/laptop|computer|pc|mac/i.test(s))          return '💻';
  if (/tv|television|monitor/i.test(s))           return '📺';
  if (/camera|photo/i.test(s))                    return '📷';
  if (/headphone|earbud|speaker|audio/i.test(s)) return '🎧';
  if (/cake|bakery/i.test(s))                     return '🎂';
  if (/flower|plant/i.test(s))                    return '💐';
  if (/book|stationery/i.test(s))                 return '📚';
  if (/toy|game|play/i.test(s))                   return '🎮';
  if (/cloth|fashion|shirt|dress/i.test(s))      return '👗';
  if (/food|grocery|rice|tea/i.test(s))           return '🛒';
  if (/jewel|ring|necklace/i.test(s))             return '💍';
  if (/gift|hamper/i.test(s))                     return '🎁';
  return '📦';
}

interface ProductCardProps {
  product: Product & { url?: string; category?: string };
  lang: Lang;
  index?: number;
  onViewDetail?: (id: string, url: string) => void;
}

export default function ProductCard({ product, lang, index = 0, onViewDetail }: ProductCardProps) {
  const { addItem, items } = useCart();
  const s      = STRINGS[lang];
  const [added,    setAdded]    = useState(false);
  const [imgOk,    setImgOk]    = useState<boolean | null>(null); // null=pending true=ok false=failed

  const inCart = items.some(i => i.id === product.id);
  const emoji  = categoryEmoji(product.category, product.name);
  const imgSrc = proxyImg(product.image); // empty string if blocked/missing

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({ id: product.id, name: product.name, price: product.price, image: product.image });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div
      className="group flex flex-col bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-amber-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-amber-400/10 hover:-translate-y-0.5 cursor-pointer animate-fade-slide-up"
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={() => onViewDetail?.(product.id, product.url ?? '')}
      role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onViewDetail?.(product.id, product.url ?? ''); }}
      aria-label={`View details for ${product.name}`}
    >
      {/* ── Image area ───────────────────────────────────────────────── */}
      <div className="aspect-square overflow-hidden relative flex items-center justify-center"
           style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>

        {/* CSS-only placeholder — always visible until a real image loads */}
        {imgOk !== true && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none select-none">
            <span style={{ fontSize: '3rem', opacity: 0.18 }}>{emoji}</span>
            {imgOk === false && (
              <span className="text-slate-600 text-xs font-medium tracking-wide">No image</span>
            )}
          </div>
        )}

        {/* Real image — only mount if we have a src to try */}
        {imgSrc && imgOk !== false && (
          <img
            key={imgSrc}
            src={imgSrc}
            alt={product.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
            style={{ opacity: imgOk === true ? 1 : 0 }}
            onLoad={() => setImgOk(true)}
            onError={() => setImgOk(false)}
          />
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center z-10">
          <span className="opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 bg-white/10 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20">
            View Details
          </span>
        </div>

        {inCart && (
          <div className="absolute top-2 right-2 z-20 bg-amber-400 text-slate-900 text-xs font-black px-2 py-0.5 rounded-full shadow">
            ✓ Cart
          </div>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <p className="text-slate-100 text-sm font-medium leading-snug line-clamp-2 flex-1">
          {product.name}
        </p>
        <p className="text-amber-400 font-bold text-base tracking-tight">
          {s.lkr} {product.price.toLocaleString('si-LK')}
        </p>
        <button
          onClick={handleAdd}
          className={`mt-1 w-full py-2 px-3 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 ${
            added
              ? 'bg-green-500 text-white scale-95'
              : 'bg-amber-400 hover:bg-amber-300 text-slate-900 hover:shadow-md hover:shadow-amber-400/30 active:scale-95'
          }`}
        >
          {added ? '✓ Added!' : s.addToCart}
        </button>
      </div>
    </div>
  );
}