'use client';
import { useState, useRef, useEffect, useCallback, KeyboardEvent, MutableRefObject, memo } from 'react';
import { STRINGS, Lang } from '@/lib/strings';
import { useCart, Product } from '@/context/CartContext';
import { detectExpat, detectExpatCountry } from '@/lib/expat';
import ExpatBanner from './ExpatBanner';
import { MicIcon, SendIcon, AttachIcon, AddCartIcon, CheckIcon, GlobeIcon, ThumbsUpIcon, ThumbsDownIcon, ChevronRightIcon, VoiceSparkleIcon } from './Icons';
import { useVoiceMode } from '@/lib/useVoiceMode';
import AudioVisualizer from './AudioVisualizer';

import InvoiceTemplate, { type InvoiceData } from './InvoiceTemplate';

/* ── Types ─────────────────────────────────────────────────── */
interface ThinkingData { intent: string; goal: string; constraints: string[]; plan: string[]; }
interface ReceiptItem { id: string; name: string; price: number; qty: number; image: string; }
interface ReceiptData {
  orderId: string;
  items: ReceiptItem[];
  recipient: string;
  phone: string;
  address?: string;
  city?: string;
  deliveryDate?: string;
  pickup?: string;
  occasion?: string;
  giftMessage?: string;
  instructions?: string;
  deliveryFee: number;
  total: number;
  checkoutUrl?: string;
}
interface Message { role: 'user' | 'assistant'; content: string; products?: Product[]; imagePreview?: string; thinking?: ThinkingData; receipt?: ReceiptData; }
interface PendingImage { base64: string; mimeType: string; preview: string; }
interface ChatPanelProps {
  lang: Lang;
  onLangChange: (l: Lang) => void;
  onProductsFound: (products: Product[], quantum?: boolean) => void;
  onSearching: (v: boolean) => void;
  speakerOn: boolean;
  onSpeakerToggle: () => void;
  autoSend?: string;
  onAutoSendDone?: () => void;
  onClearRef?: MutableRefObject<(() => void) | null>;
}

/* ── Utils ─────────────────────────────────────────────────── */
const SL_WORDS = new Set(['mama','oyage','oyata','api','apita','mata','eka','ekak','ona','onee','nehe','koheda','kohomada','mokada','puluwan','bohoma','hariyata','gedara','amma','thaththa','putha','akka','aiya','nangi','malli','hondai','hondhai','hari','tika','tikak','godak','isthuti','ayubowan','denna','ganna','ganda','wage','witharak','kiyala','yanna','karanna','karala','kamak','nae','newei','sellam','kema','kanna','bonna','danna','enava','yanawa','karanawa','tiyenawa','thiyenawa','nattang','epa','inna','wela','balanna','hadanna']);
const TL_WORDS = new Set(['machang','machan','aiyo','oneda','aney','yako','oru','naan','nee','ungal','ungaluku','ungalukku','enakku','avan','aval','avanga','ivanga','nanga','romba','rombha','konjam','konju','niraya','ellam','illa','aama','sari','seri','venum','venuma','venumla','venumda','vendum','vendaam','vendam','vendanum','pannunga','pannu','panren','panniten','sollunga','sollu','kudunga','kudu','vaanga','vaa','vangunga','vanganum','anuppu','anuppanum','anuppuvoma','anuppa','appaku','ammaku','thambiku','akkaku','annaku','rupai','rupaiku','rupaikulla','ulla','kitta','kooda','mattum','evlo','evvalo','epdi','eppadi','enna','yenna','enga','epo','eppo','yepo','nalla','aaguma','aagum','kaattu','kaattunga','poda','podi','vaanunga','da','la','neh','nu']);
function detectLangClient(text: string, currentLang: Lang = 'en'): Lang {
  const t = text.trim();
  if (!t) return currentLang;
  if (/[\u0D80-\u0DFF]/.test(t)) return 'si';
  if (/[\u0B80-\u0BFF]/.test(t)) return 'ta';
  const words = t.toLowerCase().match(/[a-z']+/g) ?? [];
  let slScore = 0, tlScore = 0;
  for (const w of words) {
    if (SL_WORDS.has(w)) slScore++;
    if (TL_WORDS.has(w)) tlScore++;
  }
  if (slScore === 0 && tlScore === 0) return currentLang;
  if (slScore === tlScore) {
    if (currentLang === 'sl' || currentLang === 'tl') return currentLang;
    return 'tl';
  }
  return tlScore > slScore ? 'tl' : 'sl';
}
function cleanResponse(t: string) {
  return t
    .replace(/<tara_thinking>[\s\S]*?<\/tara_thinking>/g,'')
    .replace(/<search_query>[\s\S]*?<\/search_query>/g,'')
    .replace(/<checkout_fill>[\s\S]*?<\/checkout_fill>/g,'')
    .replace(/<[^>]+>/g,'').replace(/```[\s\S]*?```/g,'')
    .replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1')
    .replace(/^#{1,6}\s+/gm,'').trim();
}
function extractQuery(t: string) { const m = t.match(/<search_query>([\s\S]*?)<\/search_query>/); return m ? m[1].trim() : null; }
function extractCheckoutFill(t: string): Record<string,string>|null {
  const m = t.match(/<checkout_fill>([\s\S]*?)<\/checkout_fill>/);
  if (!m) return null;
  try { return JSON.parse(m[1].trim()); } catch { return null; }
}
function proxyImg(url: string) { if (!url) return ''; return url.includes('kapruka.com') ? `/api/img?url=${encodeURIComponent(url)}` : url; }
const LANG_OPTS: { key:Lang; label:string }[] = [
  {key:'si',label:'🇱🇰 සිං'},{key:'sl',label:'🇱🇰 SL'},
  {key:'ta',label:'🇱🇰 த'},{key:'tl',label:'🇱🇰 TL'},{key:'en',label:'🇬🇧 EN'},
];

/* ── Inline chat card ─────────────────────────────────────── */
const InlineChatCard = memo(function InlineChatCard({ product, lang, onViewDetail, isTaraPick }: {
  product: Product & { url?: string };
  lang: Lang;
  onViewDetail?: (id: string, url: string) => void;
  isTaraPick?: boolean;
}) {
  const { addItem, cartIds } = useCart();
  const s = STRINGS[lang];
  const [added,   setAdded]   = useState(false);
  const [imgOk,   setImgOk]   = useState<boolean | null>(null);
  const [lazyImg, setLazyImg] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const inCart  = cartIds.has(product.id);

  useEffect(() => {
    const src = proxyImg(product.image || lazyImg);
    if (src || !product.id) return;
    let cancelled = false;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      fetch('/api/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id }),
      })
        .then(r => r.json())
        .then(d => { if (!cancelled) setLazyImg(d?.product?.image || d?.product?.image_url || ''); })
        .catch(() => {});
    }, { rootMargin: '60px' });
    if (cardRef.current) obs.observe(cardRef.current);
    return () => { cancelled = true; obs.disconnect(); };
  }, [product.id, product.image, lazyImg]);

  const imgSrc = proxyImg(product.image || lazyImg);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({ id: product.id, name: product.name, price: product.price, image: product.image });
    setAdded(true); setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div ref={cardRef} className="chat-product-card"
      onClick={() => onViewDetail?.(product.id, product.url ?? '')}
      role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onViewDetail?.(product.id, product.url ?? ''); }}
      style={isTaraPick ? { border: '2px solid var(--c-secondary)', borderRadius: 12, position: 'relative' } : undefined}>
      {isTaraPick && (
        <div style={{
          position: 'absolute', top: -1, right: -1, zIndex: 2,
          background: 'var(--c-secondary)', color: 'var(--c-on-secondary)',
          fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: '0 10px 0 8px',
          letterSpacing: 0.3, textTransform: 'uppercase', fontFamily: 'var(--font-body)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
        }}>
          ★ TARA's Pick
        </div>
      )}
      <div style={{ position:'relative', height:110, background:'var(--c-surface-container)', overflow:'hidden' }}>
        {imgOk === null && (
          <div className="skeleton" style={{ position:'absolute', inset:0 }} />
        )}
        {imgOk === false && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:'2rem', opacity:0.12 }}>📦</span>
          </div>
        )}
        {imgSrc && imgOk !== false && (
          <img src={imgSrc} alt={product.name} loading="lazy"
            style={{ width:'100%', height:'100%', objectFit:'cover', opacity:imgOk===true?1:0, transition:'opacity 0.35s' }}
            onLoad={() => setImgOk(true)} onError={() => setImgOk(false)}
          />
        )}
        {inCart && (
          <div style={{ position:'absolute', top:5, right:5, background:'var(--c-primary-container)', color:'var(--c-on-primary-container)', borderRadius:9999, padding:'1px 6px', fontSize:10, fontWeight:800 }}>✓</div>
        )}
      </div>
      <div style={{ padding:'8px 10px' }}>
        <p className="line-clamp-2" style={{ fontSize:12, fontWeight:700, color:'var(--c-on-surface)', lineHeight:1.3 }}>{product.name}</p>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6 }}>
          <span className="product-price" style={{ fontSize:12 }}>{s.lkr} {product.price.toLocaleString('si-LK')}</span>
          <button onClick={handleAdd} title={s.addToCart}
            style={{ width:28, height:28, borderRadius:8, flexShrink:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:added?'rgba(34,197,94,0.20)':'var(--c-surface-container-lowest)', color:added?'#4ade80':'var(--c-primary)', border:'1px solid rgba(74,68,81,0.30)', transition:'all 0.15s' }}
            onMouseOver={e => { if(!added){ e.currentTarget.style.background='var(--c-primary-container)'; e.currentTarget.style.color='var(--c-on-primary-container)'; }}}
            onMouseOut={e => { if(!added){ e.currentTarget.style.background='var(--c-surface-container-lowest)'; e.currentTarget.style.color='var(--c-primary)'; }}}>
            {added ? <CheckIcon size={13}/> : <AddCartIcon size={13}/>}
          </button>
        </div>
      </div>
    </div>
  );
});

/* ── Receipt Block (inline product images + checkout details + PDF) ────── */
function ReceiptBlock({ receipt, onViewDetail }: {
  receipt: ReceiptData;
  onViewDetail: (id: string, url: string) => void;
}) {
  const fmt = (n: number) => n.toLocaleString('si-LK');
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [pendingPdf, setPendingPdf] = useState<InvoiceData | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfAction, setPdfAction] = useState<'download' | 'share'>('download');

  // PDF generation effect — runs when pendingPdf is set
  useEffect(() => {
    if (!pendingPdf || !invoiceRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        await new Promise(r => setTimeout(r, 120));
        if (cancelled || !invoiceRef.current) return;
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
          import('html2canvas'),
          import('jspdf'),
        ]);
        if (cancelled || !invoiceRef.current) return;
        const canvas = await html2canvas(invoiceRef.current, {
          scale: 2, useCORS: true, allowTaint: false,
          backgroundColor: '#FDFDFD', logging: false,
        });
        if (cancelled) return;
        const pxW = canvas.width / 2;
        const pxH = canvas.height / 2;
        const img = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({ unit: 'px', format: [pxW, pxH], orientation: 'portrait' });
        pdf.addImage(img, 'JPEG', 0, 0, pxW, pxH);
        if (pendingPdf.checkoutUrl) {
          const linkTop = pxH * 0.72;
          pdf.link(20, linkTop, pxW - 40, pxH - linkTop - 40, { url: pendingPdf.checkoutUrl });
        }
        if (pdfAction === 'share') {
          const blob = pdf.output('blob');
          const file = new File([blob], `kapruka-order-${pendingPdf.orderId}.pdf`, { type: 'application/pdf' });
          try {
            if (navigator.canShare?.({ files: [file] })) {
              await navigator.share({ files: [file], title: `Kapruka Order ${pendingPdf.orderId}`, text: 'Your Kapruka order details — tap to open or forward.' });
            } else {
              pdf.save(`kapruka-order-${pendingPdf.orderId}.pdf`);
            }
          } catch {
            pdf.save(`kapruka-order-${pendingPdf.orderId}.pdf`);
          }
        } else {
          pdf.save(`kapruka-order-${pendingPdf.orderId}.pdf`);
        }
      } catch (e) {
        console.error('[TARA:INVOICE] PDF generation failed:', e);
      } finally {
        if (!cancelled) { setPdfLoading(false); setPendingPdf(null); }
      }
    })();
    return () => { cancelled = true; };
  }, [pendingPdf, pdfAction]);

  const generatePdf = async (action: 'download' | 'share') => {
    setPdfAction(action);
    setPdfLoading(true);
    let giftCardImage: string | undefined;
    try {
      const r = await fetch('/api/generate-gift-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occasion: receipt.occasion ?? '', recipient: receipt.recipient }),
      });
      if (r.ok) {
        const d = await r.json() as { image?: string };
        if (d.image) giftCardImage = d.image;
      }
    } catch { /* PDF still generates without gift card art */ }

    let qrCode: string | undefined;
    if (receipt.checkoutUrl) {
      try {
        const QRCode = (await import('qrcode')).default;
        qrCode = await QRCode.toDataURL(receipt.checkoutUrl, {
          width: 150, margin: 1, color: { dark: '#422B75', light: '#FFFFFF' },
        });
      } catch { /* skip QR */ }
    }

    setPendingPdf({
      state: 'unpaid',
      orderId: receipt.orderId,
      orderDate: new Date().toISOString(),
      checkoutUrl: receipt.checkoutUrl,
      qrCode,
      giftCardImage,
      items: receipt.items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, image: i.image })),
      recipientName: receipt.recipient,
      recipientPhone: receipt.phone,
      address: receipt.address ?? receipt.pickup ?? '',
      city: receipt.city ?? '',
      deliveryDate: receipt.deliveryDate ?? '',
      deliveryFee: receipt.deliveryFee,
      grandTotal: receipt.total,
      occasion: receipt.occasion,
      giftMessage: receipt.giftMessage,
      specialInstructions: receipt.instructions,
    });
  };

  return (
    <>
      {/* Hidden invoice render target — captured by html2canvas, never visible */}
      <div style={{ position: 'fixed', left: -9999, top: 0, opacity: 0, pointerEvents: 'none', zIndex: -1 }}>
        <div ref={invoiceRef}>
          {pendingPdf && <InvoiceTemplate data={pendingPdf} />}
        </div>
      </div>

      <div style={{ marginTop: 12, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(215,186,255,0.18)', background: 'rgba(34,28,49,0.45)' }}>
        {/* Items with images */}
        <div style={{ padding: '10px 12px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-on-surface-variant)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Items</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {receipt.items.map((item) => {
              const img = item.image ? `/api/img?url=${encodeURIComponent(item.image)}` : '';
              return (
                <div key={item.id}
                  onClick={() => onViewDetail(item.id, '')} role="button" tabIndex={0}
                  style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--c-surface-container)' }}>
                    {img ? (
                      <img src={img} alt={item.name} loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '1.2rem', opacity: 0.2 }}>📦</span>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-on-surface)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--c-on-surface-variant)', marginTop: 2 }}>×{item.qty} — LKR {fmt(item.price * item.qty)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(215,186,255,0.12)' }} />

        {/* Details */}
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <ReceiptRow label="Recipient" value={receipt.recipient} />
          <ReceiptRow label="Phone" value={receipt.phone} />
          {receipt.address && <ReceiptRow label="Address" value={receipt.address} />}
          {receipt.city && <ReceiptRow label="City" value={receipt.city} />}
          {receipt.deliveryDate && <ReceiptRow label="Delivery Date" value={receipt.deliveryDate} />}
          {receipt.pickup && <ReceiptRow label="Pickup" value={receipt.pickup} />}
          {receipt.occasion && <ReceiptRow label="Occasion" value={receipt.occasion} />}
          {receipt.giftMessage && <ReceiptRow label="Gift Message" value={`"${receipt.giftMessage}"`} />}
          {receipt.instructions && <ReceiptRow label="Instructions" value={receipt.instructions} />}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(215,186,255,0.12)' }} />

        {/* Totals */}
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--c-on-surface-variant)' }}>
            <span>Delivery Fee</span><span>LKR {fmt(receipt.deliveryFee)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: 'var(--c-on-surface)' }}>
            <span>Total</span><span style={{ color: 'var(--c-secondary)' }}>LKR {fmt(receipt.total)}</span>
          </div>
        </div>

        {/* Pay Now + Download + Share PDF buttons */}
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid rgba(215,186,255,0.08)', background: 'rgba(215,186,255,0.04)' }}>
          {receipt.checkoutUrl && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('tara:open-payment', {
                detail: { checkoutUrl: receipt.checkoutUrl, orderId: receipt.orderId },
              }))}
              className="btn-gold"
              style={{
                width: '100%', padding: '12px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                color: '#3A3A3C', cursor: 'pointer', border: 'none',
                fontFamily: 'var(--font-body)', transition: 'all 0.15s',
              }}>
              🔒 Pay Now
            </button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => generatePdf('download')}
            disabled={pdfLoading}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: 'rgba(64,41,112,0.15)', border: '1px solid rgba(107,77,171,0.40)',
              color: pdfLoading ? 'var(--c-on-surface-variant)' : '#c7abff',
              cursor: pdfLoading ? 'not-allowed' : 'pointer', opacity: pdfLoading ? 0.7 : 1,
              fontFamily: 'var(--font-body)', transition: 'all 0.15s',
            }}>
            {pdfLoading && pdfAction === 'download' ? '⏳ PDF…' : '📄 Download AI Receipt'}
          </button>
          <button
            onClick={() => generatePdf('share')}
            disabled={pdfLoading}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: 'rgba(64,41,112,0.15)', border: '1px solid rgba(107,77,171,0.40)',
              color: pdfLoading ? 'var(--c-on-surface-variant)' : '#c7abff',
              cursor: pdfLoading ? 'not-allowed' : 'pointer', opacity: pdfLoading ? 0.7 : 1,
              fontFamily: 'var(--font-body)', transition: 'all 0.15s',
            }}>
            {pdfLoading && pdfAction === 'share' ? '⏳…' : '↗ Share'}
          </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
      <span style={{ color: 'var(--c-on-surface-variant)', flexShrink: 0, minWidth: 72 }}>{label}:</span>
      <span style={{ color: 'var(--c-on-surface)', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}
/* ── ThinkingPulse ────────────────────────────────────────── */
function ThinkingPulse() {
  const phases = [
    '✦ Analyzing request…',
    '✦ Searching catalog…',
    '✦ Building recommendation…',
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % phases.length), 1300);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{
        width:7, height:7, borderRadius:'50%', flexShrink:0,
        background:'var(--c-primary)',
        animation:'quantum-pulse 1s ease-in-out infinite',
      }}/>
      <span style={{ fontSize:13, color:'var(--c-primary)', fontWeight:600, letterSpacing:'0.02em' }}>
        {phases[idx]}
      </span>
    </div>
  );
}

/* ── ThinkingDrawer ───────────────────────────────────────── */
function ThinkingDrawer({ data }: { data: ThinkingData }) {
  const [visibleSteps, setVisibleSteps] = useState(0);
  const cleanPlan = data.plan.filter(s =>
    !/upsell|cross.sell|gift.chain|suggest.*after|chain.*step/i.test(s)
  );
  useEffect(() => {
    cleanPlan.forEach((_, i) => {
      setTimeout(() => setVisibleSteps(v => Math.max(v, i + 1)), i * 300 + 80);
    });
  }, [cleanPlan.length]);
  return (
    <div className="animate-slide-in-left" style={{
      marginTop:8, padding:'14px 16px',
      background:'rgba(21,16,36,0.88)',
      border:'1px solid rgba(215,186,255,0.18)',
      borderRadius:14,
      backdropFilter:'blur(14px)',
    }}>
      <div style={{ display:'flex', gap:16, marginBottom:12, flexWrap:'wrap' }}>
        <div style={{ flex:'1 1 100px' }}>
          <p style={{ fontSize:9, color:'var(--c-outline)', textTransform:'uppercase', letterSpacing:'0.10em', fontWeight:700, marginBottom:3 }}>Intent</p>
          <p style={{ fontSize:13, color:'var(--c-on-surface)', fontWeight:600, lineHeight:1.35 }}>{data.intent}</p>
        </div>
        <div style={{ flex:'1 1 100px' }}>
          <p style={{ fontSize:9, color:'var(--c-outline)', textTransform:'uppercase', letterSpacing:'0.10em', fontWeight:700, marginBottom:3 }}>Goal</p>
          <p style={{ fontSize:13, color:'var(--c-on-surface)', fontWeight:600, lineHeight:1.35 }}>{data.goal}</p>
        </div>
      </div>
      {data.constraints?.length > 0 && (
        <div style={{ marginBottom:12 }}>
          <p style={{ fontSize:9, color:'var(--c-outline)', textTransform:'uppercase', letterSpacing:'0.10em', fontWeight:700, marginBottom:6 }}>Constraints</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
            {data.constraints.map((c, i) => (
              <span key={i} style={{
                padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600,
                color:'var(--c-primary)',
                background:'rgba(215,186,255,0.10)',
                border:'1px solid rgba(215,186,255,0.22)',
              }}>{c}</span>
            ))}
          </div>
        </div>
      )}
      <div>
        <p style={{ fontSize:9, color:'var(--c-outline)', textTransform:'uppercase', letterSpacing:'0.10em', fontWeight:700, marginBottom:8 }}>Plan</p>
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          {cleanPlan.map((step, i) => (
            <div key={i} style={{
              display:'flex', alignItems:'flex-start', gap:8,
              opacity: i < visibleSteps ? 1 : 0.22,
              transform: i < visibleSteps ? 'translateX(0)' : 'translateX(-6px)',
              transition:'opacity 0.35s ease, transform 0.35s ease',
            }}>
              <span style={{
                width:18, height:18, borderRadius:'50%', flexShrink:0, marginTop:1,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:9, fontWeight:700, transition:'all 0.35s ease',
                background: i < visibleSteps ? 'rgba(74,222,128,0.18)' : 'rgba(215,186,255,0.07)',
                border:`1px solid ${i < visibleSteps ? 'rgba(74,222,128,0.45)' : 'rgba(215,186,255,0.18)'}`,
                color: i < visibleSteps ? '#4ade80' : 'var(--c-outline)',
              }}>
                {i < visibleSteps ? '✓' : i + 1}
              </span>
              <span style={{ fontSize:12.5, color:'var(--c-on-surface-variant)', lineHeight:1.45, flex:1 }}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main ChatPanel ─────────────────────────────────────────── */
export default function ChatPanel({
  lang, onLangChange, onProductsFound, onSearching,
  speakerOn, onSpeakerToggle, autoSend, onAutoSendDone, onClearRef,
}: ChatPanelProps) {
  const s = STRINGS[lang];
  const { addItem, prefillCheckout, cartIds } = useCart();

  const buildInitial = useCallback((l: Lang): Message[] => {
    const msgs: Message[] = [{ role:'assistant', content:STRINGS[l].welcomeMsg }];
    const month = new Date().getMonth();

    // July → Esala season message (hardcoded, no API)
    if (month === 6) {
      msgs.push({
        role: 'assistant',
        content: "Happy Esala Season! 🪔 As the Perahera festivities begin, let's get you ready for the long holiday weekend. I can track down the best deals on modest white temple wear, travel essentials, and festive gift bundles available right now on Kapruka."
      });
    }

    // August → Friendship Day hint (uses translations)
    if (month === 7) {
      msgs.push({ role:'assistant', content:STRINGS[l].friendshipDayHint });
    }

    return msgs;
  }, []);

  const [messages,     setMessages]     = useState<Message[]>(() => buildInitial(lang));
  const [input,        setInput]        = useState('');
  const [streaming,    setStreaming]     = useState(false);
  const [convLang,     setConvLang]     = useState<Lang>(lang);
  const [expatMode,    setExpatMode]    = useState(false);
  const [expatCountry, setExpatCountry] = useState('');
  const [showExpat,    setShowExpat]    = useState(false);
  const [lastOrder,    setLastOrder]    = useState<{ items:{id:string;name:string;price:number;image:string}[] }|null>(null);
  const [reorderDone,  setReorderDone]  = useState(false);
  const [modalId,      setModalId]      = useState<string|null>(null);
  const [modalUrl,     setModalUrl]     = useState('');
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [pendingImg,   setPendingImg]   = useState<PendingImage|null>(null);
  const [visionLoading,setVisionLoading]= useState(false);
  const [feedback, setFeedback] = useState<Record<number,'up'|'down'>>({});
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});
  const [fbModal,  setFbModal]  = useState<{open:boolean;msgIdx:number;category:string;text:string;submitting:boolean;done:boolean}|null>(null);
  const [hiddenProducts, setHiddenProducts] = useState<Record<number, boolean>>({});

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef    = useRef<AbortController|null>(null);
  const fileInputRef= useRef<HTMLInputElement>(null);
  const lastReplyRef= useRef('');   // holds the just-finished assistant reply for TTS handoff
  const speakPromiseRef = useRef<Promise<void> | null>(null); // TTS kicked off as soon as reply text is ready
  const messagesRef = useRef<Message[]>(messages); // always-current — avoids stale closures in the voice-mode auto-loop
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const convLangRef = useRef<Lang>(lang); // always-current — getLang() reads this, not the convLang state snapshot

  useEffect(() => {
    if (onClearRef) onClearRef.current = () => {
      setMessages(buildInitial(lang)); setReorderDone(false); setExpatMode(false); setShowExpat(false); setPendingImg(null);
    };
  }, [onClearRef, lang, buildInitial]);

  useEffect(() => {
    try { const raw = localStorage.getItem('tara_last_order'); if (raw) setLastOrder(JSON.parse(raw)); } catch { /**/ }
  }, []);

  // Gemini-based voice mode (STT + TTS). onTranscript fires once transcription completes;
  // sendMessage is defined further below but this closure isn't invoked until the user
  // actually finishes speaking, by which point sendMessage is already assigned.
  const {
    isRecording, isSending: sttSending, isSpeaking, isPreparingSpeech, voiceModeOn, micSupported,
    startRecording, stopRecording, cancelRecording, speak, speakInstant, stopSpeaking, toggleVoiceMode, analyserRef,
  } = useVoiceMode({
    onTranscript: (text) => sendMessage(text),
    getLang: () => convLangRef.current,
    micDeniedMessage: s.micPermissionDenied,
  });

  useEffect(() => {
    setConvLang(lang);
    convLangRef.current = lang;
    setMessages(prev => {
      const userHasTyped = prev.some(m => m.role === 'user');
      if (userHasTyped) return prev;
      return buildInitial(lang);
    });
  }, [lang, buildInitial]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages, streaming]);

  // ── Listen for cart/checkout notifications from CartContext + CartDrawer ──
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ content: string; products?: Product[]; receipt?: ReceiptData }>).detail;
      if (detail?.content) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: detail.content,
          ...(detail.products?.length ? { products: detail.products } : {}),
          ...(detail.receipt ? { receipt: detail.receipt } : {}),
        }]);
      }
    };
    window.addEventListener('tara:chat-notification', handler);
    return () => window.removeEventListener('tara:chat-notification', handler);
  }, []);
  useEffect(() => { if (!speakerOn && isSpeaking) stopSpeaking(); }, [speakerOn, isSpeaking, stopSpeaking]);
  useEffect(() => {
    const ta = textareaRef.current; if (!ta) return;
    ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 112)}px`;
  }, [input]);

  useEffect(() => {
    if (autoSend?.trim()) { sendMessage(autoSend); onAutoSendDone?.(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend]);

  /* ── Image helpers ──────────────────────────────────────── */
  const handleFileSelect = (file: File) => {
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2 MB.'); return; }
    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      const base64 = result.split(',')[1];
      setPendingImg({ base64, mimeType: file.type, preview: result });
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const f = items[i].getAsFile(); if (f) { handleFileSelect(f); e.preventDefault(); } break;
      }
    }
  };

  /* ── Vision search ──────────────────────────────────────── */
  const runVisionSearch = useCallback(async (img: PendingImage) => {
    setVisionLoading(true);
    setPendingImg(null);
    const userMsg: Message = { role:'user', content:'Find similar products for this image', imagePreview: img.preview };
    const historyBase = [...messagesRef.current, userMsg];
    setMessages(prev => [...prev, userMsg]);
    const thinkingMsg: Message = { role:'assistant', content:'🔍 Analysing your image…' };
    setMessages(prev => [...prev, thinkingMsg]);

    try {
      const r = await fetch('/api/vision-search', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ imageBase64: img.base64, mimeType: img.mimeType }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);

      const desc = d.description || 'product';
      const query = d.query || 'gift';

      setMessages(prev => {
        const c = [...prev];
        c[c.length-1] = { role:'assistant', content:'Searching Kapruka for similar products…' };
        return c;
      });

      const apiText = `[IMAGE_SEARCH] Detected: ${desc} | Suggested search: ${query}`;
      const apiHistory = [...historyBase.slice(0, -1), { role:'user' as const, content: apiText }];

      onSearching(true);
      const res = await fetch('/api/chat', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ messages: apiHistory, expatMode, lang: convLang }),
      });
      if (!res.ok) throw new Error('API error');

      let thinkingData: ThinkingData | null = null;
      const thinkingHeader = res.headers.get('X-Tara-Thinking');
      if (thinkingHeader) {
        try { thinkingData = JSON.parse(decodeURIComponent(thinkingHeader)); } catch { /* invalid JSON — ignore */ }
      }

      const reader = res.body!.getReader(); const decoder = new TextDecoder(); let full = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        full += decoder.decode(value, { stream:true });
        const disp = full.replace(/<tara_thinking>[\s\S]*?<\/tara_thinking>/gi,'').trim();
        setMessages(prev => { const c=[...prev]; c[c.length-1]={role:'assistant',content:disp}; return c; });
      }

      const visible = cleanResponse(full);
      setMessages(prev => { const c=[...prev]; c[c.length-1]={role:'assistant',content:visible,...(thinkingData?{thinking:thinkingData}:{})}; return c; });

      const extractedQuery = extractQuery(full);
      if (extractedQuery) {
        const searchStart = Date.now();
        const sr = await fetch('/api/search', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ primary: extractedQuery }),
        });
        const sd = await sr.json();
        if (sd.products?.length) {
          const remaining = 1000 - (Date.now() - searchStart);
          if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
          onProductsFound(sd.products, sd.quantum);
          setMessages(prev => { const c=[...prev]; c[c.length-1]={...c[c.length-1],products:sd.products.slice(0,8)}; return c; });
        }
      }
    } catch (err) {
      setMessages(prev => {
        const c = [...prev];
        c[c.length-1] = { role:'assistant', content:`⚠️ Couldn't analyse the image. Try describing the product in words!` };
        return c;
      });
    } finally { setVisionLoading(false); onSearching(false); }
  }, [expatMode, convLang, onProductsFound, onSearching]);

  /* ── Send text message ──────────────────────────────────── */
  const sendMessage = useCallback(async (text: string, forcedLang?: Lang) => {
    if (!text.trim() || streaming) return;

    const detected = forcedLang ?? detectLangClient(text, convLang);
    setConvLang(detected);
    convLangRef.current = detected;
    if (detected !== lang) onLangChange(detected);

    const isNewExpat = !expatMode && detectExpat(text);
    if (isNewExpat) { setExpatMode(true); setExpatCountry(detectExpatCountry(text)); setShowExpat(true); }

    const history = [...messagesRef.current, { role:'user' as const, content:text }];
    setMessages(history); setInput(''); setStreaming(true);
    abortRef.current = new AbortController();

    // ── PHASE 1: Instant greeting — show immediately + start TTS via Web Speech API ──
    // Uses browser's built-in speechSynthesis for zero-latency TTS (~50ms, no network).
    // The main LLM response uses the real TTS pipeline (speak()) which has better
    // voice quality but takes 2-5s to start due to network latency.
    const instantGreeting = STRINGS[detected].instantGreeting ?? 'On it! 🔍';
    setMessages(prev => [...prev, { role:'assistant', content: instantGreeting }]);
    lastReplyRef.current = instantGreeting;
    if (speakerOn) speakPromiseRef.current = speakInstant(instantGreeting);

    try {
      const res = await fetch('/api/chat', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ messages:history, expatMode: expatMode||isNewExpat, lang:detected }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error('API error');

      let thinkingData: ThinkingData | null = null;
      const thinkingHeader = res.headers.get('X-Tara-Thinking');
      if (thinkingHeader) {
        try { thinkingData = JSON.parse(decodeURIComponent(thinkingHeader)); } catch { /* invalid JSON — ignore */ }
      }

      // ── PHASE 2: Main LLM response — replace greeting with full reply ───
      const reader = res.body!.getReader(); const decoder = new TextDecoder(); let full = '';
      setMessages(prev => { const c=[...prev]; c[c.length-1]={role:'assistant',content:''}; return c; });

      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        full += decoder.decode(value, { stream:true });
        const disp = full.replace(/<tara_thinking>[\s\S]*?<\/tara_thinking>/gi,'').trim();
        setMessages(prev => { const c=[...prev]; c[c.length-1]={role:'assistant',content:disp}; return c; });
      }

      const visible = cleanResponse(full);
      setMessages(prev => { const c=[...prev]; c[c.length-1]={role:'assistant',content:visible,...(thinkingData?{thinking:thinkingData}:{})}; return c; });
      lastReplyRef.current = visible;
      // Speak the main response after the instant greeting finishes
      if (speakerOn) {
        const prevSpeak = speakPromiseRef.current;
        speakPromiseRef.current = (async () => {
          if (prevSpeak) await prevSpeak; // wait for greeting TTS to finish
          await speak(visible);
        })();
      }

      const query = extractQuery(full);
      if (query) {
        onSearching(true);
        const searchStart = Date.now();
        try {
          const r2 = await fetch('/api/search', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({primary:query}) });
          const d = await r2.json();
          if (d.products?.length) {
            // Sync product-card reveal with TARA's voice: wait out the remainder
            // of a 1s window (measured from when the search request was sent) so
            // cards land close to when speak() actually starts playing, instead
            // of popping in before or well after audio begins.
            const remaining = 1000 - (Date.now() - searchStart);
            if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
            onProductsFound(d.products, d.quantum);
            setMessages(prev => { const c=[...prev]; c[c.length-1]={...c[c.length-1],products:d.products.slice(0,8)}; return c; });
          }
        } catch {/***/} finally { onSearching(false); }
      }

      const om = text.match(/\b([A-Z]{2,6}\d{4,}[A-Z0-9]*)\b/);
      if (om) {
        try {
          const r3 = await fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order_number:om[1]})});
          if (r3.ok) { const {status}=await r3.json(); if (status) setMessages(prev=>[...prev,{role:'assistant',content:`📦 Order ${om[1]}: ${status}`}]); }
        } catch {/***/}
      }

      const checkoutData = extractCheckoutFill(full);
      if (checkoutData) {
        prefillCheckout(checkoutData);
        if (cartIds.size > 0) {
          window.dispatchEvent(new CustomEvent('tara:opencart'));
        } else {
          window.sessionStorage.setItem('tara_opencart_pending', '1');
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name!=='AbortError') setMessages(prev=>[...prev,{role:'assistant',content:'⚠️ Something went wrong. Please try again.'}]);
    } finally {
      setStreaming(false);
      const pending = speakPromiseRef.current;
      speakPromiseRef.current = null;
      lastReplyRef.current = '';
      if (pending) {
        void (async () => {
          await pending;                                          // no-op/non-fatal if TTS is unavailable
          if (voiceModeOn) setTimeout(() => { void startRecording(); }, 500);
        })();
      }
    }
  }, [streaming, lang, convLang, expatMode, onLangChange, onProductsFound, onSearching, speak, startRecording, voiceModeOn]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input.trim()); }
  };

  const handleSend = () => {
    if (pendingImg) { runVisionSearch(pendingImg); return; }
    sendMessage(input.trim());
  };

  const hasUserMsgs = messages.some(m => m.role==='user');
  const chipClasses = ['chip-secondary','chip-primary','chip-neutral','chip-neutral'];
  const TypingDots = (
    <span className="flex gap-1.5 items-center" style={{height:18}}>
      {[0,200,400].map(d=><span key={d} className="dot-bounce rounded-full"
        style={{width:7,height:7,background:'var(--c-primary-container)',animationDelay:`${d}ms`}}/>)}
    </span>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'transparent' }}>

      {/* ── Messages ───────────────────────────────────────── */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 8px' }}>
        <div style={{ maxWidth:760, margin:'0 auto' }}>
          {showExpat && <ExpatBanner country={expatCountry} onDismiss={()=>setShowExpat(false)}/>}

          {messages.map((msg,i)=>(
            <div key={i}
              className={`flex gap-3 ${msg.role==='user'?'justify-end animate-slide-in-right':'animate-slide-in-left'}`}
              style={{marginBottom:12}}>

              {msg.role==='assistant' && (
                <img src="/kapruka-logo.png" alt="TARA"
                  style={{width:28,height:28,borderRadius:'50%',objectFit:'contain',flexShrink:0,marginTop:2,background:'var(--c-secondary)',padding:3}}
                  onError={e=>{(e.target as HTMLImageElement).style.display='none';}}
                />
              )}

              <div style={{display:'flex',flexDirection:'column',gap:4,maxWidth:msg.role==='user'?480:undefined,flex:msg.role==='assistant'?1:undefined,minWidth:0}}>
                {msg.role==='user' && msg.imagePreview && (
                  <div style={{display:'flex',justifyContent:'flex-end',marginBottom:4}}>
                    <img src={msg.imagePreview} alt="Uploaded"
                      style={{maxHeight:120,maxWidth:200,borderRadius:12,objectFit:'cover',border:'1px solid rgba(215,186,255,0.30)'}}/>
                  </div>
                )}
                <div className={msg.role==='user'?'bubble-user':'bubble-tara'}
                  style={{padding:'12px 15px',fontSize:15,lineHeight:1.6,wordBreak:'break-word'}}>
                  {msg.content || (streaming && i===messages.length-1 ? TypingDots : '')}

                  {/* ── Checkout receipt with inline product images ── */}
                  {msg.role==='assistant' && msg.receipt && (
                    <ReceiptBlock receipt={msg.receipt} onViewDetail={(id,url)=>{setModalId(id);setModalUrl(url);}} />
                  )}

                  {msg.role==='assistant' && msg.products && msg.products.length>0 && (
                    <>
                      <button
                        onClick={()=>setHiddenProducts(p=>({...p,[i]:!p[i]}))}
                        style={{display:'flex',alignItems:'center',gap:5,marginTop:12,padding:'4px 0',background:'transparent',border:'none',cursor:'pointer',color:'var(--c-primary)',fontSize:12,fontWeight:600,fontFamily:'var(--font-body)'}}>
                        <span style={{display:'inline-flex',transform:hiddenProducts[i]?'rotate(0deg)':'rotate(90deg)',transition:'transform 0.15s'}}>
                          <ChevronRightIcon size={13}/>
                        </span>
                        {hiddenProducts[i] ? `Show ${msg.products.length} product${msg.products.length>1?'s':''}` : 'Hide products'}
                      </button>
                      {!hiddenProducts[i] && (
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10,marginTop:8}}>
                          {msg.products.map((p,idx)=>(
                            <InlineChatCard key={p.id} product={p as Product&{url?:string}} lang={lang}
                              isTaraPick={idx < 3}
                              onViewDetail={(id,url)=>{setModalId(id);setModalUrl(url);setModalProduct(p as Product);}}/>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {msg.role==='assistant' && msg.thinking && !(streaming && i===messages.length-1) && (
                  <div style={{marginBottom:2}}>
                    <button
                      onClick={()=>setExpandedThinking(p=>({...p,[i]:!p[i]}))}
                      style={{display:'flex',alignItems:'center',gap:5,padding:'3px 10px 3px 8px',borderRadius:20,border:'none',cursor:'pointer',fontFamily:'var(--font-body)',transition:'all 0.15s',
                        background:expandedThinking[i]?'rgba(215,186,255,0.18)':'rgba(215,186,255,0.08)',
                        color:'var(--c-primary)',fontSize:11,fontWeight:600}}>
                      <span>🧠</span>
                      <span>{expandedThinking[i]?'Hide Reasoning':"Show TARA's Reasoning"}</span>
                      <span style={{display:'inline-flex',transform:expandedThinking[i]?'rotate(90deg)':'rotate(0deg)',transition:'transform 0.2s'}}>
                        <ChevronRightIcon size={11}/>
                      </span>
                    </button>
                    {expandedThinking[i] && <ThinkingDrawer data={msg.thinking!}/>}
                  </div>
                )}
                {msg.role==='assistant' && msg.content && !(streaming && i===messages.length-1) && (
                  <div style={{display:'flex',gap:1,marginTop:5,paddingLeft:2,width:'fit-content',background:'rgba(34,28,49,0.72)',border:'0.5px solid rgba(215,186,255,0.14)',borderRadius:20,padding:'2px 4px',backdropFilter:'blur(6px)'}}>
                    <button
                      onClick={()=>setFeedback(p=>{const n={...p}; if(n[i]==='up') delete n[i]; else n[i]='up'; return n;})}
                      title={feedback[i]==='up'?'Remove like':'Helpful'}
                      style={{background:'transparent',border:'none',cursor:'pointer',padding:'3px 8px',borderRadius:16,display:'flex',alignItems:'center',color:feedback[i]==='up'?'#4ade80':'var(--c-on-surface-variant)',transition:'color 0.15s'}}>
                      <ThumbsUpIcon size={13}/>
                    </button>
                    <button
                      onClick={()=>{ if(feedback[i]!=='up') setFbModal({open:true,msgIdx:i,category:'',text:'',submitting:false,done:false}); }}
                      title="Not helpful — report issue"
                      style={{background:'transparent',border:'none',cursor:'pointer',padding:'3px 8px',borderRadius:16,display:'flex',alignItems:'center',color:feedback[i]==='down'?'#ef4444':'var(--c-on-surface-variant)',transition:'color 0.15s'}}>
                      <ThumbsDownIcon size={13}/>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {(streaming||visionLoading) && messages[messages.length-1]?.role!=='assistant' && (
            <div className="flex gap-3 animate-slide-in-left" style={{marginBottom:12}}>
              <img src="/kapruka-logo.png" alt="TARA"
                style={{width:28,height:28,borderRadius:'50%',objectFit:'contain',flexShrink:0,background:'var(--c-secondary)',padding:3}}
                onError={e=>{(e.target as HTMLImageElement).style.display='none';}}
              />
              <div className="bubble-tara" style={{padding:'10px 14px'}}><ThinkingPulse/></div>
            </div>
          )}

          {!hasUserMsgs && !reorderDone && lastOrder && lastOrder.items.length>0 && (
            <div className="flex gap-3 animate-slide-in-left" style={{animationDelay:'400ms',marginBottom:12}}>
              <img src="/kapruka-logo.png" alt="TARA"
                style={{width:28,height:28,borderRadius:'50%',objectFit:'contain',flexShrink:0,marginTop:2,background:'var(--c-secondary)',padding:3}}
                onError={e=>{(e.target as HTMLImageElement).style.display='none';}}
              />
              <div className="bubble-tara overflow-hidden" style={{maxWidth:360,borderColor:'rgba(197,205,101,0.35)'}}>
                <div style={{padding:'12px 15px 8px'}}>
                  <p style={{fontSize:14,lineHeight:1.6}}>{s.reorderPrompt}</p>
                  {lastOrder.items[0]?.name && <p className="gradient-text-gold" style={{fontSize:12,fontWeight:700,marginTop:2}}>{lastOrder.items[0].name}{lastOrder.items.length>1?` +${lastOrder.items.length-1} more`:''}</p>}
                </div>
                <div style={{display:'flex',borderTop:'1px solid rgba(74,68,81,0.30)'}}>
                  <button onClick={()=>{lastOrder.items.forEach(i=>addItem({id:i.id,name:i.name,price:i.price,image:i.image},true));setReorderDone(true);setMessages(prev=>[...prev,{role:'assistant',content:s.reorderAdded}]);}}
                    style={{flex:1,padding:'9px',fontSize:12,fontWeight:700,color:'var(--c-secondary)',background:'transparent',cursor:'pointer',transition:'background 0.15s',fontFamily:'var(--font-body)',border:'none'}}>🔄 {s.reorderBtn}</button>
                  <button onClick={()=>setReorderDone(true)} style={{padding:'9px 12px',fontSize:12,borderLeft:'1px solid rgba(74,68,81,0.30)',color:'var(--c-outline)',cursor:'pointer',background:'transparent',border:'none'}}>✕</button>
                </div>
              </div>
            </div>
          )}

          {!hasUserMsgs && !streaming && (
            <div style={{display:'flex',flexWrap:'wrap',gap:8,paddingLeft:40,paddingBottom:8}} className="animate-slide-in-left">
              {s.quickChips.map((chip,idx)=>(
                <button key={chip} onClick={()=>sendMessage(chip, convLang)} className={`action-chip ${chipClasses[idx%chipClasses.length]}`}>{chip}</button>
              ))}
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
      </div>

      {/* Language bar */}
      <div style={{flexShrink:0,padding:'8px 16px',borderTop:'1px solid rgba(74,68,81,0.20)',background:'rgba(21,16,36,0.65)',backdropFilter:'blur(8px)'}}>
        <div style={{maxWidth:760,margin:'0 auto',display:'flex',alignItems:'center',gap:8,overflowX:'auto'}} className="scrollbar-none">
          <GlobeIcon style={{color:'var(--c-outline)',flexShrink:0}}/>
          <div style={{display:'flex',gap:6,flexShrink:0}}>
            {LANG_OPTS.map(o=>(
              <button key={o.key} onClick={()=>{onLangChange(o.key);setConvLang(o.key);convLangRef.current=o.key;}}
                className={`lang-pill${convLang===o.key?' active':''}`}
                style={{transform:convLang===o.key?'scale(1.05)':'scale(1)',whiteSpace:'nowrap'}}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Input bar ── NEW LAYOUT ────────────────────────── */}
      <div style={{flexShrink:0,padding:'10px 16px',paddingBottom:'max(10px,env(safe-area-inset-bottom))',borderTop:'1px solid rgba(74,68,81,0.15)',background:'rgba(21,16,36,0.65)',backdropFilter:'blur(12px)'}}>
        <div style={{maxWidth:760,margin:'0 auto'}}>

          {/* Image preview strip */}
          {pendingImg && (
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,padding:'6px 10px',background:'rgba(44,39,60,0.80)',borderRadius:12,border:'1px solid rgba(215,186,255,0.25)'}}>
              <img src={pendingImg.preview} alt="Preview"
                style={{height:52,width:52,objectFit:'cover',borderRadius:8,border:'1px solid rgba(215,186,255,0.30)',flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:12,fontWeight:600,color:'var(--c-on-surface)'}}>Image ready</p>
                <p style={{fontSize:11,color:'var(--c-on-surface-variant)'}}>Press send to search for this product</p>
              </div>
              <button onClick={()=>setPendingImg(null)} style={{color:'var(--c-outline)',background:'transparent',border:'none',cursor:'pointer',fontSize:18,lineHeight:1}}>✕</button>
            </div>
          )}

          {/* ── Rounded rectangle container ── */}
          <div style={{
            background:'var(--c-surface-container-high)',
            borderRadius:16,
            padding:'8px 12px',
            border:'1px solid rgba(215,186,255,0.15)',
            boxShadow:'0 2px 8px rgba(0,0,0,0.15)',
          }}>
            {/* Textarea at top */}
            <textarea ref={textareaRef} value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={pendingImg ? 'Add a note (optional) or press Send…' : s.chatPlaceholder}
              disabled={streaming||visionLoading}
              rows={1}
              style={{
                width:'100%',
                background:'transparent',
                border:'none',
                outline:'none',
                resize:'none',
                fontSize:15,
                lineHeight:1.5,
                color:'var(--c-on-surface)',
                scrollbarWidth:'none',
                minHeight:24,
                maxHeight:112,
                fontFamily:'var(--font-body)',
                padding:0,
                marginBottom:6,
              }}
            />

            {/* Action row: attach left, mic+send right */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              {/* Hidden file input */}
              <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}}
                onChange={e=>{ const f=e.target.files?.[0]; if(f) handleFileSelect(f); e.target.value=''; }}/>

              <button
                title="Upload or paste an image to search"
                onClick={()=>fileInputRef.current?.click()}
                style={{
                  color:pendingImg?'var(--c-secondary)':'var(--c-on-surface-variant)',
                  cursor:'pointer',
                  background:'transparent',
                  border:'none',
                  padding:'4px 6px',
                  display:'flex',
                  alignItems:'center',
                  transition:'color 0.15s',
                  borderRadius:6,
                }}>
                {pendingImg
                  ? <span style={{fontSize:18}}>🖼️</span>
                  : <AttachIcon />}
              </button>



              <div style={{display:'flex', gap:6, alignItems:'center'}}>
                {micSupported && !pendingImg && (
                  <>
                    {isRecording && <AudioVisualizer analyser={analyserRef.current} />}
                    {isRecording && (
                      <button onClick={stopRecording} title="Finish talking & send now"
                        style={{width:32,height:32,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--c-primary)',color:'var(--c-on-primary)',border:'none',cursor:'pointer'}}>
                        <SendIcon size={14}/>
                      </button>
                    )}
                    <button
                      onClick={() => { if (isSpeaking) { stopSpeaking(); return; } if (isRecording) { cancelRecording(); return; } void startRecording(); }}
                      disabled={streaming || sttSending}
                      title={isRecording ? s.cancelListeningTitle : voiceModeOn ? s.voiceModeStopTitle : s.tapToSpeak}
                      style={{
                        width:32,
                        height:32,
                        borderRadius:'50%',
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        background:isRecording?'#ef4444':isSpeaking?'var(--c-primary-container)':'transparent',
                        color:(isRecording||isSpeaking)?'white':'var(--c-on-surface-variant)',
                        cursor:'pointer',
                        border:'none',
                        position:'relative',
                        transition:'all 0.18s',
                      }}>
                      {isRecording&&<span style={{position:'absolute',inset:0,borderRadius:'50%',background:'rgba(239,68,68,0.4)',animation:'quantum-pulse 1s ease-in-out infinite'}}/>}
                      <MicIcon size={16}/>
                    </button>
                    
                    <button
                      onClick={toggleVoiceMode}
                      title={s.voiceModeTitle}
                      style={{
                        padding:'6px',
                        borderRadius:'50%',
                        border:'none',
                        cursor:'pointer',
                        background:voiceModeOn?'var(--c-primary-container)':'transparent',
                        color:voiceModeOn?'var(--c-on-primary-container)':'var(--c-on-surface-variant)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition:'all 0.18s',
                      }}>
                      {/* Using your new waveform+sparkle icon */}
                      <VoiceSparkleIcon size={16} />
                    </button>
                  </>
                )}

                <button onClick={handleSend}
                  disabled={(!input.trim()&&!pendingImg)||streaming||visionLoading}
                  className="btn-primary"
                  style={{
                    width:32,
                    height:32,
                    borderRadius:'50%',
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    opacity:((!input.trim()&&!pendingImg)||streaming||visionLoading)?0.4:1,
                    boxShadow:(input.trim()||pendingImg)&&!streaming?'0 4px 12px rgba(189,147,249,0.30)':'none',
                    background:((!input.trim()&&!pendingImg)||streaming||visionLoading)?'var(--c-surface-container-low)':'var(--c-primary)',
                    color:'var(--c-on-primary)',
                    border:'none',
                    cursor:((!input.trim()&&!pendingImg)||streaming||visionLoading)?'default':'pointer',
                    transition:'all 0.15s',
                  }}>
                  <SendIcon size={16}/>
                </button>
              </div>
            </div>
          </div>

          <p style={{textAlign:'center',fontSize:10,color:'var(--c-outline)',marginTop:5,letterSpacing:'0.08em',textTransform:'uppercase',fontWeight:700}}>
            {isRecording?<span style={{color:'#ef4444'}}>{s.listeningStatus}</span>:sttSending?<span style={{color:'var(--c-primary)'}}>{s.transcribingStatus}</span>:isPreparingSpeech?<span style={{color:'var(--c-primary)'}}>{s.preparingSpeechStatus}</span>:isSpeaking?<span style={{color:'var(--c-primary)'}}>{s.speakingStatus}</span>:visionLoading?<span style={{color:'var(--c-primary)'}}>✦ Analysing image…</span>:'Paste image or Shift+Enter for new line • TARA Protocol'}
          </p>
        </div>
      </div>

      {/* ── Feedback modal ──────────────────────────────────── */}
      {fbModal?.open && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
          onClick={e=>{if(e.target===e.currentTarget)setFbModal(null);}}>
          <div style={{background:'var(--c-surface-container)',borderRadius:20,padding:22,width:'100%',maxWidth:420,border:'1px solid rgba(215,186,255,0.20)',boxShadow:'0 24px 60px rgba(0,0,0,0.55)'}}>
            {fbModal.done
              ? <div style={{textAlign:'center',padding:'20px 0'}}>
                  <span style={{fontSize:32}}>✅</span>
                  <p style={{marginTop:10,color:'var(--c-on-surface)',fontSize:15,fontWeight:700}}>Thanks for the feedback!</p>
                  <p style={{fontSize:12,color:'var(--c-on-surface-variant)',marginTop:5}}>Sent to <code style={{background:'rgba(215,186,255,0.12)',padding:'1px 6px',borderRadius:4}}>issue</code> for the dev team for review.</p>
                </div>
              : <>
                  <p style={{fontSize:15,fontWeight:700,color:'var(--c-on-surface)',marginBottom:14}}>What went wrong? 🐛</p>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:14}}>
                    {['Wrong products','Wrong language',"Didn't understand",'Delivery info wrong','Error Message','Too slow','Other'].map(cat=>(
                      <button key={cat} onClick={()=>setFbModal(p=>p?{...p,category:cat}:p)}
                        style={{padding:'4px 12px',borderRadius:20,fontSize:12,cursor:'pointer',border:'none',fontFamily:'var(--font-body)',transition:'all 0.15s',
                          background:fbModal.category===cat?'var(--c-primary-container)':'var(--c-surface-container-high)',
                          color:fbModal.category===cat?'var(--c-on-primary-container)':'var(--c-on-surface-variant)',
                          fontWeight:fbModal.category===cat?600:400}}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  <textarea value={fbModal.text} onChange={e=>setFbModal(p=>p?{...p,text:e.target.value}:p)}
                    placeholder="Describe the issue (optional)…" rows={3}
                    style={{width:'100%',background:'var(--c-surface-container-high)',border:'1px solid rgba(215,186,255,0.20)',borderRadius:10,padding:'10px 12px',fontSize:13,color:'var(--c-on-surface)',resize:'none',fontFamily:'var(--font-body)',outline:'none',boxSizing:'border-box'}}/>
                  <div style={{display:'flex',gap:8,marginTop:12,justifyContent:'flex-end'}}>
                    <button onClick={()=>setFbModal(null)}
                      style={{padding:'8px 16px',borderRadius:8,fontSize:13,cursor:'pointer',background:'transparent',color:'var(--c-outline)',border:'1px solid rgba(150,142,156,0.30)',fontFamily:'var(--font-body)'}}>
                      Cancel
                    </button>
                    <button
                      disabled={fbModal.submitting||(!fbModal.category&&!fbModal.text.trim())}
                      onClick={async()=>{
                        setFbModal(p=>p?{...p,submitting:true}:p);
                        const ctx = messages.slice(Math.max(0,fbModal.msgIdx-3), fbModal.msgIdx+1);
                        await fetch('/api/feedback',{
                          method:'POST', headers:{'Content-Type':'application/json'},
                          body: JSON.stringify({
                            category: fbModal.category, issue: fbModal.text,
                            response: messages[fbModal.msgIdx]?.content ?? '',
                            context: ctx, lang: convLang,
                            timestamp: new Date().toISOString(),
                          }),
                        }).catch(()=>{});
                        setFeedback(p=>({...p,[fbModal.msgIdx]:'down'}));
                        setFbModal(p=>p?{...p,submitting:false,done:true}:p);
                        setTimeout(()=>setFbModal(null),2200);
                      }}
                      style={{padding:'8px 18px',borderRadius:8,fontSize:13,cursor:'pointer',background:'var(--c-primary-container)',color:'var(--c-on-primary-container)',border:'none',fontFamily:'var(--font-body)',fontWeight:600,
                        opacity:fbModal.submitting||(!fbModal.category&&!fbModal.text.trim())?0.45:1}}>
                      {fbModal.submitting?'Saving…':'Send Report'}
                    </button>
                  </div>
                </>
            }
          </div>
        </div>
      )}

      {modalId && <ProductModalWrapper productId={modalId} productUrl={modalUrl} lang={lang} fallbackProduct={modalProduct} onClose={()=>{setModalId(null);setModalUrl('');setModalProduct(null);}}/>}
    </div>
  );
}

function ProductModalWrapper({productId,productUrl,lang,fallbackProduct,onClose}:{productId:string;productUrl:string;lang:Lang;fallbackProduct:Product|null;onClose:()=>void}) {
  const [Comp,setComp]=useState<React.ComponentType<{productId:string;productUrl:string;lang:Lang;onClose:()=>void;fallbackProduct?:Product|null}>|null>(null);
  useEffect(()=>{import('./ProductModal').then(m=>setComp(()=>m.default));},[]);
  if (!Comp) return null;
  return <Comp productId={productId} productUrl={productUrl} lang={lang} onClose={onClose} fallbackProduct={fallbackProduct}/>;
}