'use client';
import { useCart, Product } from '@/context/CartContext';
import { STRINGS, Lang } from '@/lib/strings';
import { useState } from 'react';

interface ProductCardProps {
  product: Product & { url?: string };
  lang: Lang;
  index?: number;
  onViewDetail?: (id: string, url: string) => void;
}

export default function ProductCard({ product, lang, index = 0, onViewDetail }: ProductCardProps) {
  const { addItem, items } = useCart();
  const s = STRINGS[lang];
  const [added, setAdded]         = useState(false);
  const [loaded, setLoaded]       = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const inCart = items.some(i => i.id === product.id);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({ id: product.id, name: product.name, price: product.price, image: product.image });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleCardClick = () => {
    onViewDetail?.(product.id, product.url ?? '');
  };

  const fallbackImg = `https://placehold.co/300x300/1e293b/f59e0b?text=${encodeURIComponent(product.name.slice(0, 14))}`;

  return (
    <div
      className="group flex flex-col bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-amber-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-amber-400/10 hover:-translate-y-0.5 cursor-pointer animate-fade-slide-up"
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(); }}
      aria-label={`View details for ${product.name}`}
    >
      {/* Image */}
      <div className="aspect-square overflow-hidden bg-slate-700 relative">
        <img
          src={imgFailed || !product.image ? fallbackImg : product.image}
          alt={product.name}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => { if (!imgFailed) setImgFailed(true); }}
          className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 bg-white/10 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20">
            View Details
          </span>
        </div>
        {inCart && (
          <div className="absolute top-2 right-2 bg-amber-400 text-slate-900 text-xs font-black px-2 py-0.5 rounded-full shadow">
            ✓ Cart
          </div>
        )}
      </div>

      {/* Content */}
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