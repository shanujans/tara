'use client';
import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { SL_DISTRICTS } from '@/lib/districts';
import { Lang } from '@/lib/strings';

const GIFT_PLACEHOLDERS: Record<Lang, string> = {
  en: 'Write a gift message...',
  si: 'තෑග්ග පණිවිඩය ලියන්න...',
  ta: 'பரிசு செய்தி எழுதுங்கள்...',
  tl: 'Gift message liyanna machang...',
};

const OCCASIONS = ['Birthday','Anniversary','Wedding','New Baby','Get Well','Thank You','Festival','Just Because'];

interface CartDrawerProps { open: boolean; onClose: () => void; lang: Lang; }

export default function CartDrawer({ open, onClose, lang }: CartDrawerProps) {
  const {
    items, removeItem, updateQty, total, clearCart,
    giftMessage, setGiftMessage,
    deliveryDate, setDeliveryDate,
    district, setDistrict,
  } = useCart();

  const [occasion, setOccasion]       = useState('');
  const [genLoading, setGenLoading]   = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [orderId, setOrderId]         = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [error, setError]             = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [voiceNoteUrl, setVoiceNoteUrl] = useState('');

  // Min = tomorrow, max = +30 days
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const maxDate  = new Date(); maxDate.setDate(maxDate.getDate() + 30);
  const toISO    = (d: Date) => d.toISOString().split('T')[0];

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

  const handleCheckout = async () => {
    setError('');
    if (!district)        { setError('Please select a district.'); return; }
    if (!deliveryDate)    { setError('Please select a delivery date.'); return; }
    if (!recipientName.trim())  { setError('Please enter recipient name.'); return; }
    if (!recipientPhone.trim()) { setError('Please enter recipient phone.'); return; }
    setCheckLoading(true);
    try {
      const fullGiftMessage = voiceNoteUrl
        ? `${giftMessage}\n\n🎙 Voice note: ${voiceNoteUrl}`
        : giftMessage;

      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          giftMessage: fullGiftMessage,
          deliveryDate,
          district,
          total,
          recipient: { name: recipientName.trim(), phone: recipientPhone.trim() },
          sender: { name: 'TARA Customer' },
        }),
      });
      const data = await r.json();
      if (data.success) {
        setOrderId(data.orderId);
        setCheckoutUrl(data.checkoutUrl);
        setRecipientName('');
        setRecipientPhone('');
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
      <div className={`fixed top-0 right-0 h-full w-80 max-w-full bg-slate-900 border-l border-slate-700 z-50 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-white font-bold text-lg">🛒 Cart</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        {/* Success state */}
        {orderId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-3xl">✓</div>
            <p className="text-green-400 font-bold text-lg">Order Placed!</p>
            <p className="text-slate-400 text-sm">Ref: <span className="text-white font-mono">{orderId}</span></p>
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 bg-amber-400 text-slate-900 font-bold px-6 py-2 rounded-xl text-sm inline-block"
            >
              Complete Payment →
            </a>
            <button
              onClick={() => { setOrderId(''); setCheckoutUrl(''); onClose(); }}
              className="mt-2 bg-amber-400 text-slate-900 font-bold px-6 py-2 rounded-xl text-sm"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Items */}
            <div className="px-4 py-3 space-y-3">
              {items.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">Your cart is empty</p>
              ) : items.map(item => (
                <div key={item.id} className="flex gap-3 bg-slate-800 rounded-xl p-3 border border-slate-700">
                  <img
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    className="w-12 h-12 aspect-square object-cover rounded-lg bg-slate-700 flex-shrink-0"
                    onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/48x48/1e293b/94a3b8?text=IMG'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-100 text-xs font-medium line-clamp-2 leading-snug">{item.name}</p>
                    <p className="text-amber-400 text-sm font-bold mt-0.5">
                      LKR {(item.price * item.qty).toLocaleString('si-LK')}
                    </p>
                    {/* Qty stepper */}
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
              <div className="px-4 pb-4 space-y-4">
                {/* Subtotal */}
                <div className="flex justify-between items-center py-2 border-t border-slate-700">
                  <span className="text-slate-400 text-sm">Subtotal</span>
                  <span className="text-white font-black text-xl">LKR {total.toLocaleString('si-LK')}</span>
                </div>

                {/* Occasion radar */}
                <div>
                  <p className="text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wider">✦ Occasion Radar</p>
                  <div className="flex flex-wrap gap-1.5">
                    {OCCASIONS.map(o => (
                      <button
                        key={o}
                        onClick={() => setOccasion(prev => prev === o ? '' : o)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all duration-200 ${
                          occasion === o
                            ? 'bg-amber-400 border-amber-400 text-slate-900 font-bold'
                            : 'border-slate-600 text-slate-400 hover:border-amber-400/50 hover:text-slate-300'
                        }`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gift message */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Gift Message</p>
                    <button
                      onClick={generateMessage}
                      disabled={genLoading}
                      className="text-xs text-amber-400 hover:text-amber-300 disabled:text-slate-500 transition-colors"
                    >
                      {genLoading ? 'Generating…' : '✦ AI Generate'}
                    </button>
                  </div>
                  <textarea
                    value={giftMessage}
                    onChange={e => setGiftMessage(e.target.value)}
                    placeholder={GIFT_PLACEHOLDERS[lang]}
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 text-xs resize-none outline-none transition-colors"
                  />
                  {/* Voice note link */}
                  <div className="mt-2">
                    <p className="text-slate-500 text-xs mb-1">🎙 Voice note link (optional)</p>
                    <input
                      type="url"
                      value={voiceNoteUrl}
                      onChange={e => setVoiceNoteUrl(e.target.value)}
                      placeholder="Paste WhatsApp voice note link..."
                      className="w-full bg-slate-800 border border-slate-700 focus:border-blue-400/50 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 text-xs outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Recipient info */}
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Recipient</p>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={e => setRecipientName(e.target.value)}
                    placeholder="Full name"
                    className="w-full bg-slate-800 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 text-xs outline-none mb-2 transition-colors"
                  />
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={e => setRecipientPhone(e.target.value)}
                    placeholder="077XXXXXXX"
                    className="w-full bg-slate-800 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 text-xs outline-none transition-colors"
                  />
                </div>

                {/* Delivery date */}
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Delivery Date</p>
                  <input
                    type="date"
                    value={deliveryDate}
                    min={toISO(tomorrow)}
                    max={toISO(maxDate)}
                    onChange={e => setDeliveryDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2 text-slate-100 text-xs outline-none transition-colors"
                  />
                </div>

                {/* District */}
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Delivery District</p>
                  <select
                    value={district}
                    onChange={e => setDistrict(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 focus:border-amber-400/50 rounded-xl px-3 py-2 text-slate-100 text-xs outline-none transition-colors"
                  >
                    <option value="">Select district…</option>
                    {SL_DISTRICTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Error */}
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}

                {/* Checkout */}
                <button
                  onClick={handleCheckout}
                  disabled={checkLoading}
                  className="w-full bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-black py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-amber-400/30 active:scale-95 text-sm tracking-wide"
                >
                  {checkLoading ? 'Placing order…' : 'Checkout →'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}