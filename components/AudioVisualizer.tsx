'use client';
import { useEffect, useRef } from 'react';

const BARS = 12;

export default function AudioVisualizer({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const w = canvas.width, h = canvas.height;
    const barWidth = 3, gap = 2;
    const step = Math.max(1, Math.floor(data.length / BARS));

    // Canvas fillStyle can't resolve var(--c-*) itself — read the computed values once.
    const cs = getComputedStyle(canvas);
    const colorA = cs.getPropertyValue('--c-primary-container').trim() || '#bd93f9';
    const colorB = cs.getPropertyValue('--c-secondary').trim() || '#c5cd65';

    const draw = () => {
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < BARS; i++) {
        const v = data[i * step] ?? 0;
        const barH = Math.max(2, (v / 255) * h);
        const x = i * (barWidth + gap);
        const y = (h - barH) / 2;
        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, colorA);
        grad.addColorStop(1, colorB);
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, barH);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [analyser]);

  return <canvas ref={canvasRef} width={80} height={32} style={{ width: 80, height: 32 }} />;
}
