'use client';
import { useEffect } from 'react';

interface ToastProps { message: string; onDone: () => void; }

export default function Toast({ message, onDone }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-800 border border-slate-700 text-slate-100 text-sm px-4 py-2.5 rounded-full shadow-xl animate-bounce-in">
      {message}
    </div>
  );
}