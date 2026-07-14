'use client';
import React from 'react';
import { GrainGradient } from '@paper-design/shaders-react';

function TaraBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        transform: 'translateZ(0)',
        willChange: 'transform',
      }}
    >
      <GrainGradient
        colorBack="#100b1f"
        colors={[
          '#FAE555',
          '#9B8FB4',
          '#411478',
        ]}
        noise={0.38}
        intensity={0.65}
        softness={0.85}
        shape="blob"
        speed={0.25}

        // REDUCED for performance: lower pixel count + lower min pixel ratio
        // cuts GPU fill rate by ~4x vs previous 800*800 setting.
        // Visual effect is nearly identical — just slightly softer edges.
        minPixelRatio={0.5}
        maxPixelCount={400 * 400}

        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </div>
  );
}

export default React.memo(TaraBackground);