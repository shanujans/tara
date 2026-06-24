'use client';
import { useEffect, useRef, useState } from 'react';

interface Props { visible: boolean; }

export default function BroccoliCharacter({ visible }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const [mvReady, setMvReady] = useState(false);

  useEffect(() => {
    /* Step 1 — inject the model-viewer module script once */
    const SCRIPT_ID = 'model-viewer-module';
    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement('script');
      s.id   = SCRIPT_ID;
      s.type = 'module';
      s.src  = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
      document.head.appendChild(s);
    }

    /* Step 2 — append <model-viewer> as soon as the custom element is defined */
    function attachViewer() {
      const el = containerRef.current;
      if (!el || el.querySelector('[data-mv]')) return; /* already mounted */

      const mv = document.createElement('model-viewer');
      mv.setAttribute('data-mv',          '1');
      mv.setAttribute('src',              '/broccoli.glb');
      mv.setAttribute('alt',              'TARA 3D Character');
      mv.setAttribute('auto-rotate',      '');
      mv.setAttribute('camera-controls',  '');
      mv.setAttribute('touch-action',     'none');   /* gesture isolation */
      mv.setAttribute('shadow-intensity', '0.8');
      mv.setAttribute('exposure',         '0.9');
      mv.style.cssText = 'width:100%;height:100%;background:transparent;display:block;';
      mv.addEventListener('load', () => setMvReady(true), { once: true });
      el.appendChild(mv);
    }

    if (typeof customElements === 'undefined') {
      /* Very old browser — try after 5 s as fallback */
      const t = setTimeout(attachViewer, 5_000);
      return () => clearTimeout(t);
    }

    /* whenDefined resolves immediately if already defined, otherwise waits */
    customElements.whenDefined('model-viewer')
      .then(attachViewer)
      .catch(() => setTimeout(attachViewer, 5_000)); /* network failure fallback */
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        /* Fade + lift transition controlled by visible prop */
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: 'opacity 0.55s ease-out, transform 0.55s ease-out',
        pointerEvents: visible ? 'all' : 'none',
      }}
    >
      {/* Greeting above the model */}
      <div style={{ textAlign:'center', marginBottom:8, zIndex:1, position:'relative' }}>
        <p className="font-headline"
          style={{ fontSize:22, fontWeight:700, color:'var(--c-on-surface)', letterSpacing:'-0.02em' }}>
          Hi! I&apos;m TARA ✨
        </p>
        <p style={{ fontSize:13, color:'var(--c-on-surface-variant)', marginTop:3 }}>
          Your AI shopping assistant for Kapruka Sri Lanka
        </p>
      </div>

      {/* model-viewer container — touch-action:none prevents parent scroll/zoom */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          maxWidth: 300,
          height: 330,
          position: 'relative',
          touchAction: 'none',
          userSelect: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Loading placeholder shown while .glb downloads */}
        {!mvReady && (
          <div style={{
            position:'absolute', inset:0, display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', gap:10,
          }}>
            <div style={{
              width:60, height:60, borderRadius:'50%',
              border:'3px solid rgba(189,147,249,0.20)',
              borderTopColor:'var(--c-primary-container)',
              animation:'spin 0.9s linear infinite',
            }}/>
            <p style={{ fontSize:12, color:'var(--c-outline)' }}>Loading 3D model…</p>
          </div>
        )}
      </div>

      {/* Hint text */}
      <p style={{
        fontSize:12, color:'var(--c-outline)', marginTop:8,
        animation:'quantum-pulse 2.2s ease-in-out infinite',
      }}>
        Type below to start shopping →
      </p>

      <style>{`@keyframes spin{ to{ transform:rotate(360deg) } }`}</style>
    </div>
  );
}
