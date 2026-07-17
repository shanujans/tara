'use client';
import { useEffect, useState, useRef, KeyboardEvent } from 'react';
import { useCart, Product } from '@/context/CartContext';
import { STRINGS, Lang } from '@/lib/strings';
import { SendIcon, CheckIcon } from './Icons';

interface ProductModalProps { productId: string; productUrl: string; lang: Lang; onClose: () => void; allProducts?: (Product & { url?: string; category?: string })[]; fallbackProduct?: Product | null; }

interface FullProduct {
  id: string; name: string; price: number; image?: string; image_url?: string;
  url?: string; description?: string; summary?: string; in_stock?: boolean;
  stock?: string | boolean; category?: string; shipping?: string; images?: string[];
  specifications?: string[] | null; rating_score?: number | null;
  review_count?: number | null; brand_or_merchant?: string | null;
  warranty_or_guarantee?: string | null; payment_options?: string | null;
  shipping_info?: string | null; title?: string;
}
interface Msg { role: 'user' | 'assistant'; content: string; }

type Tab = 'overview' | 'summary' | 'ask' | 'compare';

const QUICK_QS = [
  'Is this good as a gift?',
  'Can this be delivered island-wide?',
  'How long does delivery take?',
  'Is this currently in stock?',
];

function proxyImg(u: string) {
  if (!u) return '';
  return u.includes('kapruka.com') ? `/api/img?url=${encodeURIComponent(u)}` : u;
}
function stockOk(p: FullProduct) {
  if (p.in_stock === true) return true;
  if (p.stock   === true)  return true;
  if (typeof p.stock === 'string') return /in.?stock/i.test(p.stock);
  return false;
}

/* ── Minimal markdown → JSX renderer (handles **bold** and *italic*) ─ */
function renderMd(text: string): React.ReactNode {
  return (
    <>
      {text.split('\n').map((line, li) => {
        if (!line.trim()) return <br key={li}/>;
        const segments = line.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
        return (
          <div key={li} style={{ marginBottom: 5 }}>
            {segments.map((seg, si) => {
              if (seg.startsWith('**') && seg.endsWith('**'))
                return <strong key={si}>{seg.slice(2, -2)}</strong>;
              if (seg.startsWith('*') && seg.endsWith('*'))
                return <em key={si}>{seg.slice(1, -1)}</em>;
              return <span key={si}>{seg}</span>;
            })}
          </div>
        );
      })}
    </>
  );
}

export default function ProductModal({ productId, productUrl, lang, onClose, allProducts, fallbackProduct }: ProductModalProps) {
  const { addItem, items } = useCart();
  const s = STRINGS[lang];

  const [product,   setProduct]   = useState<FullProduct | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [heroImgLoaded, setHeroImgLoaded] = useState(false);
  const [added,     setAdded]     = useState(false);
  const [tab,       setTab]       = useState<Tab>('overview');

  /* AI Summary tab */
  const [summary,       setSummary]       = useState('');
  const [summaryLoad,   setSummaryLoad]   = useState(false);

  /* Ask AI tab */
  const [chatMsgs,   setChatMsgs]   = useState<Msg[]>([]);
  const [chatInput,  setChatInput]  = useState('');
  const [chatBusy,   setChatBusy]   = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const inCart = product ? items.some(i => i.id === product.id) : false;

  /* Fetch product */
  useEffect(() => {
    let alive = true;
    setLoading(true); setProduct(null); setActiveImg(0);

    // Build fallback product from search result data (passed via props)
    const buildFallback = (): FullProduct | null => {
      if (!fallbackProduct) return null;
      return {
        id:        fallbackProduct.id,
        name:      fallbackProduct.name || fallbackProduct.id,
        price:     fallbackProduct.price || 0,
        image:     fallbackProduct.image || '',
        image_url: fallbackProduct.image || '',
        url:       fallbackProduct.url ?? (productUrl || ''),
        in_stock:  fallbackProduct.in_stock ?? true,
        category:  fallbackProduct.category ?? '',
        summary:   'Full product details are temporarily unavailable. You can still add this to your cart or view it on Kapruka.',
      };
    };

    fetch('/api/product', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, name: fallbackProduct?.name }) })
      .then(r => r.json())
      .then(d => {
        if (!alive) return;
        if (d.product) {
          const apiProduct = d.product as FullProduct;
          // Check if API returned garbage (price=0, no images, name is just the ID)
          const isGarbage =
            (!apiProduct.price || apiProduct.price === 0) &&
            (!apiProduct.images || apiProduct.images.length === 0) &&
            (!apiProduct.image_url || apiProduct.image_url === '') &&
            (!apiProduct.description && !apiProduct.summary);

          if (isGarbage && fallbackProduct) {
            // Merge: use search result data for missing fields, keep any API data that exists
            const fb = buildFallback()!;
            setProduct({
              ...fb,
              ...(apiProduct.name && apiProduct.name !== apiProduct.id ? { name: apiProduct.name } : {}),
              ...(apiProduct.category ? { category: apiProduct.category } : {}),
              ...(apiProduct.url ? { url: apiProduct.url } : {}),
            });
          } else {
            // If the API returned a valid product but with no/zero price
            // (e.g. MCP returned a USD price that we rejected), patch in the
            // correct LKR price from the search result while keeping all the
            // rich API data (images, specs, description, etc.).
            if ((!apiProduct.price || apiProduct.price === 0) && fallbackProduct?.price) {
              apiProduct.price = fallbackProduct.price;
            }
            setProduct(apiProduct);
          }
        } else if (fallbackProduct) {
          setProduct(buildFallback());
        }
      })
      .catch(() => {
        if (alive) setProduct(buildFallback());
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [productId]);

  /* Keyboard close */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h as unknown as EventListener);
    return () => document.removeEventListener('keydown', h as unknown as EventListener);
  }, [onClose]);

  /* Scroll chat to bottom */
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMsgs, chatBusy]);

  /* Reset hero image loading state on image switch */
  useEffect(() => { setHeroImgLoaded(false); }, [activeImg]);

  const imgSrc = product?.image_url || product?.image || '';
  /* Collect all URLs, deduplicate, cap at 10 */
  const seenUrls = new Set<string>();
  const images = [imgSrc, ...(product?.images ?? [])]
    .filter(u => { if (!u || !u.startsWith('http')) return false; if (seenUrls.has(u)) return false; seenUrls.add(u); return true; })
    .map(proxyImg)
    .slice(0, 10);
  const desc = product?.description || product?.summary || '';

  /* Compare — state for MCP-fetched comparison products */
  const [compareData,    setCompareData]    = useState<(Product & { url?: string; category?: string; in_stock?: boolean })[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareFetched, setCompareFetched] = useState(false);

  const fetchCompare = async () => {
    if (compareFetched || compareLoading || !product) return;
    setCompareLoading(true);
    try {
      const r = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id:   product.id,
          category:     product.category,
          product_name: product.name,
        }),
      });
      const d = await r.json() as { products: (Product & { url?: string; category?: string; in_stock?: boolean })[] };
      setCompareData(d.products ?? []);
    } catch { setCompareData([]); }
    finally { setCompareLoading(false); setCompareFetched(true); }
  };

  const handleAdd = () => {
    if (!product) return;
    addItem({ id: product.id, name: product.name, price: product.price, image: imgSrc } as Product);
    setAdded(true); setTimeout(() => setAdded(false), 1500);
  };

  /* ── AI Summary ───────────────────────────────────── */
  const fetchSummary = async () => {
    if (!product || summary || summaryLoad) return;
    setSummaryLoad(true);
    try {
      const r = await fetch('/api/product-ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, messages: [], type: 'summary' }),
      });
      const d = await r.json();
      setSummary(d.answer || 'No summary available.');
    } catch { setSummary('Could not generate summary. Please try again.'); }
    finally { setSummaryLoad(false); }
  };

  /* ── Ask AI ───────────────────────────────────────── */
  const askAI = async (q: string) => {
    if (!product || !q.trim() || chatBusy) return;
    const next: Msg[] = [...chatMsgs, { role: 'user', content: q }];
    setChatMsgs(next); setChatInput(''); setChatBusy(true);
    try {
      const r = await fetch('/api/product-ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, messages: next, type: 'chat' }),
      });
      const d = await r.json();
      setChatMsgs(prev => [...prev, { role: 'assistant', content: d.answer || 'Sorry, I couldn\'t answer that.' }]);
    } catch { setChatMsgs(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]); }
    finally { setChatBusy(false); }
  };

  const viewUrl = product?.url || productUrl || fallbackProduct?.url || '';
  const surface = { background: 'rgba(17,11,46,0.60)', border: '1px solid rgba(74,68,81,0.30)' };

  /* ── Tab bar ──────────────────────────────────────── */
  const TabBtn = ({ id, label, emoji }: { id: Tab; label: string; emoji: string }) => (
    <button
      onClick={() => { setTab(id); if (id === 'summary') fetchSummary(); if (id === 'compare') fetchCompare(); }}
      style={{
        flex: 1, padding: '8px 4px', fontSize: 12, fontWeight: tab === id ? 700 : 500, cursor: 'pointer',
        border: 'none', borderBottom: `2px solid ${tab === id ? 'var(--c-primary-container)' : 'transparent'}`,
        background: 'transparent', color: tab === id ? 'var(--c-primary)' : 'var(--c-on-surface-variant)',
        transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        fontFamily: 'var(--font-body)',
      }}
    >{emoji} {label}</button>
  );

  const TypingDots = (
    <span style={{ display:'inline-flex', gap:4, alignItems:'center', height:18 }}>
      {[0,200,400].map(d=><span key={d} className="dot-bounce rounded-full" style={{ width:6, height:6, background:'var(--c-primary)', animationDelay:`${d}ms` }}/>)}
    </span>
  );

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(5,3,15,0.82)', backdropFilter:'blur(10px)' }}/>

      {/* Sheet — centered on all screen sizes */}
      <div style={{
        position:'fixed', inset:0, zIndex:50,
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:16,
      }}>
        <div className="w-full flex flex-col overflow-hidden animate-slide-up-modal"
          style={{ maxWidth:680, maxHeight:'92vh', borderRadius:20, background:'rgba(9,6,26,0.97)', border:'1px solid rgba(150,142,156,0.15)', backdropFilter:'blur(24px)', boxShadow:'0 32px 80px rgba(64,41,112,0.35)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
            style={{ borderBottom:'1px solid rgba(74,68,81,0.30)' }}>
            <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--c-on-surface-variant)' }}>
              {product?.category ?? 'Product Details'}
            </span>
            <button onClick={onClose}
              style={{ width:30, height:30, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', ...surface, color:'var(--c-on-surface-variant)', cursor:'pointer', border:'1px solid rgba(74,68,81,0.30)', fontSize:14 }}>✕</button>
          </div>

          {/* Tab bar */}
          <div className="flex flex-shrink-0" style={{ borderBottom:'1px solid rgba(74,68,81,0.25)', background:'rgba(16,11,36,0.50)' }}>
            <TabBtn id="overview" label="Overview"   emoji="📦"/>
            <TabBtn id="summary"  label="AI Summary" emoji="✨"/>
            <TabBtn id="ask"      label="Ask AI"     emoji="💬"/>
            <TabBtn id="compare" label="Compare" emoji="⚖️"/>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden flex flex-col">

            {/* OVERVIEW TAB ─────────────────────────── */}
            {tab === 'overview' && (
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex flex-col md:flex-row animate-pulse">
                    <div className="w-full md:w-64 flex-shrink-0"><div className="skeleton" style={{ paddingTop:'75%' }}/></div>
                    <div className="p-5 flex-1 space-y-3">
                      {[1,.75,.4,.9,.7].map((w,i)=><div key={i} className="skeleton h-3 rounded" style={{ width:`${w*100}%` }}/>)}
                    </div>
                  </div>
                ) : product ? (
                  <div className="flex flex-col md:flex-row">
                    {/* Gallery — up to 10 images */}
                    <div className="w-full md:w-64 flex-shrink-0"
                      style={{ borderRight:'1px solid rgba(74,68,81,0.25)', background:'rgba(17,11,46,0.40)' }}>
                      <div style={{ position:'relative', paddingTop:'75%', overflow:'hidden' }}>
                        {!heroImgLoaded && (
                          <div className="skeleton" style={{ position:'absolute', inset:0 }} />
                        )}
                        <img
                          src={images[activeImg] || `https://placehold.co/400x300/110b2e/6b4dab?text=${encodeURIComponent(product.name.slice(0,10))}`}
                          alt={product.name} loading="lazy"
                          onLoad={() => setHeroImgLoaded(true)}
                          onError={() => setHeroImgLoaded(true)}
                          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:heroImgLoaded?1:0, transition:'opacity 0.3s ease' }}
                        />
                        {/* Image counter */}
                        {images.length > 1 && (
                          <div style={{ position:'absolute', bottom:8, right:8, background:'rgba(0,0,0,0.60)', borderRadius:8, padding:'2px 8px', fontSize:11, fontWeight:700, color:'white' }}>
                            {activeImg+1} / {images.length}
                          </div>
                        )}
                      </div>
                      {/* Thumbnail strip — scrollable, up to 10 */}
                      {images.length > 1 && (
                        <div style={{ display:'flex', gap:6, padding:'8px 10px', overflowX:'auto', scrollbarWidth:'none' }}>
                          {images.map((src,i)=>(
                            <button key={i} onClick={()=>setActiveImg(i)}
                              style={{ width:44, height:44, borderRadius:8, overflow:'hidden', flexShrink:0, border:`2px solid ${i===activeImg?'var(--c-primary-container)':'transparent'}`, opacity:i===activeImg?1:0.45, cursor:'pointer', transition:'all 0.15s' }}>
                              <img src={src} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-5 space-y-4 overflow-y-auto">
                      <h2 style={{ fontWeight:700, fontSize:16, lineHeight:1.35, color:'var(--c-on-surface)' }}>{product.name}</h2>
                      <p style={{ fontWeight:900, fontSize:24, letterSpacing:'-0.02em', color:'var(--c-secondary)' }}>
                        {s.lkr} {product.price.toLocaleString('si-LK')}
                      </p>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ width:8, height:8, borderRadius:'50%', background:stockOk(product)?'#4ade80':'#f87171', flexShrink:0 }}/>
                        <span style={{ fontSize:12, fontWeight:600, color:stockOk(product)?'#4ade80':'#f87171' }}>
                          {stockOk(product)?s.inStock:s.outOfStock}
                          {typeof product.stock==='string'&&product.stock?` (${product.stock})`:''}
                        </span>
                      </div>
                      {desc && <p style={{ fontSize:13, lineHeight:1.65, color:'var(--c-on-surface-variant)' }}>{desc}</p>}

                      {/* Rating + Reviews */}
                      {(product.rating_score || product.review_count) && (
                        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                          {product.rating_score && (
                            <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:13, fontWeight:700, color:'#fbbf24' }}>
                              {'★'.repeat(Math.round(product.rating_score))}{'☆'.repeat(5 - Math.round(product.rating_score))}
                              <span style={{ color:'var(--c-on-surface-variant)', fontWeight:500, marginLeft:2 }}>{product.rating_score.toFixed(1)}</span>
                            </span>
                          )}
                          {product.review_count && (
                            <span style={{ fontSize:12, color:'var(--c-on-surface-variant)' }}>{product.review_count} review{product.review_count !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                      )}

                      {/* Brand + Warranty */}
                      {(product.brand_or_merchant || product.warranty_or_guarantee) && (
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                          {product.brand_or_merchant && (
                            <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:'rgba(215,186,255,0.08)', border:'1px solid rgba(215,186,255,0.18)', color:'var(--c-primary)' }}>
                              🏷 {product.brand_or_merchant}
                            </span>
                          )}
                          {product.warranty_or_guarantee && (
                            <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.18)', color:'#4ade80' }}>
                              🛡 {product.warranty_or_guarantee}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Specifications */}
                      {product.specifications && product.specifications.length > 0 && (
                        <div>
                          <p style={{ fontSize:11, fontWeight:700, color:'var(--c-outline)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Specifications</p>
                          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                            {product.specifications.map((spec, i) => (
                              <div key={i} style={{ display:'flex', gap:8, fontSize:12, lineHeight:1.5 }}>
                                <span style={{ color:'var(--c-on-surface-variant)', flexShrink:0 }}>•</span>
                                <span style={{ color:'var(--c-on-surface)' }}>{spec}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Shipping info from page fetch */}
                      {product.shipping_info && !product.shipping && (
                        <div style={{ display:'flex', gap:8, borderRadius:12, padding:12, ...surface }}>
                          <span style={{ fontSize:16 }}>🚚</span>
                          <p style={{ fontSize:12, lineHeight:1.55, color:'var(--c-on-surface-variant)' }}>{product.shipping_info}</p>
                        </div>
                      )}
                      {product.shipping && (
                        <div style={{ display:'flex', gap:8, borderRadius:12, padding:12, ...surface }}>
                          <span style={{ fontSize:16 }}>🚚</span>
                          <p style={{ fontSize:12, lineHeight:1.55, color:'var(--c-on-surface-variant)' }}>{product.shipping}</p>
                        </div>
                      )}

                      {/* Payment options — installment plans */}
                      {product.payment_options && (
                        <div style={{ borderRadius:12, padding:12, background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.15)' }}>
                          <div style={{ display:'flex', gap:8, marginBottom: product.payment_options.includes('|') ? 8 : 0 }}>
                            <span style={{ fontSize:16 }}>💳</span>
                            <p style={{ fontSize:12, lineHeight:1.55, color:'var(--c-on-surface-variant)', margin:0 }}>
                              {product.payment_options.includes('|')
                                ? 'Installment Plans Available:'
                                : product.payment_options}
                            </p>
                          </div>
                          {product.payment_options.includes('|') && (
                            <div style={{ display:'flex', flexDirection:'column', gap:4, marginLeft:24 }}>
                              {product.payment_options.split('|').map((plan, i) => (
                                <span key={i} style={{ fontSize:11, fontWeight:600, color:'#fbbf24', lineHeight:1.4 }}>
                                  {plan.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* AI Summary teaser */}
                      <button onClick={()=>{ setTab('summary'); fetchSummary(); }}
                        style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'10px 14px', borderRadius:12, cursor:'pointer', background:'rgba(189,147,249,0.08)', border:'1px solid rgba(189,147,249,0.25)', color:'var(--c-primary)', fontSize:13, fontWeight:600, transition:'all 0.15s', fontFamily:'var(--font-body)' }}
                        onMouseOver={e=>e.currentTarget.style.background='rgba(189,147,249,0.15)'}
                        onMouseOut={e=>e.currentTarget.style.background='rgba(189,147,249,0.08)'}>
                        ✨ Get AI Summary &amp; ask questions about this product →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:200, gap:12, textAlign:'center' }}>
                    <p style={{ fontSize:14, color:'var(--c-on-surface-variant)' }}>Could not load details.</p>
                    {viewUrl && <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="btn-gold" style={{ padding:'10px 20px', borderRadius:12, fontSize:13, display:'inline-block' }}>{s.viewOnKapruka}</a>}
                  </div>
                )}
              </div>
            )}

            {/* AI SUMMARY TAB ──────────────────────── */}
            {tab === 'summary' && (
              <div className="flex-1 overflow-y-auto" style={{ padding:20 }}>
                {summaryLoad ? (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, paddingTop:32, textAlign:'center' }}>
                    {TypingDots}
                    <p style={{ fontSize:13, color:'var(--c-on-surface-variant)' }}>Generating AI summary…</p>
                  </div>
                ) : summary ? (
                  <div>
                    <p style={{ fontSize:11, fontWeight:700, color:'var(--c-outline)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>
                      AI-Generated Summary
                    </p>
                    <div style={{ padding:'16px 18px', borderRadius:14, background:'rgba(34,28,49,0.70)', border:'1px solid rgba(74,68,81,0.30)', fontSize:14, lineHeight:1.75, color:'var(--c-on-surface)' }}>
                      {renderMd(summary)}
                    </div>
                    <p style={{ fontSize:11, color:'var(--c-outline)', marginTop:12, textAlign:'center' }}>AI-generated · Always verify with the product page</p>
                    <button onClick={()=>{ setTab('ask'); }}
                      style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', marginTop:14, padding:'11px', borderRadius:12, cursor:'pointer', background:'rgba(189,147,249,0.10)', border:'1px solid rgba(189,147,249,0.28)', color:'var(--c-primary)', fontSize:13, fontWeight:600, fontFamily:'var(--font-body)' }}>
                      💬 Ask a question about this product →
                    </button>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, paddingTop:32 }}>
                    <p style={{ fontSize:14, color:'var(--c-on-surface-variant)' }}>Could not load summary.</p>
                    <button onClick={fetchSummary} className="btn-primary" style={{ padding:'10px 20px', borderRadius:12, fontSize:13 }}>Retry</button>
                  </div>
                )}
              </div>
            )}

            {/* ASK AI TAB ──────────────────────────── */}
            {tab === 'ask' && (
              <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                {/* Messages */}
                <div style={{ flex:1, overflowY:'auto', padding:'14px 16px' }}>
                  {chatMsgs.length === 0 && (
                    <div>
                      <p style={{ fontSize:12, color:'var(--c-outline)', textAlign:'center', marginBottom:14 }}>
                        Ask anything about <strong style={{ color:'var(--c-on-surface)' }}>{product?.name}</strong>
                      </p>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
                        {QUICK_QS.map(q=>(
                          <button key={q} onClick={()=>askAI(q)}
                            style={{ padding:'7px 12px', borderRadius:9999, fontSize:12, fontWeight:600, cursor:'pointer', background:'rgba(44,39,60,0.80)', border:'1px solid rgba(74,68,81,0.40)', color:'var(--c-on-surface-variant)', transition:'all 0.15s', fontFamily:'var(--font-body)' }}
                            onMouseOver={e=>{ e.currentTarget.style.borderColor='rgba(189,147,249,0.40)'; e.currentTarget.style.color='var(--c-on-surface)'; }}
                            onMouseOut={e=>{ e.currentTarget.style.borderColor='rgba(74,68,81,0.40)'; e.currentTarget.style.color='var(--c-on-surface-variant)'; }}>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {chatMsgs.map((m,i)=>(
                    <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start', marginBottom:10 }}>
                      {m.role==='assistant' && (
                        <img src="/kapruka-logo.png" alt="" style={{ width:22, height:22, borderRadius:'50%', objectFit:'contain', flexShrink:0, marginRight:8, marginTop:2, background:'var(--c-secondary)', padding:2 }}
                          onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
                      )}
                      <div style={{
                        maxWidth:'82%', padding:'9px 13px', borderRadius:12, fontSize:13, lineHeight:1.6,
                        ...(m.role==='user'
                          ? { background:'var(--c-primary-container)', color:'var(--c-on-primary-container)', borderTopRightRadius:3 }
                          : { background:'var(--c-surface-container)', color:'var(--c-on-surface)', borderTopLeftRadius:3, border:'1px solid rgba(74,68,81,0.25)', borderLeft:'2px solid rgba(215,186,255,0.40)' }),
                      }}>
                        {m.content}
                      </div>
                    </div>
                  ))}

                  {chatBusy && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                      <img src="/kapruka-logo.png" alt="" style={{ width:22, height:22, borderRadius:'50%', objectFit:'contain', background:'var(--c-secondary)', padding:2 }}
                        onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
                      <div style={{ padding:'9px 13px', borderRadius:12, background:'var(--c-surface-container)', border:'1px solid rgba(74,68,81,0.25)', borderTopLeftRadius:3 }}>
                        {TypingDots}
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef}/>
                </div>

                {/* Input */}
                <div style={{ padding:'10px 14px', borderTop:'1px solid rgba(74,68,81,0.20)', background:'rgba(16,11,36,0.60)', backdropFilter:'blur(8px)', display:'flex', gap:8, alignItems:'flex-end' }}>
                  <textarea
                    value={chatInput}
                    onChange={e=>setChatInput(e.target.value)}
                    onKeyDown={(e:KeyboardEvent<HTMLTextAreaElement>)=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();askAI(chatInput.trim());} }}
                    placeholder="Ask about this product…"
                    disabled={chatBusy || !product}
                    rows={1}
                    style={{ flex:1, background:'rgba(34,28,49,0.70)', border:'1px solid rgba(74,68,81,0.35)', borderRadius:12, padding:'8px 12px', fontSize:13, color:'var(--c-on-surface)', resize:'none', outline:'none', fontFamily:'var(--font-body)', scrollbarWidth:'none', lineHeight:1.5 }}
                  />
                  <button
                    onClick={()=>askAI(chatInput.trim())}
                    disabled={!chatInput.trim()||chatBusy||!product}
                    className="btn-primary"
                    style={{ width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, opacity:(!chatInput.trim()||chatBusy)?0.4:1 }}>
                    <SendIcon size={16}/>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* COMPARE TAB ─────────────────────────── */}
          {tab === 'compare' && (() => {
            // Helper: render one table row (shared for current + comparison products)
            const TableRow = ({ p, isCurrent, idx }: {
              p: { id:string; name:string; price:number; image?:string; url?:string; category?:string; in_stock?:boolean; stock?:string|boolean };
              isCurrent: boolean; idx: number;
            }) => {
              const ok    = p.in_stock === true || (typeof p.stock === 'string' && /in.?stock/i.test(p.stock ?? ''));
              const thumb = p.image ? proxyImg(p.image) : '';
              return (
                <tr style={{ borderBottom:'1px solid rgba(74,68,81,0.15)', background: isCurrent?'rgba(189,147,249,0.10)':idx%2===0?'transparent':'rgba(255,255,255,0.015)', outline:isCurrent?'1px solid rgba(189,147,249,0.28)':'none' }}>
                  <td style={{ padding:'8px 8px 8px 0', verticalAlign:'middle' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:44, height:44, borderRadius:8, overflow:'hidden', flexShrink:0, background:'rgba(34,28,49,0.70)', border:`1px solid ${isCurrent?'rgba(189,147,249,0.40)':'rgba(74,68,81,0.25)'}` }}>
                        {thumb ? <img src={thumb} alt={p.name} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, opacity:0.22 }}>📦</div>}
                      </div>
                      <div>
                        <p style={{ fontSize:12, fontWeight:isCurrent?700:600, color:isCurrent?'var(--c-primary)':'var(--c-on-surface)', lineHeight:1.3, maxWidth:150, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{p.name}</p>
                        {isCurrent && <span style={{ fontSize:9, fontWeight:700, color:'var(--c-primary)', background:'rgba(189,147,249,0.15)', padding:'1px 6px', borderRadius:20, marginTop:3, display:'inline-block', letterSpacing:'0.04em' }}>VIEWING</span>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'8px', verticalAlign:'middle', color:'var(--c-on-surface-variant)', fontSize:11, whiteSpace:'nowrap' }}>{p.category || product?.category || '—'}</td>
                  <td style={{ padding:'8px', verticalAlign:'middle', textAlign:'right', fontWeight:700, color:'var(--c-secondary)', whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums' }}>{s.lkr}&nbsp;{p.price.toLocaleString('si-LK')}</td>
                  <td style={{ padding:'8px', verticalAlign:'middle', textAlign:'center' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, whiteSpace:'nowrap', background:ok?'rgba(74,222,128,0.12)':'rgba(248,113,113,0.12)', color:ok?'#4ade80':'#f87171', border:`1px solid ${ok?'rgba(74,222,128,0.30)':'rgba(248,113,113,0.30)'}` }}>
                      <span style={{ width:5, height:5, borderRadius:'50%', background:'currentColor', flexShrink:0 }}/>{ok?'In Stock':'Out'}
                    </span>
                  </td>
                  <td style={{ padding:'8px', verticalAlign:'middle', textAlign:'center' }}>
                    {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:8, border:'1px solid rgba(189,147,249,0.30)', color:'var(--c-primary)', textDecoration:'none', fontSize:13, transition:'all 0.15s' }} onMouseOver={e=>e.currentTarget.style.background='rgba(189,147,249,0.15)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>→</a> : <span style={{ color:'var(--c-outline)' }}>—</span>}
                  </td>
                </tr>
              );
            };

            // Skeleton row while loading
            const SkeletonRow = () => (
              <tr style={{ borderBottom:'1px solid rgba(74,68,81,0.10)' }}>
                <td style={{ padding:'8px 8px 8px 0' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div className="skeleton" style={{ width:44, height:44, borderRadius:8, flexShrink:0 }}/>
                    <div style={{ flex:1 }}>
                      <div className="skeleton" style={{ height:12, width:'80%', borderRadius:4, marginBottom:5 }}/>
                      <div className="skeleton" style={{ height:10, width:'50%', borderRadius:4 }}/>
                    </div>
                  </div>
                </td>
                {[1,2,3,4].map(i => <td key={i} style={{ padding:'8px' }}><div className="skeleton" style={{ height:12, borderRadius:4, width:i===2?40:i===3?60:24 }}/></td>)}
              </tr>
            );

            const total = 1 + compareData.length;
            return (
              <div className="flex-1 overflow-y-auto" style={{ padding:16 }}>
                <p style={{ fontSize:11, fontWeight:700, color:'var(--c-outline)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:14 }}>
                  {compareLoading ? 'Loading comparison…' : `${total} product${total!==1?'s':''} · ${product?.category ?? 'Same Category'}`}
                </p>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid rgba(74,68,81,0.35)' }}>
                        {['Product','Category','Price','Stock','Link'].map(h => (
                          <th key={h} style={{ textAlign:h==='Price'?'right':h==='Stock'||h==='Link'?'center':'left', padding:'6px 8px 8px', fontWeight:700, color:'var(--c-outline)', fontSize:10, textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap', fontFamily:'var(--font-body)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Row 1: always the product currently being viewed */}
                      {product && <TableRow p={product} isCurrent={true} idx={0}/>}
                      {/* Rows 2-5: MCP comparison results */}
                      {compareLoading
                        ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i}/>)
                        : compareData.map((p, i) => <TableRow key={p.id} p={p} isCurrent={false} idx={i+1}/>)
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Footer CTAs */}
          <div style={{ display:'flex', gap:10, padding:'12px 16px', flexShrink:0, borderTop:'1px solid rgba(74,68,81,0.25)' }}>
            {product && (
              <button onClick={handleAdd} className={added?'':'btn-primary'}
                style={{
                  flex:1, padding:'12px 0', borderRadius:14, fontWeight:700, fontSize:14, cursor:'pointer',
                  ...(added ? { background:'rgba(34,197,94,0.20)', color:'#4ade80', border:'1px solid rgba(34,197,94,0.30)' } : {}),
                }}>
                {added ? <><CheckIcon size={14} style={{display:'inline',marginRight:4}}/> Added!</> : inCart ? `✓ ${s.addToCartModal}` : s.addToCartModal}
              </button>
            )}
            {viewUrl && (
              <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                style={{ flex:1, padding:'12px 0', borderRadius:14, fontWeight:700, fontSize:14, textAlign:'center', display:'block', border:'1px solid rgba(189,147,249,0.35)', color:'var(--c-primary)', transition:'all 0.15s', textDecoration:'none' }}
                onMouseOver={e=>e.currentTarget.style.background='rgba(64,41,112,0.15)'}
                onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                {s.viewOnKapruka}
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}