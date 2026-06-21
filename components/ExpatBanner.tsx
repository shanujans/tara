'use client';

interface ExpatBannerProps {
  country: string;
  onDismiss: () => void;
}

export default function ExpatBanner({ country, onDismiss }: ExpatBannerProps) {
  return (
    <div className="expat-banner mx-1 mb-3 px-4 py-3 flex items-start justify-between gap-3 animate-slide-in-left">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-black uppercase tracking-widest"
            style={{ color: '#c7abff' }}>
            ✈ Expat Mode
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{
              background: 'rgba(107,77,171,0.25)',
              border: '1px solid rgba(107,77,171,0.40)',
              color: '#c7abff',
            }}>
            {country}
          </span>
        </div>
        <p className="text-xs leading-relaxed"
          style={{ color: 'var(--t-text-2)' }}>
          I'll take care of your family back home. 🇱🇰 All deliveries to Sri Lanka.
          Same-day available in Colombo.
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-sm flex-shrink-0 mt-0.5 transition-colors"
        style={{ color: 'var(--t-text-4)' }}
        onMouseOver={e => (e.currentTarget.style.color = 'var(--t-text-2)')}
        onMouseOut={e => (e.currentTarget.style.color = 'var(--t-text-4)')}
      >
        ✕
      </button>
    </div>
  );
}
