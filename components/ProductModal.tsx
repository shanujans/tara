'use client';
import { useEffect, useState } from 'react';
import { useCart, Product } from '@/context/CartContext';
import { STRINGS, Lang } from '@/lib/strings';

interface ProductModalProps {
  productId:  string;
  productUrl: string;
  lang:       Lang;
  onClose:    () => void;
}

interface FullProduct {
  id:           string;
  name:         string;
  price:        number;
  image?:       string;
  image_url?:   string;
  url?:         string;
  description?: string;
  summary?:     string;
  in_stock?:    boolean;
  stock?:       string | boolean;
  category?:    string;
  shipping?:    string;
  images?:      string[];
}

function stockOk(p: FullProduct): boolean {
  if (p.in_stock === true)  return true;
  if (p.stock   === true)   return true;
  if (typeof p.stock === 'string') return /in.?stock/i.test(p.stock);
  return false;
}

export default function ProductModal({ productId, productUrl, lang, onClose }: ProductModalProps) {
  const { addItem, items } = useCart();
  const s = STRINGS[lang];

  const [product,   setProduct]   = useState<FullProduct | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [added,     setAdded]     = useState(false);

  const inCart = product ? items.some(i => i.id === product.id) : false;

  useEffect(() => {
    let alive = true;
    setLoading(true); setProduct(null); setActiveImg(0);
    fetch('/api/product', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId }),
    })
      .then(r => r.json())
      .then(d => { if (alive && d.product) setProduct(d.product); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [productId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const viewUrl = product?.url || productUrl || '';
  const imgSrc  = product?.image_url || product?.image || '';
  const images  = [imgSrc, ...(product?.images ?? [])]
    .filter(u => u && u.startsWith('http'))
    .map(u => u.includes('kapruka.com') ? `/api/img?url=${encodeURIComponent(u)}` : u)
    .slice(0, 6);
  const desc = product?.description || product?.summary || '';

  const handleAdd = () => {
    if (!product) return;
    addItem({ id: product.id, name: product.name, price: product.price, image: imgSrc } as Product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  /* ── Shared style tokens ─────────────────────────── */
  const surface = { background: 'rgba(17,11,46,0.60)', border: '1px solid var(--t-border)' };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 z-50"
        style={{ background: 'rgba(5,3,15,0.80)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }} />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center z-50 md:p-6">
        <div className="w-full md:max-w-2xl md:rounded-2xl rounded-t-3xl flex flex-col overflow-hidden animate-slide-up-modal"
          style={{
            maxHeight: '92vh',
            background: 'rgba(9,6,26,0.97)',
            border: '1px solid var(--t-border-bright)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 32px 80px rgba(64,41,112,0.30)',
          }}>

          {/* Drag handle (mobile) */}
          <div className="flex justify-center pt-3 pb-1 md:hidden flex-shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--t-border-bright)' }} />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--t-border)' }}>
            <span className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--t-text-3)' }}>
              {product?.category ?? 'Product Details'}
            </span>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all text-sm"
              style={{ ...surface, color: 'var(--t-text-3)' }}
              onMouseOver={e => (e.currentTarget.style.color = 'var(--t-text-1)')}
              onMouseOut={e => (e.currentTarget.style.color = 'var(--t-text-3)')}>
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col md:flex-row animate-pulse">
                {/* 4:3 image skeleton */}
                <div className="w-full md:w-72 flex-shrink-0">
                  <div className="skeleton" style={{ paddingTop: '75%' }} />
                </div>
                <div className="p-5 flex-1 space-y-3">
                  <div className="skeleton h-4 rounded w-full" />
                  <div className="skeleton h-4 rounded w-3/4" />
                  <div className="skeleton h-7 rounded w-1/3 mt-3" />
                  <div className="skeleton h-3 rounded w-full mt-5" />
                  <div className="skeleton h-3 rounded w-5/6" />
                </div>
              </div>
            ) : product ? (
              <div className="flex flex-col md:flex-row">
                {/* Gallery */}
                <div className="w-full md:w-72 flex-shrink-0"
                  style={{ borderRight: '1px solid var(--t-border)', background: 'rgba(17,11,46,0.50)' }}>

                  {/* 4:3 main image */}
                  <div style={{ position: 'relative', paddingTop: '75%', overflow: 'hidden' }}>
                    <img
                      src={images[activeImg] || `https://placehold.co/400x300/110b2e/6b4dab?text=${encodeURIComponent(product.name.slice(0,10))}`}
                      alt={product.name}
                      loading="lazy"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>

                  {/* Thumbnails */}
                  {images.length > 1 && (
                    <div className="flex gap-2 p-3 overflow-x-auto scrollbar-none">
                      {images.map((src, i) => (
                        <button key={i} onClick={() => setActiveImg(i)}
                          className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 transition-all"
                          style={{
                            border: `2px solid ${i === activeImg ? '#6b4dab' : 'transparent'}`,
                            opacity: i === activeImg ? 1 : 0.45,
                          }}>
                          <img src={src} alt="" loading="lazy"
                            className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 p-5 space-y-4">
                  <h2 className="font-bold text-base md:text-lg leading-snug"
                    style={{ color: 'var(--t-text-1)' }}>
                    {product.name}
                  </h2>

                  <p className="font-black text-2xl tracking-tight product-price">
                    {s.lkr} {product.price.toLocaleString('si-LK')}
                  </p>

                  {/* Stock status */}
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: stockOk(product) ? '#4ade80' : '#f87171' }} />
                    <span className="text-xs font-semibold"
                      style={{ color: stockOk(product) ? '#4ade80' : '#f87171' }}>
                      {stockOk(product) ? s.inStock : s.outOfStock}
                      {typeof product.stock === 'string' && product.stock
                        ? ` (${product.stock})` : ''}
                    </span>
                  </div>

                  {/* Description */}
                  {desc && (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--t-text-3)' }}>
                      {desc}
                    </p>
                  )}

                  {/* Shipping info */}
                  {product.shipping && (
                    <div className="flex items-start gap-2.5 rounded-xl p-3"
                      style={{ ...surface }}>
                      <span className="text-base mt-0.5">🚚</span>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--t-text-2)' }}>
                        {product.shipping}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* API failed — show URL fallback */
              <div className="flex flex-col items-center justify-center h-48 gap-3 px-6 text-center">
                <p className="text-sm" style={{ color: 'var(--t-text-3)' }}>Could not load full details.</p>
                {viewUrl && (
                  <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                    className="btn-gold px-5 py-2.5 rounded-xl text-sm inline-block"
                    style={{ color: '#3A3A3C' }}>
                    {s.viewOnKapruka}
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Footer CTAs */}
          <div className="flex gap-3 px-5 py-4 flex-shrink-0"
            style={{ borderTop: '1px solid var(--t-border)' }}>
            {product && (
              <button onClick={handleAdd}
                className="flex-1 py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                style={added ? {
                  background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                  color: 'white',
                } : {
                  background: 'var(--t-grad-purple)',
                  color: 'white',
                  boxShadow: '0 4px 16px rgba(64,41,112,0.40)',
                }}>
                {added ? '✓ Added to Cart!' : inCart ? `✓ ${s.addToCartModal}` : s.addToCartModal}
              </button>
            )}

            {viewUrl && (
              <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-3 rounded-xl font-bold text-sm text-center transition-all"
                style={{
                  border: '1px solid rgba(107,77,171,0.45)',
                  color: '#c7abff',
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'rgba(64,41,112,0.15)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                {s.viewOnKapruka}
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
