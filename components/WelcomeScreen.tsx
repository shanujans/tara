'use client';
import { useEffect, useState } from 'react';

const GREETINGS = ['Hello! 👋', 'ආයුබෝවන්! 🙏', 'வணக்கம்! 🙏', 'Ayubowan machang! 😊'];
const CHIPS = ['Find a gift 🎁', 'Browse electronics 📱', 'Track my order 📦'];

export default function WelcomeScreen({ onChip }: { onChip: (text: string) => void }) {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setFade(false);
      setTimeout(() => { setIdx(i => (i + 1) % GREETINGS.length); setFade(true); }, 300);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-400/30">
        <span className="text-slate-900 text-2xl font-black">T</span>
      </div>

      <div className="space-y-2">
        <p
          className="text-white font-bold text-2xl transition-opacity duration-300"
          style={{ opacity: fade ? 1 : 0 }}
        >
          {GREETINGS[idx]}
        </p>
        <p className="text-slate-400 text-sm">I'm TARA — your AI shopping assistant for Kapruka</p>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-xs">
        {CHIPS.map(chip => (
          <button
            key={chip}
            onClick={() => onChip(chip)}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-400/50 text-slate-300 hover:text-amber-400 text-sm py-2.5 px-4 rounded-xl transition-all duration-200 text-left"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}