import { useMemo } from 'react';
import { motion } from 'motion/react';
import type { Category } from '../../../../shared/src/index';
import { CATEGORIES } from '../../../../shared/src/index';

interface AnimatedBackgroundProps {
  activeCategory?: Category | null;
  intensity?: 'subtle' | 'vibrant';
}

interface StarParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
}

export default function AnimatedBackground({
  activeCategory = null,
  intensity = 'vibrant'
}: AnimatedBackgroundProps) {
  // Category-specific reactive highlight color
  const reactiveColor = activeCategory
    ? CATEGORIES[activeCategory]?.color || '#6366F1'
    : '#6366F1';

  // Deterministic floating star particles to avoid layout shifts
  const stars: StarParticle[] = useMemo(() => {
    const starColors = ['#FFFFFF', '#93C5FD', '#FDE047', '#C4B5FD', '#F472B6'];
    const count = intensity === 'vibrant' ? 24 : 14;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: (i * 41 + 17) % 100,
      y: (i * 37 + 23) % 100,
      size: (i % 3) + 1.5,
      duration: 3 + (i % 5) * 1.2,
      delay: (i % 4) * 0.8,
      color: starColors[i % starColors.length]
    }));
  }, [intensity]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none bg-[#070B14]">
      {/* 1. Deep Cosmic Radial Gradient */}
      <div className="absolute inset-0 bg-radial-[circle_at_50%_40%] from-indigo-950/40 via-[#070B14] to-[#04060B]" />

      {/* 2. Floating Nebula Blob 1 (Top Left - Indigo/Violet) */}
      <motion.div
        animate={{
          x: [0, 40, -20, 0],
          y: [0, -30, 20, 0],
          scale: [1, 1.15, 0.95, 1],
          opacity: [0.35, 0.5, 0.35]
        }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full blur-[100px] bg-indigo-600/30"
      />

      {/* 3. Floating Nebula Blob 2 (Bottom Right - Amber/Gold or Reactive Category) */}
      <motion.div
        animate={{
          x: [0, -40, 30, 0],
          y: [0, 40, -30, 0],
          scale: [1, 1.2, 0.9, 1],
          opacity: [0.3, 0.45, 0.3]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-36 -right-36 w-[520px] h-[520px] rounded-full blur-[110px]"
        style={{
          backgroundColor: activeCategory ? reactiveColor : '#F59E0B',
          opacity: 0.25
        }}
      />

      {/* 4. Center Reactive Accent Nebula (Smooth Color Transitions) */}
      <motion.div
        animate={{
          scale: [1, 1.08, 1],
          opacity: activeCategory ? [0.28, 0.42, 0.28] : [0.12, 0.2, 0.12]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full blur-[120px] transition-colors duration-1000"
        style={{
          backgroundColor: reactiveColor
        }}
      />

      {/* 5. Geometric Subtle Starfield Grid Overlay */}
      <svg
        className="absolute inset-0 w-full h-full opacity-10"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="bg-grid-pattern" width="48" height="48" patternUnits="userSpaceOnUse">
            <circle cx="24" cy="24" r="1" fill="#FFFFFF" opacity="0.4" />
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#FFFFFF" strokeWidth="0.5" opacity="0.15" />
          </pattern>
          <radialGradient id="grid-mask-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.2" />
            <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.1" />
          </radialGradient>
          <mask id="grid-mask">
            <rect width="100%" height="100%" fill="url(#grid-mask-grad)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg-grid-pattern)" mask="url(#grid-mask)" />
      </svg>

      {/* 6. Twinkling & Rising Micro Star Particles */}
      <div className="absolute inset-0">
        {stars.map((star) => (
          <motion.div
            key={star.id}
            initial={{ opacity: 0.2 }}
            animate={{
              opacity: [0.15, 0.85, 0.15],
              y: [0, -18, 0],
              scale: [0.85, 1.25, 0.85]
            }}
            transition={{
              duration: star.duration,
              repeat: Infinity,
              delay: star.delay,
              ease: 'easeInOut'
            }}
            className="absolute rounded-full shadow-sm"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              backgroundColor: star.color,
              boxShadow: `0 0 ${star.size * 2}px ${star.color}`
            }}
          />
        ))}
      </div>

      {/* 7. Subtle Corner Vignette */}
      <div className="absolute inset-0 bg-radial-[circle_at_50%_50%] from-transparent via-transparent to-black/60 pointer-events-none" />
    </div>
  );
}
