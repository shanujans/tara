'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useCart } from '@/context/CartContext';
import { Lang, STRINGS } from '@/lib/strings';

const OCCASIONS = ['Birthday','Anniversary','Wedding','New Baby','Get Well','Thank You','Festival','Just Because'];

interface CartDrawerProps { open: boolean; onClose: () => void; lang: Lang; }

interface CityOption { name: string; id?: string; }
interface DeliveryInfo { available: boolean; fee?: number; delivery_fee?: number; eta?: string; message?: string; }

const GIFT_PLACEHOLDERS: Record<Lang, string> = {
  en: 'Write a gift message…',
  si: 'තෑග්ග පණිවිඩය ලියන්න…',
  ta: 'பரிசு செய்தி எழுதுங்கள்…',
  tl: 'Gift message liyanna machang…',
};

export default function CartDrawer({ open, onClose, lang }: CartDrawerProps) {
  const {
    items, removeItem, updateQty, total, clearCart,
    giftMessage, setGiftMessage,
    deliveryDate, setDeliveryDate,
    district, setDistrict,
  } = useCart();
  const s = STRINGS[lang];

  // Form state
  const [recipientName,  setRecipientName]  = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [addressLine1,   setAddressLine1]   = useState('');
  const [addressLine2,   setAddressLine2]   = useState('');
  const [voiceNoteUrl,   setVoiceNoteUrl]   = useState('');
  const [occasion,       setOccasion]       = useState('');

  // City autocomplete
  const [cityInput,       setCityInput]       = useState('');
  const [citySuggestions, setCitySuggestions] = useState<CityOption[]>([]);
  const [showCitySug,     setShowCitySug]     = useState(false);
  const [cityLoading,     setCityLoading]     = useState(false);

  // Delivery check
  const [deliveryInfo,    setDeliveryInfo]    = useState<DeliveryInfo | null>(null);
  const [deliveryChecking,setDeliveryChecking]= useState(false);

  // UI state
  const [genLoading,    setGenLoading]    = useState(false);
  const [checkLoading,  setCheckLoading]  = useState(false);
  const [orderId,       setOrderId]       = useState('');
  const [checkoutUrl,   setCheckoutUrl]   = useState('');
  const [error,         setError]         = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Min/max date helpers
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const maxDate  = new Date(); maxDate.setDate(maxDate.getDate() + 30);
  const toISO    = (d: Date) => d.toISOString().split('T')[0];

  // City search — debounced 400ms
  const searchCities = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setCitySuggestions([]); setShowCitySug(false); return; }
    debounceRef.current = setTimeout(async () => {
      setCityLoading(true);
      try {
        const r = await fetch('/api/cities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, limit: 8 }),
        });
        const d = await r.json();
        setCitySuggestions(d.cities ?? []);
        setShowCitySug(true);
      } catch {
        setCitySuggestions([]);
      } finally {
        setCityLoading(false);
      }
    }, 400);
  }, []);

  const handleCityInput = (val: string) => {
    setCityInput(val);
    if (!val) { setDistrict(''); setDeliveryInfo(null); }
    searchCities(val);
  };

  const selectCity = (city: CityOption) => {
    setCityInput(city.name);
    setDistrict(city.name);
    setShowCitySug(false);
    setCitySuggestions([]);
  };

  // Delivery check — triggered when city + date are both set
  useEffect(() => {
    if (!district || !deliveryDate) { setDeliveryInfo(null); return; }
    let cancelled = false;
    setDeliveryChecking(true);
    const pid = items[0]?.id;
    fetch('/api/delivery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: district,
        delivery_date: deliveryDate,
        ...(pid ? { product_id: pid } : {}),
      }),
    })
      .then(r => r.json())
      .then(d => { if (!cancelled) setDeliveryInfo(d); })
      .catch(() => { if (!cancelled) setDeliveryInfo({ available: false, message: 'Could not check delivery.' }); })
      .finally(() => { if (!cancelled) setDeliveryChecking(false); });
    return () => { cancelled = true; };
  }, [district, deliveryDate, items]);

  const deliveryFee = deliveryInfo?.fee ?? deliveryInfo?.delivery_fee;

  // AI gift message generation
  const generateMessage = async () => {
    setGenLoading(true);
    try {
      const r = await fetch('/api/gift-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occasion, lang, items }),
      });
      const { message } = await r.json();
      setGiftMessage(message);
    } finally { setGenLoading(false); }
  };

  // Checkout
  const handleCheckout = async () => {
    setError('');
    if (!district)              { setError('Please select a delivery city.'); return; }
    if (!deliveryDate)          { setError('Please select a delivery date.'); return; }
    if (!recipientName.trim())  { setError('Please enter recipient name.'); return; }
    if (!recipientPhone.trim()) { setError('Please enter recipient phone.'); return; }
    if (!addressLine1.trim())   { setError('Please enter delivery address.'); return; }
    if (deliveryInfo && !deliveryInfo.available) {
      setError(s.deliveryUnavailable);
      return;
    }
    setCheckLoading(true);
    try {
      const fullGiftMessage = voiceNoteUrl
        ? `${giftMessage}\n\n🎙 Voice note: ${voiceNoteUrl}`
        : giftMessage;
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items, giftMessage: fullGiftMessage, deliveryDate, district, total,
          recipient: {
            name: recipientName.trim(),
            phone: recipientPhone.trim(),
            address: `${addressLine1.trim()}${addressLine2.trim() ? ', ' + addressLine2.trim() : ''}`,
          },
          sender: { name: 'TARA Customer' },
        }),
      });
      const data = await r.json();
      if (data.success) {
        setOrderId(data.orderId);
        setCheckoutUrl(data.checkoutUrl);
        setRecipientName(''); setRecipientPhone('');
        setAddressLine1(''); setAddressLine2('');
        clearCart();
      } else {
        setError(data.error ?? 'Checkout failed.');
      }
    } finally { setCheckLoading(false); }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-80 max-w-full bg-slate-900 border-l border-slate-700 z-50 flex flex-col shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-700">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-white font-bold text-lg">🛒 {s.cartTitle}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-xl transition-colors">✕</button>
          </div>
          {/* FIX 8 — Kapruka account link */}
          <div className="px-5 pb-3">
            <a
              href="https://www.kapruka.com/shops/customerAccounts/accountLogin.jsp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-400/80 hover:text-amber-400 transition-colors underline-offset-2 hover:underline"
            >
              {s.kaprukaSigning}
            </a>
            <p className="text-xs text-slate-500 mt-0.5">{s.guestCheckout}</p>
          </div>
        </div>

        {/* Success */}
        {orderId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-3xl">✓</div>
            <p className="text-green-400 font-bold text-lg">Order Placed!</p>
            <p className="text-slate-400 text-sm">Ref: <span className="text-white font-mono">{orderId}</span></p>
            {checkoutUrl && (
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer"
                className="mt-2 bg-amber-400 text-slate-900 font-bold px-6 py-2 rounded-xl text-sm inline-block hover:bg-amber-300 transition-colors">
                Complete Payment →
              </a>
            )}
            <button onClick={() => { setOrderId(''); setCheckoutUrl(''); onClose(); }}
              className="text-slate-400 hover:text-slate-200 text-sm transition-colors">
              Continue Shopping
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">

            {/* Cart items */}
            <div className="px-4 py-3 space-y-3">
              {items.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">{s.cartEmpty}</p>
              ) : items.map(item => (
                <div key={item.id} className="flex gap-3 bg-slate-800 rounded-xl p-3 border border-slate-700">
                  <img
                    src={item.image} alt={item.name} loading="lazy"
                    className="w-12 h-12 aspect-square object-cover rounded-lg bg-slate-700 flex-shrink-0"
                    onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/48x48/1e293b/94a3b8?text=IMG'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-100 text-xs font-medium line-clamp-2 leading-snug">{item.name}</p>
                    <p className="text-amber-400 text-sm font-bold mt-0.5">
                      {s.lkr} {(item.price * item.qty).toLocaleString('si-LK')}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button onClick={() => updateQty(item.id, item.qty - 1)} className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm flex items-center justify-center transition-colors">−</button>
                      <span className="text-slate-300 text-xs w-4 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, item.qty + 1)} className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm flex items-center justify-center transition-colors">+</button>
                    </div>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="text-slate-500 hover:text-red-400 transition-colors text-sm self-start">🗑</button>
                </div>
              ))}
            </div>

            {items.length > 0 && (
              <div className="px-4 pb-6 space-y-5">

                {/* Subtotal */}
                <div className="flex justify-between items-center py-2 border-t border-slate-700">
                  <span className="text-slate-400 text-sm">{s.total}</span>
                  <span className="text-white font-black text-xl">{s.lkr} {total.toLocaleString('si-LK')}</span>
                </div>

                {/* Occasion */}
                <div>
                  <p className="text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wider">✦ Occasion</p>
                  <div className="flex flex-wrap gap-1.5">
                    {OCCASIONS.map(o => (
                      <button key={o} onClick={() => setOccasion(prev => prev === o ? '' : o)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all duration-200 ${
                          occasion === o
                            ? 'bg-amber-400 border-amber-400 text-slate-900 font-bold'
                            : 'border-slate-600 text-slate-400 hover:border-amber-400/50 hover:text-slate-300'
                        }`}
                      >{o}</button>
                    ))}
                  </div>
                </div>

                {/* Gift message */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Gift Message</p>
                    <button onClick={generateMessage} disabled={genLoading}
                      className="text-xs text-amber-400 hover:text-amber-300 disabled:text-slate-500 transition-colors">
                      {genLoading ? 'Generating…' : '✦ AI Generate'}
                    </button>
                  </div>
                  <textarea
                    value={giftMessage} onChange={e => setGiftMessage(e.target.value)}
                    placeholder={GIFT_PLACEHOLDERS[lang]} rows={3}
                    className="w-full bg-slate-800 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 text-xs resize-none outline-none transition-colors"
                  />
                  <div className="mt-2">
                    <p className="text-slate-500 text-xs mb-1">🎙 Voice note link (optional)</p>
                    <input type="url" value={voiceNoteUrl} onChange={e => setVoiceNoteUrl(e.target.value)}
                      placeholder="Paste WhatsApp voice note link…"
                      className="w-full bg-slate-800 border border-slate-700 focus:border-blue-400/50 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 text-xs outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* FIX 5 — Recipient details */}
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">{s.recipientSection}</p>
                  <div className="space-y-2">
                    <input type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)}
                      placeholder={s.fullName}
                      className="w-full bg-slate-800 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 text-xs outline-none transition-colors"
                    />
                    <input type="tel" value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)}
                      placeholder={s.phone}
                      className="w-full bg-slate-800 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 text-xs outline-none transition-colors"
                    />
                    <input type="text" value={addressLine1} onChange={e => setAddressLine1(e.target.value)}
                      placeholder={s.addressLine1}
                      className="w-full bg-slate-800 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 text-xs outline-none transition-colors"
                    />
                    <input type="text" value={addressLine2} onChange={e => setAddressLine2(e.target.value)}
                      placeholder={s.addressLine2}
                      className="w-full bg-slate-800 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 text-xs outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* FIX 5 — Delivery date */}
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">{s.deliveryDate}</p>
                  <input type="date" value={deliveryDate}
                    min={toISO(tomorrow)} max={toISO(maxDate)}
                    onChange={e => setDeliveryDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2 text-slate-100 text-xs outline-none transition-colors"
                  />
                </div>

                {/* FIX 5 — City autocomplete (kapruka_list_delivery_cities) */}
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">{s.deliveryCity}</p>
                  <div className="relative">
                    <input
                      type="text"
                      value={cityInput}
                      onChange={e => handleCityInput(e.target.value)}
                      onFocus={() => cityInput.length >= 2 && setShowCitySug(true)}
                      onBlur={() => setTimeout(() => setShowCitySug(false), 200)}
                      placeholder={s.deliveryCityPlaceholder}
                      className="w-full bg-slate-800 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 text-xs outline-none transition-colors pr-8"
                    />
                    {cityLoading && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    )}
                    {showCitySug && citySuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden max-h-40 overflow-y-auto">
                        {citySuggestions.map((c, i) => (
                          <button key={c.id ?? i} onMouseDown={() => selectCity(c)}
                            className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors">
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {district && (
                    <p className="text-xs text-slate-500 mt-1">
                      Delivering to: <span className="text-amber-400 font-semibold">{district}</span>
                    </p>
                  )}
                </div>

                {/* FIX 5 — Delivery check result (kapruka_check_delivery) */}
                {(deliveryChecking || deliveryInfo) && district && deliveryDate && (
                  <div className={`rounded-xl px-3 py-2.5 border text-xs flex items-start gap-2 transition-all ${
                    deliveryChecking ? 'bg-slate-800 border-slate-700 text-slate-400' :
                    deliveryInfo?.available ? 'bg-green-900/30 border-green-700/40 text-green-400' :
                    'bg-red-900/30 border-red-700/40 text-red-400'
                  }`}>
                    {deliveryChecking ? (
                      <><span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />
                      Checking delivery…</>
                    ) : deliveryInfo?.available ? (
                      <>✓ {s.deliveryAvailable}
                      {deliveryFee !== undefined && (
                        <span className="ml-auto font-bold">{s.deliveryFee}: {s.lkr} {deliveryFee.toLocaleString('si-LK')}</span>
                      )}</>
                    ) : (
                      <>✕ {deliveryInfo?.message || s.deliveryUnavailable}</>
                    )}
                  </div>
                )}

                {/* Error */}
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}

                {/* Checkout */}
                <button
                  onClick={handleCheckout}
                  disabled={checkLoading || (deliveryInfo !== null && !deliveryInfo?.available)}
                  className="w-full bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-black py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-amber-400/30 active:scale-95 text-sm tracking-wide"
                >
                  {checkLoading ? 'Placing order…' : `${s.checkout} →`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
