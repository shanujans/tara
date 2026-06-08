'use client';

interface ExpatBannerProps {
  country: string;
  onDismiss: () => void;
}

export default function ExpatBanner({ country, onDismiss }: ExpatBannerProps) {
  return (
    <div className="mx-4 mt-3 mb-1 bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border border-blue-500/30 rounded-xl px-4 py-3 flex items-start justify-between gap-3 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-blue-400 text-xs font-black uppercase tracking-widest">✈ Expat Mode</span>
          <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
            {country}
          </span>
        </div>
        <p className="text-slate-300 text-xs leading-relaxed">
          I'll take care of your family back home. 🇱🇰 All deliveries to Sri Lanka addresses. Same-day delivery available in Colombo.
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-slate-500 hover:text-slate-300 text-sm flex-shrink-0 mt-0.5 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}