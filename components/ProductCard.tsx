'use client';
import { useCart, Product } from '@/context/CartContext';
import { STRINGS, Lang } from '@/lib/strings';
import { useState } from 'react';

interface ProductCardProps {
  product: Product;
  lang: Lang;
}

export default function ProductCard({ product, lang }: ProductCardProps) {
  const { addItem, items } = useCart();
  const s = STRINGS[lang];
  const [added, setAdded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const inCart = items.some(i => i.id === product.id);

  const handleAdd = () => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const formattedPrice = product.price.toLocaleString('si-LK');

  // Fallback image – a generic Kapruka-themed placeholder that looks decent
  const fallbackImg = 'https://picsum.photos/seed/kapruka/300/300';

  return (
    <div className="group flex flex-col bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-amber-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-amber-400/10 hover:-translate-y-0.5">
      {/* Image with fade-in */}
      <div className="aspect-square overflow-hidden bg-slate-700 relative">
        <img
          src={imgFailed ? fallbackImg : product.image}
          alt={product.name}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onError={() => {
            if (!imgFailed) {
              setImgFailed(true);
            }
          }}
        />
        {inCart && (
          <div className="absolute top-2 right-2 bg-amber-400 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">
            ✓ In Cart
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <p className="text-slate-100 text-sm font-medium leading-snug line-clamp-2 flex-1">
          {product.name}
        </p>
        <p className="text-amber-400 font-bold text-base tracking-tight">
          {s.lkr} {formattedPrice}
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