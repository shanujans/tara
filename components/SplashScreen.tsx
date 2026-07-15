'use client';
import { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Star & sparkle generators (client only)                            */
/* ------------------------------------------------------------------ */
const STAR_TYPES = ['', ' blue', ' purple'];
const generateStars = (count: number) =>
  Array.from({ length: count }, (_, i) => {
    const duration = 3 + Math.random() * 3;
    return {
      id: i,
      type: STAR_TYPES[Math.floor(Math.random() * STAR_TYPES.length)],
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: (2 + Math.random() * 3).toFixed(1),
      delay: (-Math.random() * duration).toFixed(2), // negative: starts mid-cycle, not frozen at rest
      duration: duration.toFixed(2),
    };
  });

const generateDots = (count: number) =>
  Array.from({ length: count }, (_, i) => {
    const duration = 3 + Math.random() * 4;
    return {
      id: i,
      cx: Math.random() * 1057,
      cy: 420 + Math.random() * 300,
      r: (1.5 + Math.random() * 2.5).toFixed(1),
      delay: (-Math.random() * duration).toFixed(2), // negative: starts mid-cycle
      duration: duration.toFixed(2),
    };
  });

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */
export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fadingOut, setFadingOut] = useState(false);
  // Lazy initializers run synchronously during the first render — stars/sparkles
  // exist in the DOM from frame one, not a render cycle later via useEffect.
  const [stars] = useState(() => generateStars(40));
  const [sparkles] = useState(() => generateDots(20));
  const [showFallback, setShowFallback] = useState(true); // static image until sprite ready
  // True only once the cartoon image has actually finished loading (or failed).
  // Ring, character, wordmark and badge all wait on this so they appear together
  // instead of the ring popping in first and the character catching up later.
  const [assetsReady, setAssetsReady] = useState(false);

  // Fade‑out timers — anchored to assetsReady, not mount. If the image takes
  // 800ms to load, the splash still shows the *complete* scene for a full
  // 2s before fading, instead of eating that time out of the display window.
  useEffect(() => {
    if (!assetsReady) return;
    const t1 = setTimeout(() => setFadingOut(true), 1200);
    const t2 = setTimeout(() => onDone(), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [assetsReady, onDone]);

  const stageRef = useRef<HTMLDivElement>(null);
  const threeContainerRef = useRef<HTMLDivElement>(null);

  /* ---------- Mouse parallax ---------- */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 40;
      const y = (e.clientY / window.innerHeight - 0.5) * 40;
      if (stageRef.current) {
        stageRef.current.style.setProperty('--move-x', `${x}px`);
        stageRef.current.style.setProperty('--move-y', `${y}px`);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  /* ---------- Three.js scene (preload + perfect swap) ---------- */
  useEffect(() => {
    const container = threeContainerRef.current;
    if (!container) return;

    let animationId: number;
    let renderer: THREE.WebGLRenderer;
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let sprite: THREE.Sprite;
    let mounted = true;

    // Preload the cartoon image
    const preloadImage = new Image();
    preloadImage.src = '/cartoon.jpg';

    const startScene = () => {
      if (!mounted || !container) return;

      const width = container.clientWidth || 300;
      const height = container.clientHeight || 300;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(0, 0, 5);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
      renderer.setSize(width, height);
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
      scene.add(ambientLight);

      // Create texture from preloaded image (instant)
      const texture = new THREE.Texture(preloadImage);
      texture.needsUpdate = true;
      texture.colorSpace = THREE.SRGBColorSpace;

      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        color: 0xffffff,
      });
      sprite = new THREE.Sprite(material);

      // Maintain aspect ratio to match the fallback image's object-fit: contain
      const imgAspect = preloadImage.naturalWidth / preloadImage.naturalHeight;
      let scaleX = 3.8;
      let scaleY = 3.8;
      if (imgAspect > 1) {
        // wider than tall
        scaleY = scaleX / imgAspect;
      } else {
        scaleX = scaleY * imgAspect;
      }
      sprite.scale.set(scaleX, scaleY, 1);
      sprite.position.set(0, 0, 0);
      scene.add(sprite);

      // Render one frame off‑screen so the canvas is ready
      renderer.render(scene, camera);

      // Append canvas and hide fallback in the same frame – no flicker
      container.appendChild(renderer.domElement);
      setShowFallback(false);
      setAssetsReady(true); // reveal ring + character + wordmark + badge together

      // Start animation loop
      const animate = (time: number) => {
        if (!mounted) return;
        animationId = requestAnimationFrame(animate);
        const floatY = Math.sin(time * 0.002) * 0.15;
        const breathe = 1 + Math.sin(time * 0.003) * 0.02;
        sprite.position.y = floatY;
        sprite.scale.set(scaleX * breathe, scaleY * breathe, 1);
        renderer.render(scene, camera);
      };
      animate(0);

      // Resize handler
      const handleResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (camera && renderer) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      };
      window.addEventListener('resize', handleResize);
    };

    // If image already loaded (cache), start immediately; otherwise wait for load
    if (preloadImage.complete) {
      startScene();
    } else {
      preloadImage.onload = startScene;
      preloadImage.onerror = () => {
        // If image fails, hide fallback and run an empty loop (no character)
        setShowFallback(false);
        setAssetsReady(true); // don't leave the splash stuck hidden if the image 404s
        const animate = () => {
          if (!mounted) return;
          animationId = requestAnimationFrame(animate);
        };
        animate();
      };
    }

    return () => {
      mounted = false;
      cancelAnimationFrame(animationId);
      if (renderer) {
        renderer.dispose();
        if (container && renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  /* ---------- Render ---------- */
  return (
    <>
      {/* Kicks off the image fetch as early as possible (before this
          component's effects even run), shrinking the load window that
          the ring/wordmark/badge below wait on. */}
      <link rel="preload" as="image" href="/cartoon.jpg" fetchPriority="high" />
      <div
        ref={stageRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(120% 90% at 50% 8%, #1d1640 0%, var(--surface, #140f2c) 55%, #0c0820 100%)',
        overflow: 'hidden',
        opacity: fadingOut ? 0 : 1,
        transition: fadingOut ? 'opacity 0.70s cubic-bezier(0.4,0,0.2,1)' : 'none',
        pointerEvents: fadingOut ? 'none' : 'all',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* ---------- All CSS styles ---------- */}
      <style>{`
        :root {
          --surface: #140f2c;
          --surface-elevated: #251B54;
          --on-surface: #e6deff;
          --primary: #ffd700;
          --primary-dim: #e9c400;
          --secondary: #c9bff9;
          --tertiary: #402970;
          --stroke-glass: rgba(255,255,255,0.15);
          --glow-purple: rgba(64,41,112,0.7);
          --text-muted: #B0A9D1;
          --move-x: 0px;
          --move-y: 0px;
        }

        /* ---------- vignette ---------- */
        .vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(50% 50% at 50% 50%, var(--glow-purple) 0%, transparent 80%);
          animation: vigPulse 8s ease-in-out infinite;
          animation-delay: -3s; /* start mid-pulse, not frozen at rest on load */
          mix-blend-mode: screen;
          pointer-events: none;
        }
        @keyframes vigPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.15); }
        }

        /* ---------- stars ---------- */
        .star {
          position: absolute;
          border-radius: 50%;
          background: var(--primary);
          box-shadow: 0 0 8px 2px rgba(255, 215, 0, 0.8);
          animation: twinkle 4s ease-in-out infinite;
        }
        .star.blue { background: #9ec7ff; box-shadow: 0 0 8px 2px rgba(158,199,255,0.8); }
        .star.purple { background: #dcb4ff; box-shadow: 0 0 8px 2px rgba(220,180,255,0.8); }
        @keyframes twinkle {
          0%, 100% { opacity: 0.1; transform: scale(0.4); }
          50% { opacity: 1; transform: scale(1.5); }
        }

        /* ---------- background ---------- */
        /* No container-level fade: ribbons/vignette are static markup, not
           random data, so there's nothing to wait on. Liveliness comes from
           each star/dot's own negative animation-delay (already mid-cycle
           at t=0) instead of a macro opacity ramp that reads as "not there yet". */
        .stars-container, .waves-wrap {
          opacity: 1;
        }

        .stars {
          position: absolute;
          inset: -10%;
          transform: translate(calc(var(--move-x) * 0.3), calc(var(--move-y) * 0.3));
          transition: transform 0.1s ease-out;
        }

        /* ---------- waves ---------- */
        .waves-wrap {
          position: absolute;
          inset: -5%;
          width: 110%;
          height: 110%;
          transform: translate(calc(var(--move-x) * 0.8), calc(var(--move-y) * 0.8));
          transition: transform 0.1s ease-out;
        }
        svg.waves { width: 100%; height: 100%; }
        .ribbon {
          fill: none;
          stroke-width: 3;
          opacity: 0.65;
          stroke-linecap: round;
          filter: drop-shadow(0 0 10px rgba(255,215,0,0.4));
        }
        .ribbon.r1 { stroke: url(#gradGold); animation: drift1 14s linear infinite; animation-delay: -4s; }
        .ribbon.r2 { stroke: url(#gradPurple); animation: drift2 20s linear infinite; stroke-width: 4; animation-delay: -11s; }
        .ribbon.r3 { stroke: url(#gradBlue); animation: drift3 17s linear infinite reverse; animation-delay: -7s; }
        .ribbon.r4 { stroke: url(#gradGold); opacity: 0.4; animation: drift2 25s linear infinite; stroke-width: 2; animation-delay: -18s; }
        @keyframes drift1 {
          0% { transform: translateX(-4%) translateY(0); }
          50% { transform: translateX(3%) translateY(-2%); }
          100% { transform: translateX(-4%) translateY(0); }
        }
        @keyframes drift2 {
          0% { transform: translateX(3%) translateY(0); }
          50% { transform: translateX(-4%) translateY(3%); }
          100% { transform: translateX(3%) translateY(0); }
        }
        @keyframes drift3 {
          0% { transform: translateX(-2%) translateY(0); }
          50% { transform: translateX(5%) translateY(-3%); }
          100% { transform: translateX(-2%) translateY(0); }
        }

        /* sparkle dots */
        .sparkle-dot {
          fill: var(--primary);
          filter: drop-shadow(0 0 4px var(--primary));
          animation: floatDot 4s ease-in-out infinite;
        }
        @keyframes floatDot {
          0%, 100% { opacity: 0.15; transform: translateY(0) scale(0.8); }
          50% { opacity: 1; transform: translateY(-12px) scale(1.2); }
        }

        /* ---------- center layout ---------- */
        .center {
          position: relative;
          z-index: 5;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
          transform: translate(calc(var(--move-x) * -0.5), calc(var(--move-y) * -0.5));
          transition: transform 0.1s ease-out;
        }

        /* ---------- ring ---------- */
        .ring-wrap {
          position: relative;
          width: 320px;
          height: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: scale(0.94);
          transition: opacity 0.4s ease-out, transform 0.4s ease-out;
        }
        .ring-wrap.is-ready {
          opacity: 1;
          transform: scale(1);
        }
        .ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
        }
        .ring svg { width: 100%; height: 100%; }
        .ring .arc {
          fill: none;
          stroke: var(--primary);
          stroke-width: 4;
          stroke-linecap: round;
          filter: drop-shadow(0 0 12px rgba(255,215,0,0.9));
          animation: arcDash 4s linear infinite;
        }
        @keyframes arcDash {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -860; }
        }
        .ring.spin { animation: spin 12s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .ring-glow {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,215,0,0.25) 0%, rgba(139,92,246,0.15) 40%, transparent 70%);
          box-shadow: 0 0 50px 20px rgba(139,92,246,0.2);
          animation: glowBreathe 4s ease-in-out infinite;
        }
        @keyframes glowBreathe {
          0%, 100% { opacity: 0.6; transform: scale(0.92); }
          50% { opacity: 1; transform: scale(1.08); box-shadow: 0 0 70px 30px rgba(255,215,0,0.25); }
        }

        .ring-blue {
          position: absolute;
          inset: -15px;
          border-radius: 50%;
          border: 2px solid rgba(59, 130, 246, 0.5);
          box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
          animation: bluePulse 3s ease-in-out infinite;
        }
        @keyframes bluePulse {
          0%, 100% { transform: scale(0.9); opacity: 0.3; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }

        /* ---------- entrance text/badge ---------- */
        /* No auto animation-delay from mount anymore — that's what caused the
           ring/text/badge to settle in before the character image was even
           loaded. Both now stay hidden until .is-ready is applied, which
           happens at the same moment as the ring-wrap, so everything in the
           splash appears together regardless of how long the image took. */
        .entrance-text {
          opacity: 0;
          transform: translateY(20px);
        }
        .entrance-text.is-ready {
          animation: fadeInUp 0.5s ease-out forwards;
        }
        .entrance-badge {
          opacity: 0;
          transform: translateY(20px);
        }
        .entrance-badge.is-ready {
          animation: fadeInUp 0.5s ease-out forwards;
        }
        @keyframes fadeInUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* ---------- wordmark ---------- */
        .wordmark {
          font-family: 'Montserrat', sans-serif;
          font-weight: 700;
          font-size: 54px;
          letter-spacing: 0.06em;
          color: var(--on-surface);
          text-shadow: 0 0 20px rgba(230,222,255,0.5), 0 4px 10px rgba(0,0,0,0.4);
          position: relative;
          display: inline-block;
          overflow: hidden;
        }
        .shimmer-effect {
          position: absolute;
          top: 0;
          left: -150%;
          width: 60%;
          height: 100%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.7), transparent);
          mix-blend-mode: overlay;
          animation: shimmerSlide 3s ease-out forwards;
        }
        @keyframes shimmerSlide {
          0% { left: -150%; }
          100% { left: 160%; }
        }

        /* ---------- badge ---------- */
        .badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.08);
          border: 1px solid var(--stroke-glass);
          font-size: 14px;
          color: var(--text-muted);
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .badge b {
          color: var(--on-surface);
          font-weight: 600;
        }
        .badge .mark {
          width: 14px;
          height: 14px;
          border-radius: 3px;
          background: conic-gradient(from 90deg, #2d9be0, #ffd700, #2d9be0);
          animation: markSpin 4s linear infinite;
          box-shadow: 0 0 8px rgba(255,215,0,0.4);
        }
        @keyframes markSpin { to { transform: rotate(360deg); } }
      `}</style>

      {/* -------- Background wrapper (stars + waves fade in via CSS only) -------- */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <div className="vignette" />

        <div className="stars-container">
          <div className="stars">
            {stars.map((s) => (
              <div
                key={s.id}
                className={`star${s.type}`}
                style={{
                  left: `${s.left}%`,
                  top: `${s.top}%`,
                  width: `${s.size}px`,
                  height: `${s.size}px`,
                  animationDelay: `${s.delay}s`,
                  animationDuration: `${s.duration}s`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="waves-wrap">
          <svg className="waves" preserveAspectRatio="none" viewBox="0 0 1057 992">
            <defs>
              <linearGradient id="gradGold" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#ffd700" stopOpacity="0" />
                <stop offset="50%" stopColor="#ffe46b" stopOpacity="1" />
                <stop offset="100%" stopColor="#ffd700" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gradPurple" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
                <stop offset="50%" stopColor="#dcb4ff" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gradBlue" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#3a7bd5" stopOpacity="0" />
                <stop offset="50%" stopColor="#9ec7ff" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#3a7bd5" stopOpacity="0" />
              </linearGradient>
            </defs>

            <path className="ribbon r1" d="M -100 560 C 150 480, 320 660, 560 560 S 900 460, 1150 540" />
            <path className="ribbon r2" d="M -100 620 C 200 700, 380 520, 600 620 S 950 700, 1150 600" />
            <path className="ribbon r3" d="M -100 500 C 220 420, 420 560, 650 480 S 980 400, 1150 470" />
            <path className="ribbon r4" d="M -100 660 C 180 600, 360 720, 600 660 S 940 600, 1150 660" />

            <g>
              {sparkles.map((d) => (
                <circle
                  key={d.id}
                  className="sparkle-dot"
                  cx={d.cx}
                  cy={d.cy}
                  r={d.r}
                  style={{
                    animationDelay: `${d.delay}s`,
                    animationDuration: `${d.duration}s`,
                  }}
                />
              ))}
            </g>
          </svg>
        </div>
      </div>

      {/* -------- Center content (ring, character, text) -------- */}
      <div className="center">
        <div className={`ring-wrap${assetsReady ? ' is-ready' : ''}`}>
          <div className="ring spin">
            <svg viewBox="0 0 300 300">
              <circle className="arc" cx="150" cy="150" r="138" strokeDasharray="240 620" />
            </svg>
          </div>
          <div className="ring-glow" />
          <div className="ring-blue" />

          <div
            ref={threeContainerRef}
            style={{
              width: 300,
              height: 300,
              background: 'transparent',
              position: 'relative',
              zIndex: 10,
            }}
          >
            {showFallback && (
              <img
                src="/cartoon.jpg"
                alt="TARA character"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  zIndex: 1,
                }}
              />
            )}
          </div>
        </div>

        <div className={`wordmark entrance-text${assetsReady ? ' is-ready' : ''}`}>
          TARA
          <div className="shimmer-effect" />
        </div>

        <div className={`badge entrance-badge${assetsReady ? ' is-ready' : ''}`}>
          Powered by{' '}
          <img
            alt="Kapruka"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuB4z0uxxlgf9V_oZNfE-2pb6JeDFokXEOkcaKQUrYDsEhpXgGeKuOwduvh4shOT4KZ_bSevYBsvaZHy7CboZgtNPy2u-rpPIrjanqD1Jl-jYdKY0lkHabBrtBD7pOsySNpU5ioDDWKvJW06M1g2Fm-6WNdVTdkFwGzGr-SGZ7TklRethQzLHoqmiAF7WDycwr6oXY9YxjRr3ndfZndVX483U1MvThzLUvL_ioIGd01csnLbhJCc52Ie9ZnqvwJwZTF3BAogk9MQ6-jS"
            style={{ width: 14, height: 14, borderRadius: 3, objectFit: 'cover' }}
          />{' '}
          <b>Kapruka</b>
        </div>
      </div>
      </div>
    </>
  );
}