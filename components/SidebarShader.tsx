'use client';
import { motion } from 'motion/react';
import { memo } from 'react';

/* =====================================================================
   Sidebar background — floating paths, exact animation pattern from
   https://21st.dev/community/components/bundui/floating-paths/default

   - Background: exact colorBack from TaraBackground.tsx (#100b1f)
   - Lines: alternate between the two Lumina accent colors (#FAE555 / #402970)
   - Tuned for visibility: faster loop, single opacity driver, full-bleed stretch
   ===================================================================== */

function buildPaths(position: number) {
  return Array.from({ length: 18 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    color: i % 2 === 0 ? '#FAE555' : '#402970',
    width: 0.7 + i * 0.05,
  }));
}

// Module-level — paths and durations are computed once, not per render
const PATHS = buildPaths(-1);
const DURATIONS = Array.from({ length: 18 }, () => 5 + Math.random() * 5);

const SidebarShader = memo(function SidebarShader() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#100b1f',
      }}
    >
      <svg
        viewBox="0 0 696 316"
        preserveAspectRatio="none"
        fill="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        {PATHS.map((path, i) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke={path.color}
            strokeWidth={path.width}
            initial={{ pathLength: 0.3, opacity: 0.5 }}
            animate={{
              pathLength: [0.3, 1, 0.3],
              opacity: [0.35, 1, 0.35],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: DURATIONS[i],
              repeat: Number.POSITIVE_INFINITY,
              ease: 'linear',
            }}
          />
        ))}
      </svg>
    </div>
  );
});

export default SidebarShader;