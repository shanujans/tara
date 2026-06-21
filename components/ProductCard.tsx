'use client';
import { useCart, Product } from '@/context/CartContext';
import { STRINGS, Lang } from '@/lib/strings';
import { useState, useEffect, useRef } from 'react';

function proxyImg(url: string): string {
  if (!url) return '';
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
  if (/cloth|fashion|shirt|dress/i.test(s))       return '👗';
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
  const [added,   setAdded]   = useState(false);
  const [imgOk,   setImgOk]   = useState<boolean | null>(null);
  const [lazyImg, setLazyImg] = useState('');

  const inCart = items.some(i => i.id === product.id);
  const emoji  = categoryEmoji(product.category, product.name);
  const imgSrc = proxyImg(product.image || lazyImg);

  const cardRef = useRef<HTMLDivElement>(null);

  /* ── Lazy image fetch (IntersectionObserver + stagger) ─────── */
  useEffect(() => {
    if (imgSrc || !product.id || lazyImg) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const doFetch = () => {
      timer = setTimeout(async () => {
        if (cancelled) return;
        try {
          const r = await fetch('/api/product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: product.id }),
          });
          if (!r.ok || cancelled) return;
          const data = await r.json();
          const img = data?.product?.image || data?.product?.image_url || '';
          if (img && !cancelled) setLazyImg(img);
        } catch { /* silent */ }
      }, index * 250);
    };

    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { obs.disconnect(); doFetch(); } },
      { rootMargin: '100px' },
    );
    if (cardRef.current) obs.observe(cardRef.current);
    return () => { cancelled = true; obs.disconnect(); if (timer) clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, imgSrc, lazyImg]);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({ id: product.id, name: product.name, price: product.price, image: product.image });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div
      ref={cardRef}
      className="product-card animate-fade-slide-up cursor-pointer group"
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={() => onViewDetail?.(product.id, product.url ?? '')}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onViewDetail?.(product.id, product.url ?? ''); }}
      aria-label={`View details for ${product.name}`}
    >
      {/* ── 4:3 Image area ──────────────────────────────────── */}
      <div className="product-img-wrap">

        {/* Emoji placeholder */}
        {imgOk !== true && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <span style={{ fontSize: '2.5rem', opacity: 0.14 }}>{emoji}</span>
          </div>
        )}

        {/* Real image */}
        {imgSrc && imgOk !== false && (
          <img
            key={imgSrc}
            src={imgSrc}
            alt={product.name}
            loading="lazy"
            style={{ opacity: imgOk === true ? 1 : 0 }}
            onLoad={() => setImgOk(true)}
            onError={() => setImgOk(false)}
          />
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center z-10 transition-all duration-300"
          style={{ background: 'rgba(0,0,0,0)', }}
          onMouseOver={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.28)')}
          onMouseOut={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
        >
          <span className="opacity-0 group-hover:opacity-100 transition-all duration-200 text-white text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(64,41,112,0.75)', border: '1px solid rgba(107,77,171,0.5)', backdropFilter: 'blur(8px)' }}>
            View Details
          </span>
        </div>

        {/* In-cart badge */}
        {inCart && (
          <div className="absolute top-2 right-2 z-20 text-xs font-black px-2 py-0.5 rounded-full shadow"
            style={{ background: 'var(--t-grad-purple)', color: 'white' }}>
            ✓ Cart
          </div>
        )}
      </div>

      {/* ── Card body ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 p-3">
        <p className="text-sm font-medium leading-snug line-clamp-2"
          style={{ color: 'var(--t-text-1)', minHeight: '2.5rem' }}>
          {product.name}
        </p>

        <div className="flex items-center justify-between gap-2">
          {/* Gradient price */}
          <span className="product-price text-sm">
            {s.lkr}&nbsp;{product.price.toLocaleString('si-LK')}
          </span>

          {/* Add to cart */}
          <button
            onClick={handleAdd}
            className="text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
            style={added ? {
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: 'white',
            } : {
              background: 'var(--t-grad-purple)',
              color: 'white',
              boxShadow: '0 2px 8px rgba(64,41,112,0.35)',
            }}
          >
            {added ? '✓' : s.addToCart}
          </button>
        </div>
      </div>
    </div>
  );
}
