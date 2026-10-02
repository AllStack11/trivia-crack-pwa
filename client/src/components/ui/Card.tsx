import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

export interface CardProps extends HTMLMotionProps<'div'> {
  variant?: 'glass' | 'solid' | 'accent' | 'glow';
  interactive?: boolean;
  glowColor?: string;
  children?: React.ReactNode;
}

export default function Card({
  variant = 'glass',
  interactive = false,
  glowColor,
  children,
  className = '',
  ...rest
}: CardProps) {
  let baseStyle = 'relative rounded-3xl overflow-hidden transition-all duration-200 ';

  switch (variant) {
    case 'glass':
      baseStyle += 'bg-slate-900/80 backdrop-blur-2xl border border-white/10 shadow-2xl ';
      break;
    case 'solid':
      baseStyle += 'bg-slate-900 border border-slate-800 shadow-xl ';
      break;
    case 'accent':
      baseStyle += 'bg-gradient-to-b from-indigo-950/70 via-slate-900/90 to-slate-950 border border-indigo-500/30 shadow-2xl ';
      break;
    case 'glow':
      baseStyle += 'bg-slate-900/90 backdrop-blur-2xl border border-amber-400/40 shadow-2xl shadow-amber-500/10 ';
      break;
  }

  return (
    <motion.div
      whileHover={interactive ? { y: -3, scale: 1.01, transition: { duration: 0.2 } } : undefined}
      whileTap={interactive ? { scale: 0.99 } : undefined}
      className={`${baseStyle} ${interactive ? 'cursor-pointer' : ''} ${className}`}
      style={glowColor ? { boxShadow: `0 0 35px ${glowColor}` } : undefined}
      {...rest}
    >
      {/* Top subtle highlight sheen */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
      {children}
    </motion.div>
  );
}
