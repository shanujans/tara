'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useCart } from '@/context/CartContext';
import { Lang, STRINGS } from '@/lib/strings';
import type { DeliveryOption } from '@/lib/mcp';
import InvoiceTemplate, { type InvoiceData } from './InvoiceTemplate';

const PLACEHOLDER = 'https://placehold.co/48x48/110b2e/6b4dab?text=?';
const OCCASIONS = ['Birthday','Anniversary','Wedding','New Baby','Get Well','Thank You','Festival','Just Because'];
const PICKUP_LOCATIONS = [
  { id: 'mirihana', name: 'Kapruka — Mirihana',        hours: '8 AM – 11 PM',  address: 'Mirihana, Nugegoda' },
  { id: 'barnes',   name: 'Java Lounge — Barnes Place', hours: '10 AM – 11 PM', address: 'Barnes Place, Colombo 7' },
  { id: 'kandy',    name: 'Java Lounge — Kandy',        hours: '10 AM – 11 PM', address: 'Kandy City Centre' },
  { id: 'fort',     name: 'Java Lounge — Fort',         hours: '10 AM – 11 PM', address: '7 Hospital St, Colombo 01' },
] as const;
type PickupId = typeof PICKUP_LOCATIONS[number]['id'];

interface CartDrawerProps { open: boolean; onClose: () => void; lang: Lang; }
interface CityOption { name: string; id?: string; }
interface DeliveryInfo {
  available: boolean; options?: DeliveryOption[];
  fee?: number; delivery_fee?: number; eta?: string; message?: string;
}
const GIFT_PH: Record<Lang, string> = {
  en: 'Write a gift message...', si: 'Gift message liyanawa...',
  sl: 'Gift message ekak liyanna...', ta: 'Gift message...',  tl: 'Gift message liyanna machang...',
};
function fmt(n: number) { return n.toLocaleString('si-LK'); }

// Shared glass input style applied via className
const inp = 'cart-input';

export default function CartDrawer({ open, onClose, lang }: CartDrawerProps) {
  const { items, removeItem, updateQty, total, clearCart,
          giftMessage, setGiftMessage, deliveryDate, setDeliveryDate,
          district, setDistrict,
          recipientName, setRecipientName,
          recipientPhone, setRecipientPhone,
          addressLine1, setAddressLine1,
          occasion, setOccasion,
          senderName, setSenderName,
          senderEmail, setSenderEmail,
          locationType, setLocationType,
          specialInstructions, setSpecialInstructions,
        } = useCart();
  const s = STRINGS[lang];
  const [mode,           setMode]           = useState<'guest'|'signin'>('guest');
  const [orderPurpose,   setOrderPurpose]   = useState<'gift'|'self'|'pickup'>('gift');
  const [pickupLocation, setPickupLocation] = useState<PickupId>('mirihana');
  const [addressLine2,   setAddressLine2]   = useState('');
  const [voucherCode,    setVoucherCode]    = useState('');
  const [cityInput,      setCityInput]      = useState('');
  const [citySuggestions,setCitySuggestions]= useState<CityOption[]>([]);
  const [showCitySug,    setShowCitySug]    = useState(false);
  const [cityLoading,    setCityLoading]    = useState(false);
  const [deliveryInfo,   setDeliveryInfo]   = useState<DeliveryInfo | null>(null);
  const [deliveryChecking,setDeliveryChecking]=useState(false);
  const [selectedType,   setSelectedType]   = useState<'express'|'standard'>('express');
  const [genLoading,     setGenLoading]     = useState(false);
  const [checkLoading,   setCheckLoading]   = useState(false);
  const [orderId,        setOrderId]        = useState('');
  const [checkoutUrl,    setCheckoutUrl]    = useState('');
  const [orderTime,      setOrderTime]      = useState('');
  const [error,          setError]          = useState('');
  /* Invoice PDF state */
  const [invoiceSnap,  setInvoiceSnap]  = useState<InvoiceData | null>(null);
  const [pendingPdf,   setPendingPdf]   = useState<InvoiceData | null>(null);
  const [pdfLoading,   setPdfLoading]   = useState(false);
  const [pdfAction,    setPdfAction]    = useState<'download' | 'share'>('download'); // NEW
  const invoiceRef  = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Invoice PDF generation ────────────────────────────────────────────── */
  // Runs after React commits the hidden InvoiceTemplate to the DOM
  useEffect(() => {
    if (!pendingPdf || !invoiceRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        // Small pause — ensures the browser has painted the hidden template
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
        // Add transparent clickable link over the CTA section (bottom ~28% of page)
        if (pendingPdf.checkoutUrl) {
          const linkTop = pxH * 0.72;
          pdf.link(20, linkTop, pxW - 40, pxH - linkTop - 40, { url: pendingPdf.checkoutUrl });
        }
        // ── NEW: share or download based on pdfAction ──────────────────────
        if (pdfAction === 'share') {
          const blob = pdf.output('blob');
          const file = new File(
            [blob],
            `kapruka-order-${pendingPdf.orderId}.pdf`,
            { type: 'application/pdf' }
          );
          try {
            if (navigator.canShare?.({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: `Kapruka Order ${pendingPdf.orderId}`,
                text: 'Your Kapruka order details — tap to open or forward.',
              });
            } else {
              pdf.save(`kapruka-order-${pendingPdf.orderId}.pdf`);
            }
          } catch (shareError) {
            console.warn('Share failed, falling back to download:', shareError);
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
  }, [pendingPdf, pdfAction]); // added pdfAction dependency

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const maxDate  = new Date(); maxDate.setDate(maxDate.getDate() + 30);
  const toISO    = (d: Date) => d.toISOString().split('T')[0];
  const activeOption: DeliveryOption | undefined =
    deliveryInfo?.options?.find(o => o.type === selectedType) ?? deliveryInfo?.options?.[0];
  const deliveryFee: number | undefined = orderPurpose === 'pickup' ? 0
    : (activeOption?.fee ?? deliveryInfo?.fee ?? deliveryInfo?.delivery_fee);
  const feeKnown   = deliveryFee !== undefined;
  const grandTotal = total + (deliveryFee ?? 0);

  const searchCities = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setCitySuggestions([]); setShowCitySug(false); return; }
    debounceRef.current = setTimeout(async () => {
      setCityLoading(true);
      try {
        const r = await fetch('/api/cities', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, limit: 8 }),
        });
        const d = await r.json();
        setCitySuggestions(d.cities ?? []); setShowCitySug(true);
      } catch { setCitySuggestions([]); } finally { setCityLoading(false); }
    }, 400);
  }, []);

  const handleCityInput = (val: string) => {
    setCityInput(val);
    if (!val) { setDistrict(''); setDeliveryInfo(null); }
    searchCities(val);
  };
  const selectCity = (c: CityOption) => {
    setCityInput(c.name); setDistrict(c.name);
    setShowCitySug(false); setCitySuggestions([]);
  };

  useEffect(() => {
    if (!district || !deliveryDate) { setDeliveryInfo(null); return; }
    let cancelled = false;
    setDeliveryChecking(true);
    const pid = items[0]?.id;
    fetch('/api/delivery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: district, delivery_date: deliveryDate, ...(pid ? { product_id: pid } : {}) }),
    })
      .then(r => r.json())
      .then(d  => { if (!cancelled) { setDeliveryInfo(d); setSelectedType('express'); }})
      .catch(()=> { if (!cancelled) setDeliveryInfo({ available: false, message: 'Could not check delivery.' }); })
      .finally(()=> { if (!cancelled) setDeliveryChecking(false); });
    return () => { cancelled = true; };
  }, [district, deliveryDate, items]);

  const generateMessage = async () => {
    setGenLoading(true);
    try {
      const r = await fetch('/api/gift-message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occasion, lang, items }),
      });
      const { message } = await r.json();
      setGiftMessage(message);
    } finally { setGenLoading(false); }
  };

  const handleCheckout = async () => {
    setError('');
    if (orderPurpose !== 'pickup') {
      if (!district)     { setError('Please select a delivery city.'); return; }
      if (!deliveryDate) { setError('Please select a delivery date.'); return; }
      if (deliveryInfo && !deliveryInfo.available) { setError(s.deliveryUnavailable); return; }
    }
    if (!recipientName.trim())  { setError('Please enter recipient name.'); return; }
    if (!recipientPhone.trim()) { setError('Please enter recipient phone.'); return; }
    if (orderPurpose !== 'pickup' && !addressLine1.trim()) { setError('Please enter delivery address.'); return; }
    setCheckLoading(true);
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items, giftMessage, deliveryDate, district, total: grandTotal,
          deliveryFee, orderPurpose,
          deliveryType: orderPurpose === 'pickup' ? 'pickup' : (activeOption?.type ?? 'standard'),
          pickupLocation: orderPurpose === 'pickup'
            ? PICKUP_LOCATIONS.find(l => l.id === pickupLocation)?.name : undefined,
          recipient: {
            name:  recipientName.trim(), phone: recipientPhone.trim(),
            address: orderPurpose === 'pickup'
              ? (PICKUP_LOCATIONS.find(l => l.id === pickupLocation)?.address ?? 'Pickup')
              : `${addressLine1.trim()}${addressLine2.trim() ? ', ' + addressLine2.trim() : ''}`,
          },
          sender: { name: senderName.trim() || 'Guest', email: senderEmail.trim() || undefined },
          locationType, specialInstructions: specialInstructions.trim() || undefined,
          voucherCode: voucherCode.trim() || undefined,
        }),
      });
      const data = await r.json();
      if (data.success) {
        try {
          const start = localStorage.getItem('tara_session_start');
          if (start) {
            const ms = Date.now() - parseInt(start, 10);
            if (ms > 0 && ms < 30 * 60 * 1000) {
              const m = Math.floor(ms / 60000), ss = Math.floor((ms % 60000) / 1000);
              setOrderTime(`${m}:${String(ss).padStart(2, '0')}`);
            }
            localStorage.removeItem('tara_session_start');
          }
        } catch { /* */ }
        try {
          // Generate a readable order ID if MCP returns empty/generic
          const rawId = data.orderId;
          const orderId = (!rawId || rawId === 'ORDER')
            ? `ORDERMCP${Date.now().toString().slice(-6)}`
            : rawId;

          const entry = {
            order_id: orderId,
            items: items.map(i => ({ id: i.id, name: i.name, price: i.price, image: i.image || PLACEHOLDER })),
            date: new Date().toISOString(),
            city: district,
            recipient: recipientName,
          };

          // Maintain full history array (most recent first, cap at 20)
          let history: typeof entry[] = [];
          try { history = JSON.parse(localStorage.getItem('tara_order_history') ?? '[]'); } catch { /* */ }
          history = [entry, ...history].slice(0, 20);
          localStorage.setItem('tara_order_history', JSON.stringify(history));
          // Keep last-order key for reorder feature in ChatPanel
          localStorage.setItem('tara_last_order', JSON.stringify(entry));
          // Generate QR code for the payment URL (requires: npm install qrcode @types/qrcode)
          let qrCode: string | undefined;
          if (data.checkoutUrl) {
            try {
              const QRCode = (await import('qrcode')).default;
              qrCode = await QRCode.toDataURL(data.checkoutUrl, {
                width: 150, margin: 1,
                color: { dark: '#422B75', light: '#FFFFFF' },
              });
            } catch { /* qrcode not installed — skip */ }
          }

          // Capture all invoice fields BEFORE clearCart() wipes context values
          setInvoiceSnap({
            state:          'unpaid',
            orderId,
            orderDate:      new Date().toISOString(),
            checkoutUrl:    data.checkoutUrl,
            qrCode,
            items:          items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, image: i.image })),
            recipientName:  recipientName.trim(),
            recipientPhone: recipientPhone.trim(),
            address:        `${addressLine1.trim()}${addressLine2.trim() ? ', ' + addressLine2.trim() : ''}`,
            city:           district,
            deliveryDate,
            deliveryFee,
            grandTotal,
            occasion,
            giftMessage,
            specialInstructions: specialInstructions.trim() || undefined,
            senderName:     senderName.trim() || 'Guest',
            senderEmail:    senderEmail.trim() || undefined,
          });
          setOrderId(orderId);
        } catch { /* */ }
        setCheckoutUrl(data.checkoutUrl);
        clearCart();
      } else {
        setError(data.error ?? 'Checkout failed.');
      }
    } finally { setCheckLoading(false); }
  };

  // ── Spinner node ─────────────────────────────────────────────────────────
  const Spinner = (
    <span className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
      style={{ borderColor: '#6b4dab', borderTopColor: 'transparent' }} />
  );

  return (
    <>
      {/* Hidden invoice render target — captured by html2canvas, never visible to user */}
      <div style={{ position: 'fixed', left: -9999, top: 0, opacity: 0, pointerEvents: 'none', zIndex: -1 }}>
        <div ref={invoiceRef}>
          {pendingPdf && <InvoiceTemplate data={pendingPdf} />}
        </div>
      </div>

      {/* Backdrop */}
      <div onClick={onClose}
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(5,3,15,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full z-50 flex flex-col shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: 320, maxWidth: '100%' }}
      >
        {/* Glass drawer panel */}
        <div className="glass-modal flex flex-col h-full">

          {/* ── Header ───────────────────────────────────────── */}
          <div className="flex-shrink-0" style={{ borderBottom: '1px solid var(--t-border)' }}>
            <div className="flex items-center justify-between px-5 py-3.5">
              <h2 className="font-bold text-base" style={{ color: 'var(--t-text-1)' }}>
                🛒 {s.cartTitle}
              </h2>
              <button onClick={onClose}
                className="text-lg transition-colors"
                style={{ color: 'var(--t-text-3)' }}
                onMouseOver={e => (e.currentTarget.style.color = 'var(--t-text-1)')}
                onMouseOut={e => (e.currentTarget.style.color = 'var(--t-text-3)')}>
                ✕
              </button>
            </div>

            {/* Guest / Sign-in tabs */}
            <div className="flex" style={{ borderTop: '1px solid var(--t-border)' }}>
              {(['guest','signin'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className="flex-1 py-2.5 text-xs font-semibold transition-all"
                  style={mode === m ? {
                    color: '#c7abff',
                    borderBottom: '2px solid',
                    borderImage: 'linear-gradient(90deg,#402970,#6b4dab) 1',
                    background: 'rgba(64,41,112,0.15)',
                  } : { color: 'var(--t-text-4)', borderBottom: '2px solid transparent' }}
                >
                  {m === 'guest' ? '👤 Guest Checkout' : '🔑 Sign In'}
                </button>
              ))}
            </div>
          </div>

          {/* ── Sign-in panel ──────────────────────────────── */}
          {mode === 'signin' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                style={{ background: 'rgba(64,41,112,0.20)', border: '1px solid rgba(107,77,171,0.40)' }}>
                🔑
              </div>
              <div>
                <p className="font-bold text-base" style={{ color: 'var(--t-text-1)' }}>Sign in to Kapruka</p>
                <p className="text-sm leading-relaxed mt-1" style={{ color: 'var(--t-text-3)' }}>
                  Access your saved addresses, order history and loyalty rewards.
                </p>
              </div>
              <a href="https://www.kapruka.com/shops/customerAccounts/accountLogin.jsp"
                target="_blank" rel="noopener noreferrer"
                className="btn-gold w-full py-3 rounded-xl text-sm text-center block"
                style={{ color: '#3A3A3C' }}>
                Continue on Kapruka.com →
              </a>
              <p className="text-xs" style={{ color: 'var(--t-text-4)' }}>
                You'll complete checkout on Kapruka's secure site.
              </p>
              <button onClick={() => setMode('guest')}
                className="text-xs underline underline-offset-2 transition-colors"
                style={{ color: 'var(--t-text-3)' }}>
                Or continue as guest
              </button>
            </div>
          )}

          {/* ── Success ────────────────────────────────────── */}
          {mode === 'guest' && orderId && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)' }}>
                ✓
              </div>
              <div>
                <p className="font-bold text-base" style={{ color: '#4ade80' }}>TARA sorted everything! 🎉</p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--t-text-3)' }}>
                  Ref: <span className="font-mono" style={{ color: 'var(--t-text-1)' }}>{orderId}</span>
                </p>
              </div>

              {orderTime && (
                <div className="w-full rounded-xl px-4 py-3"
                  style={{ background: 'rgba(250,229,85,0.08)', border: '1px solid rgba(250,229,85,0.25)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--t-gold)' }}>
                    {s.orderSpeedPrefix} <span className="text-base" style={{ color: 'var(--t-text-1)' }}>{orderTime}</span>{' '}
                    {s.orderSpeedSuffix}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--t-text-4)' }}>
                    Kapruka's traditional flow takes ~7 minutes
                  </p>
                </div>
              )}

              {checkoutUrl && (
                <div className="w-full">
                  <a href={checkoutUrl} target="_blank" rel="noopener noreferrer"
                    className="btn-gold w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 text-center block"
                    style={{ color: '#3A3A3C' }}>
                    🔒 Complete Payment on Kapruka →
                  </a>
                  <p className="text-xs mt-2" style={{ color: 'var(--t-text-4)' }}>
                    Secure checkout · ~30 seconds · Cash on delivery available
                  </p>
                </div>
              )}

              {/* Download Order Info (unpaid invoice PDF) */}
              {invoiceSnap && (
                <div className="w-full space-y-2">
                  <button
                    onClick={() => {
                      if (!invoiceSnap) return;
                      setPdfAction('download');
                      setPdfLoading(true);
                      // Auto-generate gift card, then trigger PDF
                      (async () => {
                        let giftCardImage: string | undefined;
                        try {
                          const r = await fetch('/api/generate-gift-card', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              occasion:  invoiceSnap.occasion  ?? '',
                              recipient: invoiceSnap.recipientName ?? '',
                            }),
                          });
                          if (r.ok) {
                            const d = await r.json() as { image?: string };
                            if (d.image) giftCardImage = d.image;
                          }
                        } catch { /* PDF still generates — gift card slot shows placeholder */ }
                        setPendingPdf({ ...invoiceSnap, giftCardImage });
                      })();
                    }}
                    disabled={pdfLoading}
                    className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: 'rgba(64,41,112,0.15)',
                      border: '1px solid rgba(107,77,171,0.40)',
                      color: pdfLoading ? 'var(--t-text-4)' : '#c7abff',
                      cursor: pdfLoading ? 'not-allowed' : 'pointer',
                      opacity: pdfLoading ? 0.7 : 1,
                      fontFamily: 'var(--font-body)',
                    }}>
                    {pdfLoading && pdfAction === 'download' ? '⏳ Generating PDF…' : '📄 Download Order Info'}
                  </button>

                  {/* Share Order Info (Web Share API) */}
                  <button
                    onClick={() => {
                      if (!invoiceSnap) return;
                      setPdfAction('share');
                      setPdfLoading(true);
                      // Same gift card generation for share
                      (async () => {
                        let giftCardImage: string | undefined;
                        try {
                          const r = await fetch('/api/generate-gift-card', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              occasion:  invoiceSnap.occasion  ?? '',
                              recipient: invoiceSnap.recipientName ?? '',
                            }),
                          });
                          if (r.ok) {
                            const d = await r.json() as { image?: string };
                            if (d.image) giftCardImage = d.image;
                          }
                        } catch { /* */ }
                        setPendingPdf({ ...invoiceSnap, giftCardImage });
                      })();
                    }}
                    disabled={pdfLoading}
                    className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: 'rgba(64,41,112,0.15)',
                      border: '1px solid rgba(107,77,171,0.40)',
                      color: pdfLoading ? 'var(--t-text-4)' : '#c7abff',
                      cursor: pdfLoading ? 'not-allowed' : 'pointer',
                      opacity: pdfLoading ? 0.7 : 1,
                      fontFamily: 'var(--font-body)',
                    }}>
                    {pdfLoading && pdfAction === 'share' ? '⏳ Preparing…' : '↗ Share Order Info'}
                  </button>
                </div>
              )}

              <button onClick={() => { setOrderId(''); setCheckoutUrl(''); setOrderTime(''); setInvoiceSnap(null); onClose(); }}
                className="text-xs transition-colors"
                style={{ color: 'var(--t-text-3)' }}>
                Continue Shopping
              </button>
            </div>
          )}

          {/* ── Guest checkout form ────────────────────────── */}
          {mode === 'guest' && !orderId && (
            <div className="flex-1 overflow-y-auto">

              {/* Order purpose */}
              <div className="px-4 pt-4 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2.5"
                  style={{ color: 'var(--t-text-3)' }}>
                  This order is…
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'gift',   icon: '🎁', label: "It's a gift" },
                    { key: 'self',   icon: '👤', label: "It's for me" },
                    { key: 'pickup', icon: '📍', label: 'I will pickup' },
                  ] as const).map(opt => (
                    <button key={opt.key} onClick={() => setOrderPurpose(opt.key)}
                      className={`order-type-btn${orderPurpose === opt.key ? ' active' : ''}`}>
                      <span style={{ fontSize: '1.2rem' }}>{opt.icon}</span>
                      <span className="text-center leading-tight">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pickup locations */}
              {orderPurpose === 'pickup' && (
                <div className="px-4 py-2 space-y-1.5">
                  <p className="text-xs mb-2" style={{ color: 'var(--t-text-4)' }}>
                    Pick a convenient location — open every day:
                  </p>
                  {PICKUP_LOCATIONS.map(loc => (
                    <button key={loc.id} onClick={() => setPickupLocation(loc.id)}
                      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                      style={pickupLocation === loc.id ? {
                        border: '1px solid rgba(107,77,171,0.60)',
                        background: 'rgba(64,41,112,0.20)',
                      } : {
                        border: '1px solid var(--t-border)',
                        background: 'rgba(17,11,46,0.50)',
                      }}>
                      <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
                        style={{ borderColor: pickupLocation === loc.id ? '#6b4dab' : 'var(--t-text-4)' }}>
                        {pickupLocation === loc.id && (
                          <div className="w-2 h-2 rounded-full" style={{ background: '#6b4dab' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--t-text-1)' }}>{loc.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-4)' }}>{loc.address}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#4ade80' }}>🕐 {loc.hours}</p>
                      </div>
                    </button>
                  ))}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl mt-2"
                    style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
                    <span style={{ color: '#4ade80' }}>✓</span>
                    <span className="text-xs font-bold" style={{ color: '#4ade80' }}>FREE — No delivery charges</span>
                  </div>
                </div>
              )}

              {/* Cart items */}
              <div className="px-4 py-3 space-y-2.5">
                {items.length === 0
                  ? <p className="text-sm text-center py-8" style={{ color: 'var(--t-text-4)' }}>{s.cartEmpty}</p>
                  : items.map(item => (
                    <div key={item.id} className="flex gap-2.5 rounded-xl p-2.5"
                      style={{ background: 'rgba(26,18,58,0.70)', border: '1px solid var(--t-border)' }}>
                      <img src={item.image || PLACEHOLDER} alt={item.name} loading="lazy"
                        className="w-11 h-11 aspect-square object-cover rounded-lg flex-shrink-0"
                        style={{ background: 'var(--t-surface)' }}
                        onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium line-clamp-2 leading-snug"
                          style={{ color: 'var(--t-text-1)' }}>{item.name}</p>
                        <p className="text-sm font-bold mt-0.5 product-price">
                          Rs. {fmt(item.price * item.qty)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {[
                            { label: '−', action: () => updateQty(item.id, item.qty - 1) },
                            { label: '+', action: () => updateQty(item.id, item.qty + 1) },
                          ].map((b, bi) => (
                            <button key={bi} onClick={b.action}
                              className="flex items-center justify-center rounded text-xs transition-all"
                              style={{ width: 20, height: 20, background: 'rgba(64,41,112,0.35)', border: '1px solid var(--t-border)', color: 'var(--t-text-1)' }}>
                              {b.label}
                            </button>
                          ))}
                          <span className="text-xs text-center" style={{ width: 16, color: 'var(--t-text-2)' }}>{item.qty}</span>
                        </div>
                      </div>
                      <button onClick={() => removeItem(item.id)}
                        className="text-xs self-start pt-0.5 transition-colors"
                        style={{ color: 'var(--t-text-4)' }}
                        onMouseOver={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseOut={e => (e.currentTarget.style.color = 'var(--t-text-4)')}>
                        🗑
                      </button>
                    </div>
                  ))
                }
              </div>

              {items.length > 0 && (
                <div className="px-4 pb-6 space-y-4">

                  {/* Occasion */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2"
                      style={{ color: 'var(--t-text-3)' }}>✦ Occasion</p>
                    <div className="flex flex-wrap gap-1.5">
                      {OCCASIONS.map(o => (
                        <button key={o} onClick={() => setOccasion(occasion === o ? '' : o)}
                          className="text-xs px-2.5 py-1 rounded-full transition-all"
                          style={occasion === o ? {
                            background: 'var(--t-grad-gold)',
                            color: '#3A3A3C',
                            fontWeight: 700,
                            border: '1px solid transparent',
                          } : {
                            border: '1px solid var(--t-border)',
                            color: 'var(--t-text-3)',
                          }}>
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Gift message */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--t-text-3)' }}>Gift Message</p>
                      <button onClick={generateMessage} disabled={genLoading}
                        className="text-xs transition-colors"
                        style={{ color: genLoading ? 'var(--t-text-4)' : 'var(--t-gold)' }}>
                        {genLoading ? 'Generating…' : '✦ AI Generate'}
                      </button>
                    </div>
                    <textarea value={giftMessage} onChange={e => setGiftMessage(e.target.value)}
                      placeholder={GIFT_PH[lang]} rows={3}
                      className={`${inp} resize-none`} />
                    <p className="text-xs mt-1 flex items-start gap-1"
                      style={{ color: 'rgba(250,229,85,0.60)' }}>
                      <span>⚠️</span>
                      <span>Write in English / Singlish / Tanglish  — Tamil/Sinhala script won't display on Kapruka.</span>
                    </p>
                  </div>

                  {/* Recipient */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2"
                      style={{ color: 'var(--t-text-3)' }}>{s.recipientSection}</p>
                    <div className="space-y-2">
                      <input value={recipientName}  onChange={e => setRecipientName(e.target.value)}  placeholder={s.fullName}  className={inp} />
                      <input value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} placeholder={s.phone} type="tel" className={inp} />
                      <input value={senderName}     onChange={e => setSenderName(e.target.value)}     placeholder="Your name (sender)" className={inp} />
                      <input value={senderEmail}    onChange={e => setSenderEmail(e.target.value)}    placeholder="Your email (optional)" type="email" className={inp} />
                      <input value={addressLine1}   onChange={e => setAddressLine1(e.target.value)}   placeholder={s.addressLine1} className={inp} />
                      <input value={addressLine2}   onChange={e => setAddressLine2(e.target.value)}   placeholder={s.addressLine2} className={inp} />
                      <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--t-text-4)' }}>Location Type</p>
                        <select value={locationType} onChange={e => setLocationType(e.target.value)}
                          className={inp}
                          style={{ appearance: 'none', WebkitAppearance: 'none' }}>
                          {[
                            { value: 'HOUSE OR RESIDENCE',       label: 'House / Residence' },
                            { value: 'APARTMENT',                label: 'Apartment' },
                            { value: 'OFFICE',                   label: 'Office' },
                            { value: 'OTHER (INCLUDING HOTELS)', label: 'Other (Hotels, Hospitals...)' },
                          ].map(lt => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--t-text-4)' }}>
                          Special Instructions <span style={{ color: 'var(--t-text-5)', fontWeight: 400 }}>(optional)</span>
                        </p>
                        <textarea
                          value={specialInstructions}
                          onChange={e => setSpecialInstructions(e.target.value)}
                          placeholder="e.g. Leave at the gate, call before delivery…"
                          rows={2}
                          maxLength={250}
                          className={inp}
                          style={{ resize: 'none', lineHeight: 1.5 }}
                        />
                        {specialInstructions.length > 200 && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-4)' }}>
                            {250 - specialInstructions.length} chars remaining
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Delivery date */}
                  {orderPurpose !== 'pickup' && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5"
                        style={{ color: 'var(--t-text-3)' }}>{s.deliveryDate}</p>
                      <input type="date" value={deliveryDate}
                        min={toISO(tomorrow)} max={toISO(maxDate)}
                        onChange={e => setDeliveryDate(e.target.value)}
                        className={inp}
                        style={{ colorScheme: 'dark' }} />
                      {deliveryDate && (
                        <p className="text-xs mt-1" style={{ color: 'var(--t-text-4)' }}>
                          {new Date(deliveryDate).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}
                        </p>
                      )}
                    </div>
                  )}

                  {/* City autocomplete */}
                  {orderPurpose !== 'pickup' && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5"
                        style={{ color: 'var(--t-text-3)' }}>{s.deliveryCity}</p>
                      <div className="relative">
                        <input type="text" value={cityInput}
                          onChange={e => handleCityInput(e.target.value)}
                          onFocus={() => cityInput.length >= 2 && setShowCitySug(true)}
                          onBlur={() => setTimeout(() => setShowCitySug(false), 200)}
                          placeholder={s.deliveryCityPlaceholder}
                          className={`${inp} pr-7`} />
                        {cityLoading && (
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                            {Spinner}
                          </span>
                        )}
                        {showCitySug && citySuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 rounded-xl shadow-xl z-20 overflow-hidden max-h-36 overflow-y-auto"
                            style={{ background: 'var(--t-raised)', border: '1px solid var(--t-border-bright)' }}>
                            {citySuggestions.map((c, i) => (
                              <button key={c.id ?? i} onMouseDown={() => selectCity(c)}
                                className="w-full text-left px-3 py-2 text-xs transition-colors"
                                style={{ color: 'var(--t-text-2)' }}
                                onMouseOver={e => (e.currentTarget.style.background = 'rgba(64,41,112,0.25)')}
                                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                                {c.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Delivery checking spinner */}
                  {orderPurpose !== 'pickup' && deliveryChecking && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--t-text-3)' }}>
                      {Spinner} Checking delivery options…
                    </div>
                  )}

                  {/* Delivery options */}
                  {orderPurpose !== 'pickup' && !deliveryChecking && deliveryInfo && (
                    <>
                      {deliveryInfo.available ? (
                        <div className="rounded-xl overflow-hidden"
                          style={{ border: '1px solid var(--t-border)', background: 'rgba(26,18,58,0.60)' }}>
                          <p className="text-xs font-semibold px-3.5 pt-3 pb-2"
                            style={{ color: 'var(--t-text-3)' }}>
                            📦 Delivery Options to <span style={{ color: 'var(--t-text-1)' }}>{district}</span>
                          </p>
                          {deliveryInfo.options && deliveryInfo.options.length > 0
                            ? deliveryInfo.options.map(opt => (
                              <button key={opt.type} onClick={() => setSelectedType(opt.type)}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors"
                                style={{
                                  borderTop: '1px solid var(--t-border)',
                                  background: selectedType === opt.type ? 'rgba(64,41,112,0.20)' : 'transparent',
                                }}>
                                <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                                  style={{ borderColor: selectedType === opt.type ? '#6b4dab' : 'var(--t-text-4)' }}>
                                  {selectedType === opt.type && (
                                    <div className="w-2 h-2 rounded-full" style={{ background: '#6b4dab' }} />
                                  )}
                                </div>
                                <span className="flex-1 text-xs leading-snug"
                                  style={{ color: 'var(--t-text-2)' }}>{opt.label}</span>
                                <span className="text-xs font-bold flex-shrink-0"
                                  style={{ color: selectedType === opt.type ? '#c7abff' : 'var(--t-text-3)' }}>
                                  Rs. {fmt(opt.fee)}
                                </span>
                              </button>
                            ))
                            : (
                              <div className="px-3.5 pb-3 text-xs font-semibold"
                                style={{ color: '#4ade80' }}>
                                ✓ {s.deliveryAvailable}
                                {feeKnown && deliveryFee! > 0 && <span className="ml-2" style={{ color: 'var(--t-text-2)' }}>— Rs. {fmt(deliveryFee!)}</span>}
                                {feeKnown && deliveryFee === 0 && <span className="ml-2">— FREE</span>}
                                {!feeKnown && <span className="ml-2" style={{ color: 'var(--t-text-4)' }}>— fee calculated at Kapruka</span>}
                              </div>
                            )
                          }
                        </div>
                      ) : (
                        <div className="rounded-xl px-3.5 py-2.5 text-xs"
                          style={{ border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.10)', color: '#f87171' }}>
                          ✕ {deliveryInfo.message || s.deliveryUnavailable}
                        </div>
                      )}
                    </>
                  )}

                  {/* Price summary */}
                  {(orderPurpose === 'pickup' || deliveryInfo?.available) && (
                    <div className="rounded-xl overflow-hidden text-sm"
                      style={{ border: '1px solid var(--t-border)' }}>
                      {orderPurpose === 'pickup' && (() => {
                        const loc = PICKUP_LOCATIONS.find(l => l.id === pickupLocation)!;
                        return (
                          <div className="px-4 py-2.5"
                            style={{ background: 'rgba(26,18,58,0.70)', borderBottom: '1px solid var(--t-border)' }}>
                            <p className="text-xs" style={{ color: 'var(--t-text-3)' }}>Pickup at</p>
                            <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--t-text-1)' }}>{loc.name}</p>
                            <p className="text-xs" style={{ color: 'var(--t-text-4)' }}>{loc.address} · {loc.hours}</p>
                          </div>
                        );
                      })()}
                      {[
                        { label: 'Price of items', value: `Rs. ${fmt(total)}` },
                        { label: 'Kapruka Delivery', value: orderPurpose === 'pickup' || deliveryFee === 0
                          ? 'Rs. 0 (FREE)'
                          : feeKnown ? `Rs. ${fmt(deliveryFee!)}` : 'Calculated at Kapruka',
                          green: orderPurpose === 'pickup' || deliveryFee === 0,
                        },
                      ].map((row, i) => (
                        <div key={i} className="flex justify-between items-center px-4 py-2.5"
                          style={{
                            background: 'rgba(26,18,58,0.60)',
                            borderTop: i > 0 ? '1px solid var(--t-border)' : undefined,
                          }}>
                          <span className="text-xs" style={{ color: 'var(--t-text-3)' }}>{row.label}</span>
                          <span className="text-xs" style={{ color: (row as {green?: boolean}).green ? '#4ade80' : 'var(--t-text-2)' }}>
                            {row.value}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center px-4 py-3"
                        style={{ background: 'rgba(17,11,46,0.60)', borderTop: '1px solid var(--t-border)' }}>
                        <span className="font-bold text-sm" style={{ color: 'var(--t-text-1)' }}>Total</span>
                        <span className="font-black text-base product-price">Rs. {fmt(grandTotal)}</span>
                      </div>
                    </div>
                  )}

                  {/* Voucher */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1.5"
                      style={{ color: 'var(--t-text-3)' }}>
                      Gift Card# or Voucher# <span className="normal-case font-normal" style={{ color: 'var(--t-text-4)' }}>(Optional)</span>
                    </p>
                    <div className="flex gap-2">
                      <input type="text" value={voucherCode} onChange={e => setVoucherCode(e.target.value)}
                        placeholder="Enter code..." className={`${inp} flex-1`} />
                      <button className="px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex-shrink-0"
                        style={{ background: 'rgba(64,41,112,0.35)', border: '1px solid var(--t-border-bright)', color: 'var(--t-text-2)' }}>
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Error */}
                  {error && <p className="text-xs text-center" style={{ color: '#f87171' }}>{error}</p>}

                  {/* Checkout button */}
                  <button onClick={handleCheckout}
                    disabled={checkLoading || (!!deliveryInfo && !deliveryInfo.available)}
                    className="btn-gold w-full py-3.5 rounded-xl text-sm tracking-wide"
                    style={{ color: '#3A3A3C', opacity: checkLoading ? 0.7 : 1 }}>
                    {checkLoading ? 'Placing order…' : `${s.checkout} →`}
                  </button>

                  <p className="text-xs text-center" style={{ color: 'var(--t-text-4)' }}>
                    Cash on Delivery · Credit Card · Bank Transfer and more
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}