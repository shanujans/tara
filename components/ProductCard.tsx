'use client';
import { useCart, Product } from '@/context/CartContext';
import { STRINGS, Lang } from '@/lib/strings';
import { useState, useEffect, useRef, memo } from 'react';
import { AddCartIcon, CheckIcon } from './Icons';

function proxyImg(url: string): string {
  if (!url) return '';
  if (url.includes('kapruka.com')) return `/api/img?url=${encodeURIComponent(url)}`;
  return url;
}

function categoryEmoji(cat = '', name = ''): string {
  const s = `${cat} ${name}`.toLowerCase();
  if (/phone|mobile|smart/i.test(s))             return '📱';
  if (/laptop|computer|pc|mac/i.test(s))         return '💻';
  if (/tv|television|monitor/i.test(s))          return '📺';
  if (/camera|photo/i.test(s))                   return '📷';
  if (/headphone|earbud|speaker|audio/i.test(s)) return '🎧';
  if (/cake|bakery/i.test(s))                    return '🎂';
  if (/flower|plant/i.test(s))                   return '💐';
  if (/book|stationery/i.test(s))                return '📚';
  if (/toy|game|play/i.test(s))                  return '🎮';
  if (/cloth|fashion|shirt|dress/i.test(s))      return '👗';
  if (/food|grocery|rice|tea/i.test(s))          return '🛒';
  if (/jewel|ring|necklace/i.test(s))            return '💍';
  if (/gift|hamper/i.test(s))                    return '🎁';
  return '📦';
}

interface ProductCardProps {
  product: Product & { url?: string; category?: string };
  lang: Lang;
  index?: number;
  onViewDetail?: (id: string, url: string) => void;
}

export default memo(function ProductCard({ product, lang, index = 0, onViewDetail }: ProductCardProps) {
  const { addItem, cartIds } = useCart();
  const s      = STRINGS[lang];
  const [added,   setAdded]   = useState(false);
  const [imgOk,   setImgOk]   = useState<boolean | null>(null);
  const [lazyImg, setLazyImg] = useState('');

  const inCart = cartIds.has(product.id);
  const emoji  = categoryEmoji(product.category, product.name);
  const imgSrc = proxyImg(product.image || lazyImg);
  const cardRef = useRef<HTMLDivElement>(null);

  /* ── Lazy image fetch via IntersectionObserver ─────── */
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
            body: JSON.stringify({ product_id: product.id, name: product.name }),
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
      {/* ── 4:3 Image area ──────────────────────────── */}
      <div className="product-img-wrap">

        {/* Shimmer skeleton while image is still loading */}
        {imgOk === null && (
          <div className="skeleton absolute inset-0" />
        )}

        {/* Emoji fallback only on true load failure (no image / broken URL) */}
        {imgOk === false && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
            style={{ background: 'var(--c-surface-container)' }}>
            <span style={{ fontSize: '2.5rem', opacity: 0.18 }}>{emoji}</span>
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
        <div
          className="absolute inset-0 flex items-center justify-center z-10 transition-all duration-300"
          style={{ background: 'transparent' }}
          onMouseOver={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.25)')}
          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span
            className="opacity-0 group-hover:opacity-100 transition-all duration-200 text-white font-bold px-3 py-1.5 rounded-full"
            style={{
              fontSize: 12,
              background: 'rgba(29,24,45,0.80)',
              border: '1px solid rgba(215,186,255,0.35)',
              backdropFilter: 'blur(8px)',
            }}
          >
            View Details
          </span>
        </div>

        {/* In-cart badge */}
        {inCart && (
          <div
            className="absolute top-2 right-2 z-20 font-black px-2 py-0.5 rounded-full"
            style={{
              fontSize: 10,
              background: 'var(--c-primary-container)',
              color: 'var(--c-on-primary-container)',
            }}
          >
            ✓ Cart
          </div>
        )}
      </div>

      {/* ── Card body ────────────────────────────────── */}
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p
          className="line-clamp-2"
          style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.35, color: 'var(--c-on-surface)', minHeight: '2rem' }}
        >
          {product.name}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minWidth: 0 }}>
          <span className="product-price" style={{ fontSize: 12, flex: 1, minWidth: 0, fontVariantNumeric: 'tabular-nums' }}>
            {s.lkr}&nbsp;{product.price.toLocaleString('si-LK')}
          </span>

          {/* Cart icon button */}
          <button
            onClick={handleAdd}
            style={{
              width: 30, height: 30, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: added
                ? 'rgba(34,197,94,0.15)'
                : 'var(--c-surface-container-lowest)',
              color: added ? '#4ade80' : 'var(--c-primary)',
              border: '1px solid rgba(74,68,81,0.30)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseOver={e => {
              if (!added) {
                e.currentTarget.style.background = 'var(--c-primary-container)';
                e.currentTarget.style.color = 'var(--c-on-primary-container)';
              }
            }}
            onMouseOut={e => {
              if (!added) {
                e.currentTarget.style.background = 'var(--c-surface-container-lowest)';
                e.currentTarget.style.color = 'var(--c-primary)';
              }
            }}
          >
            {added ? <CheckIcon size={14}/> : <AddCartIcon size={14}/>}
          </button>
        </div>
      </div>
    </div>
  );
});
