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
        speed={0.4}
        
        // BALANCED SETTINGS: 
        // minPixelRatio={1} ensures sharp edges on all screens.
        // maxPixelCount={800 * 800} provides 4x more rendering data than the previous version
        // while remaining significantly lighter than the default 4K+ resolution.
        minPixelRatio={1} 
        maxPixelCount={800 * 800} 
        
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