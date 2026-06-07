'use client';
import { useCart } from '@/context/CartContext';
import { STRINGS, Lang } from '@/lib/strings';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  lang: Lang;
}

export default function CartDrawer({ open, onClose, lang }: CartDrawerProps) {
  const { items, removeItem, totalPrice, clearCart } = useCart();
  const s = STRINGS[lang];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-full bg-slate-900 border-l border-slate-700 z-50 flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-white font-bold text-lg tracking-tight">{s.cartTitle}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                <span className="text-2xl">🛒</span>
              </div>
              <p className="text-slate-400 text-sm">{s.cartEmpty}</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="flex gap-3 bg-slate-800 rounded-xl p-3 border border-slate-700">
                <img
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                  className="w-14 h-14 aspect-square object-cover rounded-lg bg-slate-700 flex-shrink-0"
                  onError={e => {
                    (e.target as HTMLImageElement).src =
                      `https://placehold.co/56x56/1e293b/94a3b8?text=IMG`;
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-100 text-xs font-medium line-clamp-2 leading-snug">{item.name}</p>
                  <p className="text-amber-400 text-sm font-bold mt-1">
                    {s.lkr} {(item.price * item.qty).toLocaleString('si-LK')}
                  </p>
                  {item.qty > 1 && (
                    <p className="text-slate-500 text-xs">× {item.qty}</p>
                  )}
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-slate-500 hover:text-red-400 transition-colors text-sm self-start mt-0.5 flex-shrink-0"
                  aria-label={s.removeItem}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-slate-700 px-5 py-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">{s.total}</span>
              <span className="text-white font-bold text-lg">{s.lkr} {totalPrice.toLocaleString('si-LK')}</span>
            </div>
            <button
              className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-amber-400/30 active:scale-95 text-sm tracking-wide"
            >
              {s.checkout} →
            </button>
            <button
              onClick={clearCart}
              className="w-full text-slate-500 hover:text-slate-300 text-xs transition-colors py-1"
            >
              Clear cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}
