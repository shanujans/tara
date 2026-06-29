'use client';
import { GrainGradient } from '@paper-design/shaders-react';

/**
 * TaraBackground — grain-gradient background.
 * Props confirmed from @paper-design/shaders package types:
 *   colorBack: string        — base background color
 *   colors: string[]         — up to 7 gradient band colors
 *   noise: number            — grain intensity (0–1)
 *   intensity: number        — distortion between color bands (0–1)
 *   softness: number         — band edge softness (0–1)
 *   shape: GrainGradientShape — 'wave'|'blob'|'ripple'|'dots'|'truchet'|'corners'|'sphere'
 *   speed: number            — animation speed
 */
export default function TaraBackground() {
  return (
    <GrainGradient
      colorBack="#100b1f"
      colors={[
        '#FAE555',   // warm yellow  (was light blue)
        '#9B8FB4',   // muted lavender (was dark blue)
        '#411478',   // Lumina primary deep purple — gives depth
      ]}
      noise={0.38}
      intensity={0.65}
      softness={0.85}
      shape="blob"
      speed={0.4}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
}