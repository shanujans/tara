'use client';
import { useEffect } from 'react';

interface ToastProps { message: string; onDone: () => void; }

export default function Toast({ message, onDone }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="fixed bottom-20 left-1/2 z-[100] animate-bounce-in"
      style={{ transform: 'translateX(-50%)', pointerEvents: 'none' }}
    >
      <div
        className="px-5 py-3 rounded-full shadow-2xl text-sm font-semibold"
        style={{
          background: 'rgba(26,18,58,0.95)',
          border: '1px solid rgba(107,77,171,0.50)',
          color: 'var(--t-text-1)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(64,41,112,0.35)',
        }}
      >
        {message}
      </div>
    </div>
  );
}
