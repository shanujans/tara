'use client';
import { useEffect, useRef, useState } from 'react';

export interface UserInfo { email: string; name: string; isGuest: boolean; }

interface LoginModalProps { onDone: (user: UserInfo) => void; }

/* =====================================================================
   Liquid wave config — each ribbon is 7 points (start, c1,c2,end1, c3,c4,end2)
   matching the original static path shapes, now breathing via sine offsets.
   ===================================================================== */
type WavePoint = { x: number; baseY: number; amp: number; phase: number };
type RibbonConfig = { points: WavePoint[]; speed: number; globalPhase: number };

const ribbon = (coords: [number, number][], amps: number[], speed: number, globalPhase: number): RibbonConfig => ({
  points: coords.map(([x, baseY], i) => ({ x, baseY, amp: amps[i], phase: i * 0.7 })),
  speed,
  globalPhase,
});

const RIBBONS: RibbonConfig[] = [
  ribbon(
    [[-100, 620], [250, 520], [480, 720], [760, 600], [1040, 480], [1180, 640], [1500, 560]],
    [0, 22, 26, 18, 24, 20, 0], 0.5, 0,
  ),
  ribbon(
    [[-100, 680], [280, 760], [520, 560], [800, 660], [1080, 760], [1220, 580], [1500, 660]],
    [0, 18, 24, 16, 22, 26, 0], 0.34, 2.1,
  ),
  ribbon(
    [[-100, 560], [300, 460], [540, 640], [820, 540], [1100, 440], [1260, 600], [1500, 520]],
    [0, 20, 16, 22, 18, 24, 0], 0.42, 4.2,
  ),
  ribbon(
    [[-100, 720], [260, 640], [560, 800], [840, 700], [1120, 600], [1240, 740], [1500, 680]],
    [0, 16, 20, 14, 18, 22, 0], 0.30, 1.0,
  ),
];

function buildWavePath(cfg: RibbonConfig, t: number): string {
  const p = cfg.points.map(pt => {
    const y = pt.baseY + pt.amp * Math.sin(t * cfg.speed + pt.phase + cfg.globalPhase);
    return `${pt.x},${y.toFixed(1)}`;
  });
  return `M ${p[0]} C ${p[1]} ${p[2]} ${p[3]} C ${p[4]} ${p[5]} ${p[6]}`;
}

/* =====================================================================
   Constellation particle field (canvas, no deps)
   ===================================================================== */
type Particle = {
  x: number; y: number; vx: number; vy: number; r: number;
  phase: number; speed: number; kind: 0 | 1 | 2; // 0 white, 1 blue, 2 gold
};

const PARTICLE_COLOR: Record<Particle['kind'], [number, number, number]> = {
  0: [255, 255, 255],
  1: [158, 199, 255],
  2: [255, 226, 122],
};

export default function LoginModal({ onDone }: LoginModalProps) {
  const [mode,     setMode]     = useState<'choice' | 'login'>('choice');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const rootRef    = useRef<HTMLDivElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const ribbon1Ref = useRef<SVGPathElement>(null);
  const ribbon2Ref = useRef<SVGPathElement>(null);
  const ribbon3Ref = useRef<SVGPathElement>(null);
  const ribbon4Ref = useRef<SVGPathElement>(null);

  const continueGuest = () =>
    onDone({ email: '', name: 'Guest', isGuest: true });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Enter your email and password.'); return; }
    setLoading(true); setError('');
    try {
      const r  = await fetch('/api/kapruka-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (d.success) {
        onDone({ email, name: d.name || email.split('@')[0], isGuest: false });
      } else {
        setError(d.message || 'Incorrect email or password.');
      }
    } catch {
      setError('Could not reach Kapruka. Continuing as guest…');
      setTimeout(continueGuest, 1800);
    } finally { setLoading(false); }
  };

  /* ---------- Parallax: mouse → CSS vars (no re-renders) ---------- */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    let raf = 0, nx = 0, ny = 0;
    const onMove = (e: MouseEvent) => {
      nx = (e.clientX / window.innerWidth - 0.5) * 2;
      ny = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          root.style.setProperty('--px', nx.toFixed(4));
          root.style.setProperty('--py', ny.toFixed(4));
          raf = 0;
        });
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* ---------- Liquid wave animation (real path morphing, not just translate) ---------- */
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    const refs = [ribbon1Ref, ribbon2Ref, ribbon3Ref, ribbon4Ref];
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      RIBBONS.forEach((cfg, i) => refs[i].current?.setAttribute('d', buildWavePath(cfg, t)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ---------- Constellation particle field ---------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const COUNT = 58;
    const LINK_DIST = 120;
    let particles: Particle[] = [];
    let raf = 0;
    let w = 0, h = 0;

    const initParticles = () => {
      particles = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        r: 1 + Math.random() * 1.7,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.9,
        kind: (Math.random() < 0.65 ? 0 : Math.random() < 0.6 ? 1 : 2) as Particle['kind'],
      }));
    };

    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * DPR));
      canvas.height = Math.max(1, Math.round(h * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (!particles.length) initParticles();
    };
    resize();
    window.addEventListener('resize', resize);

    let t = 0;
    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.30;
            ctx.strokeStyle = `rgba(190,165,255,${alpha.toFixed(3)})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * p.speed + p.phase));
        const [r, g, b] = PARTICLE_COLOR[p.kind];
        ctx.beginPath();
        ctx.fillStyle = `rgba(${r},${g},${b},${tw.toFixed(3)})`;
        ctx.shadowColor = `rgba(${r},${g},${b},${(tw * 0.8).toFixed(3)})`;
        ctx.shadowBlur = 5;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    if (reduceMotion) {
      draw(); // render one static frame, no loop
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <div className="login-root" ref={rootRef}>
      {/* ============== ANIMATED BACKGROUND ============== */}
      <div className="login-bg" aria-hidden="true">
        <div className="login-vignette" />
        <canvas ref={canvasRef} className="login-particles" />

        <svg className="login-waves" preserveAspectRatio="none" viewBox="0 0 1400 900">
          <defs>
            <linearGradient id="loginGold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffd76a" stopOpacity="0" />
              <stop offset="50%" stopColor="#ffd76a" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ffd76a" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="loginPurple" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#b98aff" stopOpacity="0" />
              <stop offset="50%" stopColor="#b98aff" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#b98aff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="loginBlue" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8aa9ff" stopOpacity="0" />
              <stop offset="50%" stopColor="#8aa9ff" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#8aa9ff" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path ref={ribbon1Ref} className="login-ribbon r1" d={buildWavePath(RIBBONS[0], 0)} fill="none" />
          <path ref={ribbon2Ref} className="login-ribbon r2" d={buildWavePath(RIBBONS[1], 0)} fill="none" />
          <path ref={ribbon3Ref} className="login-ribbon r3" d={buildWavePath(RIBBONS[2], 0)} fill="none" />
          <path ref={ribbon4Ref} className="login-ribbon r4" d={buildWavePath(RIBBONS[3], 0)} fill="none" />
        </svg>
      </div>

      {/* ============== HERO MARK (left side) ============== */}
      <div className="login-hero">
        <div className="login-hero-inner">
          {/* Ambient bloom — blurred, scaled, slow opacity pulse, sits behind the crisp mark */}
          <svg className="login-mark-bloom" viewBox="0 0 320 220" aria-hidden="true">
            <path d="M 36 70 C 36 150 110 190 160 190 C 210 190 284 150 284 70"
              fill="none" stroke="url(#markGrad)" strokeWidth="34" strokeLinecap="round" />
          </svg>
          <svg className="login-mark" viewBox="0 0 320 220" aria-hidden="true">
            <defs>
              <linearGradient id="markGrad" x1="0%" y1="40%" x2="100%" y2="60%">
                <stop offset="0%" stopColor="#ffe27a" />
                <stop offset="55%" stopColor="#d7baff" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            <path d="M 36 70 C 36 150 110 190 160 190 C 210 190 284 150 284 70"
              fill="none" stroke="url(#markGrad)" strokeWidth="34" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* ============== CARD (spinning gradient edge) ============== */}
      <div className="ai-edge login-card-edge">
        <div className="login-card-inner">
          <div className="login-card-icon">
            <img src="/kapruka-logo.png" alt="Kapruka"
              style={{ width: 34, height: 34, objectFit: 'contain' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>

          <h2 className="font-headline login-title">Welcome to TARA</h2>
          <p className="login-subtitle">AI Retail Agent · Kapruka Sri Lanka</p>

          {mode === 'choice' ? (
            <>
              <div className="ai-edge ai-btn-edge">
                <button type="button" className="login-btn login-btn-primary" onClick={continueGuest}>
                  Continue as Guest&nbsp; →
                </button>
              </div>
              <div className="ai-edge ai-btn-edge">
                <button type="button" className="login-btn login-btn-outline" onClick={() => setMode('login')}>
                  Login with Kapruka Account&nbsp; 🔑
                </button>
              </div>
              <p className="login-helper">
                Login to access order history, saved addresses &amp; faster checkout.
              </p>
            </>
          ) : (
            <form onSubmit={handleLogin}>
              <input
                type="email" placeholder="Kapruka email"
                value={email} onChange={e => setEmail(e.target.value)}
                className="login-input" autoFocus
              />
              <input
                type="password" placeholder="Password"
                value={password} onChange={e => setPassword(e.target.value)}
                className="login-input"
              />
              {error && <p className="login-error">{error}</p>}
              <div className="ai-edge ai-btn-edge">
                <button type="submit" disabled={loading} className="login-btn login-btn-primary">
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </div>
              <button type="button" className="login-btn login-btn-text"
                onClick={() => { setMode('choice'); setError(''); }}>
                ← Back
              </button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @property --angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes loginSpinBorder { to { --angle: 360deg; } }

        .login-root {
          --px: 0; --py: 0;
          position: fixed; inset: 0; z-index: 9999;
          display: flex; align-items: center; justify-content: flex-end;
          overflow: hidden;
          background: radial-gradient(120% 100% at 30% 30%, #1a1230 0%, #0a0716 55%, #060410 100%);
          font-family: var(--font-body, inherit);
        }

        /* ---------- background layers ---------- */
        .login-bg { position: absolute; inset: 0; pointer-events: none; }

        .login-vignette {
          position: absolute; inset: 0;
          background: radial-gradient(45% 45% at 28% 45%, rgba(180,140,255,0.22) 0%, transparent 75%);
          mix-blend-mode: screen;
          animation: loginVigPulse 9s ease-in-out infinite;
          animation-delay: -3s;
        }
        @keyframes loginVigPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%      { opacity: 0.9; transform: scale(1.12); }
        }

        /* Constellation canvas — parallax layer 1 (moves most, opposite to cursor) */
        .login-particles {
          position: absolute; inset: 0; width: 100%; height: 100%;
          transform: translate3d(calc(var(--px) * -22px), calc(var(--py) * -16px), 0);
        }

        /* Wave layer — parallax layer 2 (further back, moves less) */
        .login-waves {
          position: absolute; inset: 0; width: 100%; height: 100%;
          transform: translate3d(calc(var(--px) * -10px), calc(var(--py) * -6px), 0);
        }
        .login-ribbon { stroke-width: 3; opacity: 0.8; }
        .login-ribbon.r1 { stroke: url(#loginGold); }
        .login-ribbon.r2 { stroke: url(#loginPurple); stroke-width: 4; }
        .login-ribbon.r3 { stroke: url(#loginBlue); }
        .login-ribbon.r4 { stroke: url(#loginGold); opacity: 0.4; stroke-width: 2; }

        /* ---------- hero mark (foreground — moves with cursor for depth pop) ---------- */
        .login-hero {
          position: relative; z-index: 1;
          flex: 1; display: flex; align-items: center; justify-content: center;
          min-width: 0;
        }
        .login-hero-inner {
          position: relative;
          transform: translate3d(calc(var(--px) * 14px), calc(var(--py) * 10px), 0);
        }
        .login-mark {
          position: relative; z-index: 1;
          width: min(34vw, 380px); height: auto;
          filter: drop-shadow(0 0 18px rgba(216,180,255,0.35));
        }
        .login-mark-bloom {
          position: absolute; z-index: 0; top: 50%; left: 50%;
          width: min(34vw, 380px); height: auto;
          transform: translate(-50%, -50%) scale(1.7);
          filter: blur(40px);
          opacity: 0.4;
          animation: loginBloomPulse 7s ease-in-out infinite;
          animation-delay: -2s;
        }
        @keyframes loginBloomPulse {
          0%, 100% { opacity: 0.3; }
          50%      { opacity: 0.6; }
        }

        /* ---------- spinning conic-gradient edge (shared by card + buttons) ---------- */
        .ai-edge {
          --angle: 0deg;
          position: relative;
          background: conic-gradient(from var(--angle), #ffd76a, #8b5cf6 28%, #4f46e5 52%, #b98aff 78%, #ffd76a 100%);
          animation: loginSpinBorder 6s linear infinite;
        }
        .login-card-edge {
          z-index: 1;
          width: 380px; max-width: 90vw;
          margin: 0 clamp(20px, 6vw, 90px);
          padding: 2px;
          border-radius: 22px;
          box-shadow: 0 30px 80px rgba(0,0,0,0.55);
        }
        .ai-btn-edge {
          padding: 2px;
          border-radius: 13px;
          margin-bottom: 10px;
          animation-duration: 4.5s;
        }

        /* ---------- card inner (glass) ---------- */
        .login-card-inner {
          border-radius: 20px;
          padding: 34px 30px 30px;
          background: linear-gradient(160deg, rgba(40,28,64,0.62), rgba(14,10,26,0.74));
          backdrop-filter: blur(36px) saturate(150%);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.10),
            inset 0 1px 0 rgba(216,180,255,0.20);
        }

        .login-card-icon {
          width: 60px; height: 60px; margin: 0 auto 16px;
          border-radius: 16px;
          background: linear-gradient(150deg, #6d28d9, #2e1065);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 24px rgba(109,40,217,0.45);
        }

        .login-title {
          font-size: 22px; font-weight: 700; color: #fff;
          text-align: center; margin-bottom: 4px;
        }
        .login-subtitle {
          font-size: 13px; color: rgba(255,255,255,0.62);
          text-align: center; margin-bottom: 24px;
        }

        .login-btn {
          width: 100%; padding: 13px 0; border-radius: 11px;
          font-size: 14px; font-weight: 700; cursor: pointer;
          font-family: inherit; display: block;
          transition: opacity 0.15s, transform 0.1s;
        }
        .login-btn:active { transform: scale(0.985); }
        .login-btn-primary {
          background: linear-gradient(135deg, #8b5cf6 0%, #4f46e5 100%);
          color: #fff; border: none;
        }
        .login-btn-primary:hover { opacity: 0.92; }
        .login-btn-outline {
          background: rgba(20,14,32,0.82);
          color: rgba(255,255,255,0.88);
          border: none;
        }
        .login-btn-outline:hover { background: rgba(30,22,46,0.9); }
        .login-btn-text {
          width: 100%; background: transparent; color: rgba(255,255,255,0.55);
          border: none; padding: 10px 0; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: inherit;
        }
        .login-btn-text:hover { color: rgba(255,255,255,0.8); }
        .login-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .login-helper {
          font-size: 11.5px; color: rgba(255,255,255,0.45);
          text-align: center; margin-top: 2px; line-height: 1.5;
        }

        .login-input {
          width: 100%; padding: 12px 14px; margin-bottom: 10px;
          border-radius: 12px; font-size: 14px; font-family: inherit;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.16);
          color: #fff; outline: none;
        }
        .login-input::placeholder { color: rgba(255,255,255,0.40); }
        .login-input:focus { border-color: rgba(180,150,255,0.6); }

        .login-error {
          font-size: 12px; color: #ff8a8a; margin: -2px 0 10px; line-height: 1.4;
        }

        /* ---------- responsive ---------- */
        @media (max-width: 860px) {
          .login-hero { display: none; }
          .login-root { justify-content: center; }
          .login-card-edge { margin: 0 16px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .login-vignette, .login-mark-bloom, .ai-edge { animation: none; }
          .login-particles, .login-waves, .login-hero-inner { transform: none; }
        }
      `}</style>
    </div>
  );
}