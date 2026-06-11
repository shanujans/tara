'use client';
import { useEffect, useState } from 'react';
import { useCart, Product } from '@/context/CartContext';
import { STRINGS, Lang } from '@/lib/strings';

interface ProductModalProps {
  productId:  string;
  productUrl: string;   // URL from search results — always available as fallback
  lang:       Lang;
  onClose:    () => void;
}

interface FullProduct {
  id:          string;
  name:        string;
  price:       number;
  image?:      string;
  image_url?:  string;
  url?:        string;
  description?: string;
  summary?:    string;
  in_stock?:   boolean;
  stock?:      string | boolean;
  category?:   string;
  shipping?:   string;
  images?:     string[];
}

function stockOk(p: FullProduct): boolean {
  if (p.in_stock === true)  return true;
  if (p.stock === true)     return true;
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
    setLoading(true);
    setProduct(null);
    setActiveImg(0);

    fetch('/api/product', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ product_id: productId }),
    })
      .then(r => r.json())
      .then(d => { if (alive && d.product) setProduct(d.product); })
      .catch(() => { /* silent — we still show the fallback URL button */ })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [productId]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  // Best URL: prefer fetched product URL, fall back to search result URL
  const viewUrl = product?.url || productUrl || '';

  const imgSrc  = product?.image_url || product?.image || '';
  const images = [imgSrc, ...(product?.images ?? [])]
    .filter(u => u && u.startsWith('http'))
    .map(u => u.includes('kapruka.com') ? `/api/img?url=${encodeURIComponent(u)}` : u)
    .slice(0, 6);
  const desc    = product?.description || product?.summary || '';

  const handleAdd = () => {
    if (!product) return;
    addItem({
      id:    product.id,
      name:  product.name,
      price: product.price,
      image: imgSrc,
    } as Product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-md z-50"
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center z-50 md:p-6">
        <div className="bg-slate-900 w-full md:max-w-2xl md:rounded-2xl rounded-t-3xl border border-slate-700/80 shadow-2xl animate-slide-up-modal max-h-[92vh] md:max-h-[88vh] flex flex-col overflow-hidden">

          {/* Drag handle (mobile) */}
          <div className="flex justify-center pt-3 pb-1 md:hidden flex-shrink-0">
            <div className="w-10 h-1 bg-slate-700 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 flex-shrink-0">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">
              {product?.category ?? 'Product Details'}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
            >✕</button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col md:flex-row animate-pulse">
                <div className="w-full md:w-72 aspect-square bg-slate-800 flex-shrink-0" />
                <div className="p-5 flex-1 space-y-3">
                  <div className="h-4 bg-slate-800 rounded w-full" />
                  <div className="h-4 bg-slate-800 rounded w-3/4" />
                  <div className="h-7 bg-slate-700 rounded w-1/3 mt-3" />
                  <div className="h-3 bg-slate-800 rounded w-full mt-5" />
                  <div className="h-3 bg-slate-800 rounded w-5/6" />
                </div>
              </div>
            ) : product ? (
              <div className="flex flex-col md:flex-row">
                {/* Gallery */}
                <div className="w-full md:w-72 flex-shrink-0 bg-slate-800 md:border-r md:border-slate-700">
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={images[activeImg] || `https://placehold.co/400x400/1e293b/94a3b8?text=${encodeURIComponent(product.name.slice(0,10))}`}
                      alt={product.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {images.length > 1 && (
                    <div className="flex gap-2 p-3 overflow-x-auto">
                      {images.map((src, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveImg(i)}
                          className={`w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all duration-200 ${
                            i === activeImg ? 'border-amber-400 opacity-100' : 'border-transparent opacity-50 hover:opacity-100'
                          }`}
                        >
                          <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 p-5 space-y-4">
                  <h2 className="text-white font-bold text-base md:text-lg leading-snug">{product.name}</h2>

                  <p className="text-amber-400 font-black text-2xl tracking-tight">
                    {s.lkr} {product.price.toLocaleString('si-LK')}
                  </p>

                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${stockOk(product) ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className={`text-xs font-semibold ${stockOk(product) ? 'text-green-400' : 'text-red-400'}`}>
                      {stockOk(product) ? s.inStock : s.outOfStock}
                      {typeof product.stock === 'string' && product.stock ? ` (${product.stock})` : ''}
                    </span>
                  </div>

                  {desc && (
                    <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                  )}

                  {product.shipping && (
                    <div className="flex items-start gap-2.5 bg-slate-800 rounded-xl p-3 border border-slate-700">
                      <span className="text-base mt-0.5">🚚</span>
                      <p className="text-slate-300 text-xs leading-relaxed">{product.shipping}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* API failed but we still have the URL from search */
              <div className="flex flex-col items-center justify-center h-48 gap-3 px-6 text-center">
                <p className="text-slate-400 text-sm">Could not load full details.</p>
                {viewUrl && (
                  <a
                    href={viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-amber-400 text-slate-900 font-bold px-5 py-2 rounded-xl text-sm hover:bg-amber-300 transition-colors"
                  >
                    {s.viewOnKapruka}
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Footer CTAs */}
          <div className="flex gap-3 px-5 py-4 border-t border-slate-800 flex-shrink-0">
            {product && (
              <button
                onClick={handleAdd}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-200 active:scale-95 ${
                  added
                    ? 'bg-green-500 text-white'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-900 hover:shadow-lg hover:shadow-amber-400/30'
                }`}
              >
                {added ? '✓ Added to Cart!' : inCart ? `✓ ${s.addToCartModal}` : s.addToCartModal}
              </button>
            )}

            {/* Always show "View on Kapruka" if we have any URL */}
            {viewUrl && (
              <a
                href={viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 rounded-xl font-bold text-sm border border-amber-400/40 text-amber-400 hover:bg-amber-400/10 hover:border-amber-400/70 transition-all text-center"
              >
                {s.viewOnKapruka}
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}