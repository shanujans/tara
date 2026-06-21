'use client';
import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: SplashScreenProps) {
  // Start fully visible — no fade-in delay needed
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Start fade-out after 2 seconds
    const t1 = setTimeout(() => setFadingOut(true), 2000);
    // Unmount after fade completes (0.7s transition)
    const t2 = setTimeout(() => onDone(), 2750);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.75rem',
        background: '#05030f',
        /* Visible immediately, only fades OUT at end */
        opacity: fadingOut ? 0 : 1,
        transition: fadingOut ? 'opacity 0.70s cubic-bezier(0.4,0,0.2,1)' : 'none',
        pointerEvents: fadingOut ? 'none' : 'all',
      }}
    >
      {/* Ambient purple glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 340, height: 340,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(64,41,112,0.40) 0%, transparent 70%)',
          filter: 'blur(48px)',
          pointerEvents: 'none',
        }}
      />

      {/* Kapruka logo — place your file at public/kapruka-logo.png */}
      <div style={{
        position: 'relative',
        width: 100, height: 100,
        borderRadius: 24,
        background: 'rgba(64,41,112,0.22)',
        border: '1px solid rgba(107,77,171,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 0 48px rgba(64,41,112,0.35)',
      }}>
        <img
          src="/kapruka-logo.png"
          alt="Kapruka"
          style={{ width: 66, height: 66, objectFit: 'contain' }}
        />
      </div>

      {/* Brand text */}
      <div style={{ textAlign: 'center', position: 'relative' }}>
        <p style={{
          fontSize: '2.4rem',
          fontWeight: 900,
          color: '#F5E9E2',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          fontFamily: 'var(--font-jakarta,"Plus Jakarta Sans",sans-serif)',
          margin: 0,
        }}>
          TARA{' '}
          <span style={{
            background: 'linear-gradient(90deg,#FAE555,#F5A623)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            ✦
          </span>
        </p>
        <p style={{
          color: '#8878a0',
          fontSize: '0.9rem',
          marginTop: '0.45rem',
          letterSpacing: '0.02em',
        }}>
          AI Retail Agent by Kapruka
        </p>
      </div>

      {/* Animated loading dots */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 7, height: 7,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#402970,#6b4dab)',
              animation: 'tara-dot 1.2s ease-in-out infinite',
              animationDelay: `${i * 200}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
