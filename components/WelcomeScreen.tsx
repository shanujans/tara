'use client';
import { useEffect, useState } from 'react';

const GREETINGS = [
  'Hello! 👋',
  'ආයුබෝවන්! 🙏',
  'வணக்கம்! 🙏',
  'Ayubowan machang! 😊',
];

const CHIPS = [
  'Find a gift 🎁',
  'Browse electronics 📱',
  'Track my order 📦',
];

export default function WelcomeScreen({ onChip }: { onChip: (text: string) => void }) {
  const [idx, setIdx]   = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setFade(false);
      setTimeout(() => { setIdx(i => (i + 1) % GREETINGS.length); setFade(true); }, 300);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-7 px-6 text-center">

      {/* TARA avatar — large */}
      <div className="tara-avatar" style={{ width: 64, height: 64 }}>
        <span style={{ fontSize: '1.5rem', fontWeight: 900 }}>T</span>
      </div>

      {/* Animated greeting */}
      <div className="space-y-2">
        <p
          className="font-bold text-2xl transition-opacity duration-300"
          style={{
            opacity: fade ? 1 : 0,
            color: 'var(--t-text-1)',
            fontFamily: 'var(--font-jakarta, "Plus Jakarta Sans", sans-serif)',
          }}
        >
          {GREETINGS[idx]}
        </p>
        <p style={{ color: 'var(--t-text-3)', fontSize: '0.9rem' }}>
          I'm TARA — your AI shopping assistant for Kapruka
        </p>
      </div>

      {/* Decorative gradient line */}
      <div className="h-px w-16 rounded-full"
        style={{ background: 'var(--t-grad-purple)', opacity: 0.6 }} />

      {/* Quick chips */}
      <div className="flex flex-col gap-2.5 w-full max-w-xs">
        {CHIPS.map(chip => (
          <button
            key={chip}
            onClick={() => onChip(chip)}
            className="action-chip justify-start text-left"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
