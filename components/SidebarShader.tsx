'use client';
import { useEffect, useRef } from 'react';

/* =====================================================================
   Universe particle field — fast-moving stars in TARA palette
   ===================================================================== */
type Particle = {
  x: number; y: number; vx: number; vy: number; r: number;
  phase: number; speed: number;
  kind: 0 | 1 | 2 | 3; // 0 white, 1 blue, 2 purple, 3 gold
};

const PARTICLE_COLOR: Record<Particle['kind'], [number, number, number]> = {
  0: [255, 255, 255],   // white
  1: [140, 190, 255],   // soft cosmic blue
  2: [190, 150, 255],   // deep purple
  3: [255, 210, 100],   // warm gold
};

export default function SidebarShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const COUNT = 100;          // enough stars for a sidebar
    const LINK_DIST = 140;
    let particles: Particle[] = [];
    let raf = 0;
    let w = 0, h = 0;

    const initParticles = () => {
      particles = Array.from({ length: COUNT }, () => {
        const r = Math.random();
        let kind: Particle['kind'];
        if      (r < 0.4)  kind = 0; // white
        else if (r < 0.7)  kind = 1; // blue
        else if (r < 0.9)  kind = 2; // purple
        else               kind = 3; // gold

        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 1.8,   // fast drift
          vy: (Math.random() - 0.5) * 1.8,
          r: 1.2 + Math.random() * 2.8,
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 1.0,
          kind,
        };
      });
    };

    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * DPR);
      canvas.height = Math.round(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (!particles.length) initParticles();
    };
    resize();
    window.addEventListener('resize', resize);

    let t = 0;
    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);

      // Move particles
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
      }

      // Draw connections (lavender tinted)
      ctx.lineWidth = 0.6;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.5;
            ctx.strokeStyle = `rgba(160,140,220,${alpha.toFixed(3)})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }

      // Draw glowing stars
      for (const p of particles) {
        const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * p.speed + p.phase));
        const [r, g, b] = PARTICLE_COLOR[p.kind];
        ctx.beginPath();
        ctx.fillStyle = `rgba(${r},${g},${b},${tw.toFixed(3)})`;
        ctx.shadowColor = `rgba(${r},${g},${b},${(tw * 0.8).toFixed(3)})`;
        ctx.shadowBlur = p.r + 2;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div
      aria-hidden
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden' }}
    >
      {/* Universe canvas — fast stars */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          background: '#100b1f', // deep void background
        }}
      />

      {/* Violet mid-tone wash — deepens the purple body */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(160deg, rgba(113,74,170,0.22) 0%, rgba(48,29,90,0.18) 60%, transparent 100%)',
      }} />

      {/* 5% yellow accent — warmth at the very top only */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 30% at 50% 0%, rgba(250,229,85,0.05) 0%, transparent 100%)',
      }} />
    </div>
  );
}