'use client';
import { useEffect, useState } from 'react';

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFadingOut(true), 2000);
    const t2 = setTimeout(() => onDone(), 2750);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '1.75rem',
      background: 'var(--c-surface-container-lowest, #100b1f)',
      opacity: fadingOut ? 0 : 1,
      transition: fadingOut ? 'opacity 0.70s cubic-bezier(0.4,0,0.2,1)' : 'none',
      pointerEvents: fadingOut ? 'none' : 'all',
    }}>
      {/* Ambient glow */}
      <div aria-hidden style={{
        position: 'absolute',
        width: 340, height: 340, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(189,147,249,0.25) 0%, transparent 70%)',
        filter: 'blur(48px)', pointerEvents: 'none',
      }} />

      {/* Logo tile */}
      <div style={{
        position: 'relative', width: 100, height: 100,
        borderRadius: 24,
        background: 'rgba(189,147,249,0.12)',
        border: '1px solid rgba(215,186,255,0.30)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 0 48px rgba(189,147,249,0.20)',
      }}>
        <img src="/kapruka-logo.png" alt="Kapruka"
          style={{ width: 66, height: 66, objectFit: 'contain' }} />
      </div>

      {/* Brand */}
      <div style={{ textAlign: 'center', position: 'relative' }}>
        <p style={{
          fontSize: '2.4rem', fontWeight: 700,
          color: 'var(--c-primary, #d7baff)',
          letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0,
          fontFamily: 'var(--font-manrope, Manrope, sans-serif)',
        }}>
          TARA
        </p>
        <p style={{
          color: 'var(--c-on-surface-variant, #ccc3d3)',
          fontSize: '0.9rem', marginTop: '0.45rem', letterSpacing: '0.02em',
        }}>
          AI Retail Agent by Kapruka
        </p>
      </div>

      {/* Loading dots */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--c-primary-container, #bd93f9)',
            animation: 'tara-dot 1.2s ease-in-out infinite',
            animationDelay: `${i * 200}ms`,
          }} />
        ))}
      </div>
    </div>
  );
}