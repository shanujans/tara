'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useCart } from '@/context/CartContext';
import { Lang, STRINGS } from '@/lib/strings';
import type { DeliveryOption } from '@/lib/mcp';

const PLACEHOLDER = 'https://placehold.co/48x48/1e293b/94a3b8?text=?';
const OCCASIONS = ['Birthday','Anniversary','Wedding','New Baby','Get Well','Thank You','Festival','Just Because'];

const PICKUP_LOCATIONS = [
  { id: 'mirihana',     name: 'Kapruka — Mirihana',         hours: '8 AM – 11 PM',  address: 'Mirihana, Nugegoda' },
  { id: 'barnes',       name: 'Java Lounge — Barnes Place',  hours: '10 AM – 11 PM', address: 'Barnes Place, Colombo 7' },
  { id: 'kandy',        name: 'Java Lounge — Kandy',         hours: '10 AM – 11 PM', address: 'Kandy City Centre' },
  { id: 'fort',         name: 'Java Lounge — Fort',          hours: '10 AM – 11 PM', address: '7 Hospital St, Colombo 01' },
] as const;
type PickupId = typeof PICKUP_LOCATIONS[number]['id'];

interface CartDrawerProps { open: boolean; onClose: () => void; lang: Lang; }
interface CityOption   { name: string; id?: string; }
interface DeliveryInfo {
  available: boolean;
  options?: DeliveryOption[];
  fee?: number; delivery_fee?: number;
  eta?: string; message?: string;
}

const GIFT_PH: Record<Lang, string> = {
  en: 'Write a gift message…', si: 'තෑග්ග පණිවිඩය ලියන්න…',
  sl: 'Gift message ekak liyanna…',
  ta: 'பரிசு செய்தி எழுதுங்கள்…', tl: 'Gift message liyanna machang…',
};

function fmt(n: number) { return n.toLocaleString('si-LK'); }

export default function CartDrawer({ open, onClose, lang }: CartDrawerProps) {
  const { items, removeItem, updateQty, total, clearCart,
          giftMessage, setGiftMessage, deliveryDate, setDeliveryDate,
          district, setDistrict } = useCart();
  const s = STRINGS[lang];

  // ── Checkout mode ─────────────────────────────────────────────────────────
  const [mode,          setMode]          = useState<'guest'|'signin'>('guest');

  // ── Order purpose (mirrors Kapruka's checkout step 1) ────────────────────
  const [orderPurpose,   setOrderPurpose]   = useState<'gift'|'self'|'pickup'>('gift');
  const [pickupLocation, setPickupLocation] = useState<PickupId>('mirihana');

  // ── Recipient form ────────────────────────────────────────────────────────
  const [recipientName,  setRecipientName]  = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [addressLine1,   setAddressLine1]   = useState('');
  const [addressLine2,   setAddressLine2]   = useState('');
  const [occasion,       setOccasion]       = useState('');
  const [senderName,     setSenderName]     = useState('');
  const [senderEmail,    setSenderEmail]    = useState('');
  const [locationType,   setLocationType]   = useState('HOUSE OR RESIDENCE');
  const [voucherCode,    setVoucherCode]    = useState('');

  // ── City autocomplete ─────────────────────────────────────────────────────
  const [cityInput,       setCityInput]       = useState('');
  const [citySuggestions, setCitySuggestions] = useState<CityOption[]>([]);
  const [showCitySug,     setShowCitySug]     = useState(false);
  const [cityLoading,     setCityLoading]     = useState(false);

  // ── Delivery check ────────────────────────────────────────────────────────
  const [deliveryInfo,     setDeliveryInfo]     = useState<DeliveryInfo | null>(null);
  const [deliveryChecking, setDeliveryChecking] = useState(false);
  const [selectedType,     setSelectedType]     = useState<'express'|'standard'>('express');

  // ── Order flow ────────────────────────────────────────────────────────────
  const [genLoading,   setGenLoading]   = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [orderId,      setOrderId]      = useState('');
  const [checkoutUrl,  setCheckoutUrl]  = useState('');
  const [orderTime,    setOrderTime]    = useState('');
  const [error,        setError]        = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Date helpers — minimum tomorrow
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const maxDate  = new Date(); maxDate.setDate(maxDate.getDate() + 30);
  const toISO    = (d: Date) => d.toISOString().split('T')[0];

  // Displayed selected delivery option
  const activeOption: DeliveryOption | undefined =
    deliveryInfo?.options?.find(o => o.type === selectedType) ??
    deliveryInfo?.options?.[0];

  // Keep undefined when MCP didn't return a fee — don't default to 0 (looks like FREE)
  const deliveryFee: number | undefined = orderPurpose === 'pickup' ? 0
    : (activeOption?.fee ?? deliveryInfo?.fee ?? deliveryInfo?.delivery_fee);
  const feeKnown   = deliveryFee !== undefined;
  const grandTotal = total + (deliveryFee ?? 0);

  // ── City search ───────────────────────────────────────────────────────────
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
        setCitySuggestions(d.cities ?? []);
        setShowCitySug(true);
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

  // ── Delivery check ─────────────────────────────────────────────────────────
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
      .then(d => { if (!cancelled) { setDeliveryInfo(d); setSelectedType('express'); }})
      .catch(() => { if (!cancelled) setDeliveryInfo({ available: false, message: 'Could not check delivery.' }); })
      .finally(() => { if (!cancelled) setDeliveryChecking(false); });
    return () => { cancelled = true; };
  }, [district, deliveryDate, items]);

  // ── AI gift message ────────────────────────────────────────────────────────
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

  // ── Checkout ───────────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    setError('');
    if (orderPurpose !== 'pickup') {
      if (!district)     { setError('Please select a delivery city.'); return; }
      if (!deliveryDate) { setError('Please select a delivery date.'); return; }
      if (deliveryInfo && !deliveryInfo.available) { setError(s.deliveryUnavailable); return; }
    }
    if (!recipientName.trim())  { setError('Please enter recipient name.'); return; }
    if (!recipientPhone.trim()) { setError('Please enter recipient phone.'); return; }
    if (orderPurpose !== 'pickup' && !addressLine1.trim()) {
      setError('Please enter delivery address.'); return;
    }

    setCheckLoading(true);
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items, giftMessage, deliveryDate, district,
          total: grandTotal,
          deliveryFee,
          orderPurpose,
          deliveryType: orderPurpose === 'pickup' ? 'pickup' : (activeOption?.type ?? 'standard'),
          pickupLocation: orderPurpose === 'pickup'
            ? PICKUP_LOCATIONS.find(l => l.id === pickupLocation)?.name
            : undefined,
          recipient: {
            name:    recipientName.trim(),
            phone:   recipientPhone.trim(),
            address: orderPurpose === 'pickup'
              ? (PICKUP_LOCATIONS.find(l => l.id === pickupLocation)?.address ?? 'Pickup')
              : `${addressLine1.trim()}${addressLine2.trim() ? ', ' + addressLine2.trim() : ''}`,
          },
          sender: {
            name:  senderName.trim() || 'Guest',
            email: senderEmail.trim() || undefined,
          },
          locationType,
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
          localStorage.setItem('tara_last_order', JSON.stringify({
            order_id: data.orderId ?? 'ORDER',
            items: items.map(i => ({ id: i.id, name: i.name, price: i.price, image: i.image || PLACEHOLDER })),
            date: new Date().toISOString(),
          }));
        } catch { /* */ }
        setOrderId(data.orderId);
        setCheckoutUrl(data.checkoutUrl);
        clearCart();
      } else {
        setError(data.error ?? 'Checkout failed.');
      }
    } finally { setCheckLoading(false); }
  };

  // ── Shared input class ─────────────────────────────────────────────────────
  const inp = 'w-full bg-slate-800 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 text-xs outline-none transition-colors';

  return (
    <>
      <div onClick={onClose}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />

      <div className={`fixed top-0 right-0 h-full w-80 max-w-full bg-slate-900 border-l border-slate-700 z-50 flex flex-col shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-b border-slate-700">
          <div className="flex items-center justify-between px-5 py-3">
            <h2 className="text-white font-bold text-base">🛒 {s.cartTitle}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-lg transition-colors">✕</button>
          </div>

          {/* Guest / Sign-in toggle */}
          <div className="flex border-t border-slate-700/60">
            {(['guest','signin'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 text-xs font-semibold transition-all ${
                  mode === m
                    ? 'bg-amber-400/10 text-amber-400 border-b-2 border-amber-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}>
                {m === 'guest' ? '👤 Guest Checkout' : '🔑 Sign In'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Sign-in panel ─────────────────────────────────────────────────── */}
        {mode === 'signin' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-3xl">🔑</div>
            <div>
              <p className="text-white font-bold text-base mb-1">Sign in to Kapruka</p>
              <p className="text-slate-400 text-sm leading-relaxed">Access your saved addresses, order history and loyalty rewards.</p>
            </div>
            <a href="https://www.kapruka.com/shops/customerAccounts/accountLogin.jsp"
              target="_blank" rel="noopener noreferrer"
              className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-black py-3 rounded-xl text-sm transition-colors text-center block">
              Continue on Kapruka.com →
            </a>
            <p className="text-slate-500 text-xs">You'll complete checkout on Kapruka's secure site.</p>
            <button onClick={() => setMode('guest')} className="text-slate-400 text-xs hover:text-amber-400 underline underline-offset-2 transition-colors">
              Or continue as guest
            </button>
          </div>
        )}

        {/* ── Success ───────────────────────────────────────────────────────── */}
        {mode === 'guest' && orderId && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-2xl">✓</div>
            <div>
              <p className="text-green-400 font-bold text-base">TARA sorted everything! 🎉</p>
              <p className="text-slate-400 text-sm mt-0.5">Ref: <span className="text-white font-mono">{orderId}</span></p>
            </div>

            {/* Speed timer — prominent */}
            {orderTime && (
              <div className="w-full bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-3">
                <p className="text-amber-400 text-sm font-bold">
                  {s.orderSpeedPrefix} <span className="text-white text-base">{orderTime}</span> {s.orderSpeedSuffix}
                </p>
                <p className="text-slate-500 text-xs mt-1">Kapruka's traditional flow takes ~7 minutes</p>
              </div>
            )}

            {/* Payment CTA — framed as security feature */}
            {checkoutUrl && (
              <div className="w-full">
                <a href={checkoutUrl} target="_blank" rel="noopener noreferrer"
                  className="w-full bg-amber-400 text-slate-900 font-bold px-6 py-3 rounded-xl text-sm hover:bg-amber-300 transition-colors flex items-center justify-center gap-2">
                  <span>🔒</span> Complete Payment on Kapruka →
                </a>
                <p className="text-slate-600 text-xs mt-2">
                  Secure checkout · Takes ~30 seconds · Cash on delivery available
                </p>
              </div>
            )}

            <button onClick={() => { setOrderId(''); setCheckoutUrl(''); setOrderTime(''); onClose(); }}
              className="text-slate-400 hover:text-slate-200 text-xs transition-colors">
              Continue Shopping
            </button>
          </div>
        )}

        {/* ── Guest checkout form ────────────────────────────────────────────── */}
        {mode === 'guest' && !orderId && (
          <div className="flex-1 overflow-y-auto">

            {/* ── Order purpose selector ─────────────────────────────── */}
            <div className="px-4 pt-3 pb-1">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">This order is…</p>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { key: 'gift',   icon: '🎁', label: "It's a gift" },
                  { key: 'self',   icon: '👤', label: "It's for me" },
                  { key: 'pickup', icon: '📍', label: 'I will pickup' },
                ] as const).map(opt => (
                  <button key={opt.key} onClick={() => setOrderPurpose(opt.key)}
                    className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-xs font-semibold transition-all ${
                      orderPurpose === opt.key
                        ? 'bg-amber-400/10 border-amber-400 text-amber-400'
                        : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                    }`}>
                    <span className="text-lg">{opt.icon}</span>
                    <span className="text-center leading-tight">{opt.label}</span>
                  </button>
                ))}
              </div>

              {/* Pickup locations */}
              {orderPurpose === 'pickup' && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-slate-500 text-xs mb-2">Pick a convenient location — open every day:</p>
                  {PICKUP_LOCATIONS.map(loc => (
                    <button key={loc.id} onClick={() => setPickupLocation(loc.id)}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        pickupLocation === loc.id
                          ? 'border-green-600 bg-green-900/20'
                          : 'border-slate-700 hover:border-slate-600'
                      }`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                        pickupLocation === loc.id ? 'border-green-500' : 'border-slate-500'
                      }`}>
                        {pickupLocation === loc.id && <div className="w-2 h-2 rounded-full bg-green-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 text-xs font-semibold leading-tight">{loc.name}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{loc.address}</p>
                        <p className="text-green-400 text-xs mt-0.5">🕐 {loc.hours}</p>
                      </div>
                    </button>
                  ))}
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-green-900/20 border border-green-800/40">
                    <span className="text-green-400 text-sm">✓</span>
                    <span className="text-green-400 text-xs font-bold">FREE — No delivery charges</span>
                  </div>
                </div>
              )}
            </div>

            {/* Cart items */}
            <div className="px-4 py-3 space-y-2.5">
              {items.length === 0
                ? <p className="text-slate-500 text-sm text-center py-8">{s.cartEmpty}</p>
                : items.map(item => (
                  <div key={item.id} className="flex gap-2.5 bg-slate-800 rounded-xl p-2.5 border border-slate-700">
                    <img src={item.image || PLACEHOLDER} alt={item.name} loading="lazy"
                      className="w-11 h-11 aspect-square object-cover rounded-lg bg-slate-700 flex-shrink-0"
                      onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-100 text-xs font-medium line-clamp-2 leading-snug">{item.name}</p>
                      <p className="text-amber-400 text-sm font-bold mt-0.5">
                        Rs. {fmt(item.price * item.qty)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <button onClick={() => updateQty(item.id, item.qty - 1)} className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs flex items-center justify-center">−</button>
                        <span className="text-slate-300 text-xs w-4 text-center">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, item.qty + 1)} className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs flex items-center justify-center">+</button>
                      </div>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-slate-600 hover:text-red-400 transition-colors text-xs self-start pt-0.5">🗑</button>
                  </div>
                ))
              }
            </div>

            {items.length > 0 && (
              <div className="px-4 pb-6 space-y-4">

                {/* Occasion */}
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">✦ Occasion</p>
                  <div className="flex flex-wrap gap-1.5">
                    {OCCASIONS.map(o => (
                      <button key={o} onClick={() => setOccasion(p => p === o ? '' : o)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                          occasion === o ? 'bg-amber-400 border-amber-400 text-slate-900 font-bold' : 'border-slate-600 text-slate-400 hover:border-amber-400/50 hover:text-slate-300'
                        }`}>{o}</button>
                    ))}
                  </div>
                </div>

                {/* Gift message */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Gift Message</p>
                    <button onClick={generateMessage} disabled={genLoading}
                      className="text-xs text-amber-400 hover:text-amber-300 disabled:text-slate-500">
                      {genLoading ? 'Generating…' : '✦ AI Generate'}
                    </button>
                  </div>
                  <textarea value={giftMessage} onChange={e => setGiftMessage(e.target.value)}
                    placeholder={GIFT_PH[lang]} rows={3}
                    className={`${inp} resize-none`} />
                  <p className="text-xs text-amber-500/70 mt-1 flex items-start gap-1">
                    <span>⚠️</span>
                    <span>Write in English or Sihalish — Tamil/Sinhala script won't display on Kapruka's site.</span>
                  </p>
                </div>

                {/* Recipient — always shown */}
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">{s.recipientSection}</p>
                  <div className="space-y-2">
                    <input value={recipientName}  onChange={e => setRecipientName(e.target.value)}  placeholder={s.fullName}  className={inp} />
                    <input value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} placeholder={s.phone} type="tel" className={inp} />
                    <input value={senderName}    onChange={e => setSenderName(e.target.value)}    placeholder="Your name (sender)" className={inp} />
                    <input value={senderEmail}   onChange={e => setSenderEmail(e.target.value)}   placeholder="Your email (optional)" type="email" className={inp} />
                    <input value={addressLine1}   onChange={e => setAddressLine1(e.target.value)}   placeholder={s.addressLine1} className={inp} />
                    <input value={addressLine2}   onChange={e => setAddressLine2(e.target.value)}   placeholder={s.addressLine2} className={inp} />
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Location Type</p>
                      <select
                        value={locationType}
                        onChange={e => setLocationType(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2 text-slate-100 text-xs outline-none transition-colors appearance-none"
                      >
                        {[
                          { value: 'HOUSE OR RESIDENCE',       label: '🏠 House / Residence' },
                          { value: 'APARTMENT',                label: '🏢 Apartment' },
                          { value: 'OFFICE',                   label: '💼 Office' },
                          { value: 'OTHER (INCLUDING HOTELS)', label: '🏨 Other (Hotels, Hospitals, Schools…)' },
                        ].map(lt => (
                          <option key={lt.value} value={lt.value}>{lt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Delivery date — hidden for pickup */}
                {orderPurpose !== 'pickup' && <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">{s.deliveryDate}</p>
                  <input type="date" value={deliveryDate}
                    min={toISO(tomorrow)} max={toISO(maxDate)}
                    onChange={e => setDeliveryDate(e.target.value)}
                    className={inp} />
                  {deliveryDate && (
                    <p className="text-slate-500 text-xs mt-1">
                      {new Date(deliveryDate).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}
                    </p>
                  )}
                </div>}

                {/* City autocomplete — hidden for pickup */}
                {orderPurpose !== 'pickup' && (
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">{s.deliveryCity}</p>
                  <div className="relative">
                    <input type="text" value={cityInput}
                      onChange={e => handleCityInput(e.target.value)}
                      onFocus={() => cityInput.length >= 2 && setShowCitySug(true)}
                      onBlur={() => setTimeout(() => setShowCitySug(false), 200)}
                      placeholder={s.deliveryCityPlaceholder}
                      className={`${inp} pr-7`} />
                    {cityLoading && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
                    {showCitySug && citySuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden max-h-36 overflow-y-auto">
                        {citySuggestions.map((c, i) => (
                          <button key={c.id ?? i} onMouseDown={() => selectCity(c)}
                            className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors">
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                )}

                {/* ── Delivery options (Kapruka style) ─────────────────────── */}
                {orderPurpose !== 'pickup' && deliveryChecking && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    Checking delivery options…
                  </div>
                )}

                {orderPurpose !== 'pickup' && !deliveryChecking && deliveryInfo && (
                  <>
                    {deliveryInfo.available ? (
                      <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-800/60">
                        <p className="text-slate-400 text-xs font-semibold px-3.5 pt-3 pb-2">
                          📦 Delivery Options to <span className="text-white">{district}</span>
                        </p>

                        {/* Options list */}
                        {deliveryInfo.options && deliveryInfo.options.length > 0
                          ? deliveryInfo.options.map(opt => (
                            <button key={opt.type} onClick={() => setSelectedType(opt.type)}
                              className={`w-full flex items-center gap-3 px-3.5 py-2.5 border-t border-slate-700/50 text-left transition-colors ${
                                selectedType === opt.type ? 'bg-green-900/20' : 'hover:bg-slate-700/30'
                              }`}>
                              {/* Radio circle */}
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                selectedType === opt.type ? 'border-green-500' : 'border-slate-500'
                              }`}>
                                {selectedType === opt.type && <div className="w-2 h-2 rounded-full bg-green-500" />}
                              </div>
                              <span className="flex-1 text-slate-200 text-xs leading-snug">{opt.label}</span>
                              <span className={`text-xs font-bold flex-shrink-0 ${selectedType === opt.type ? 'text-green-400' : 'text-slate-400'}`}>
                                Rs. {fmt(opt.fee)}
                              </span>
                            </button>
                          ))
                          : (
                            /* Single fee fallback */
                            <div className="px-3.5 pb-3 text-xs text-green-400 font-semibold">
                              ✓ {s.deliveryAvailable}
                              {feeKnown && deliveryFee! > 0 && <span className="ml-2 text-slate-300">— Rs. {fmt(deliveryFee!)}</span>}
                              {feeKnown && deliveryFee === 0 && <span className="ml-2 text-green-400">— FREE</span>}
                              {!feeKnown && <span className="ml-2 text-slate-500">— fee calculated at Kapruka</span>}
                            </div>
                          )
                        }
                      </div>
                    ) : (
                      <div className="rounded-xl px-3.5 py-2.5 border border-red-700/40 bg-red-900/20 text-red-400 text-xs">
                        ✕ {deliveryInfo.message || s.deliveryUnavailable}
                      </div>
                    )}
                  </>
                )}

                {/* ── Price summary (Kapruka style) ─────────────────────────── */}
                {(orderPurpose === 'pickup' || deliveryInfo?.available) && (
                  <div className="rounded-xl border border-slate-700 overflow-hidden text-sm">
                    {/* Pickup summary row */}
                    {orderPurpose === 'pickup' && (() => {
                      const loc = PICKUP_LOCATIONS.find(l => l.id === pickupLocation)!;
                      return (
                        <div className="px-4 py-2.5 bg-slate-800 border-b border-slate-700/50">
                          <p className="text-slate-400 text-xs">Pickup at</p>
                          <p className="text-slate-200 text-xs font-semibold mt-0.5">{loc.name}</p>
                          <p className="text-slate-500 text-xs">{loc.address} · {loc.hours}</p>
                        </div>
                      );
                    })()}
                    <div className="flex justify-between items-center px-4 py-2.5 bg-slate-800">
                      <span className="text-slate-400 text-xs">Price of items</span>
                      <span className="text-slate-200 text-xs">Rs. {fmt(total)}</span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-2.5 bg-slate-800 border-t border-slate-700/50">
                      <span className="text-slate-400 text-xs">Kapruka Delivery</span>
                      {orderPurpose === 'pickup' || deliveryFee === 0
                        ? <span className="text-green-400 text-xs font-bold">Rs. 0 (FREE)</span>
                        : feeKnown
                          ? <span className="text-slate-200 text-xs">Rs. {fmt(deliveryFee!)}</span>
                          : <span className="text-slate-500 text-xs">Calculated at Kapruka</span>
                      }
                    </div>
                    <div className="flex justify-between items-center px-4 py-3 bg-slate-800/40 border-t border-slate-700">
                      <span className="text-white font-bold text-sm">Total</span>
                      <span className="text-amber-400 font-black text-base">Rs. {fmt(grandTotal)}</span>
                    </div>
                  </div>
                )}

                {/* ── Gift card / voucher ───────────────────────────────────── */}
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Gift Card# or Voucher# <span className="normal-case font-normal text-slate-600">(Optional)</span>
                  </p>
                  <div className="flex gap-2">
                    <input type="text" value={voucherCode} onChange={e => setVoucherCode(e.target.value)}
                      placeholder="Enter code…"
                      className={`${inp} flex-1`} />
                    <button className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-xl transition-colors flex-shrink-0">
                      Add
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}

                {/* Checkout */}
                <button onClick={handleCheckout}
                  disabled={checkLoading || (!!deliveryInfo && !deliveryInfo.available)}
                  className="w-full bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-black py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-amber-400/30 active:scale-95 text-sm tracking-wide">
                  {checkLoading ? 'Placing order…' : `${s.checkout} →`}
                </button>

                <p className="text-slate-600 text-xs text-center">
                  You could pay with Cash on Delivery, Credit Card, Bank transfer and many more options.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
