import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { playButtonPop } from '../../utils/audio';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'success' | 'ghost' | 'glass';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  glow?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black shadow-lg shadow-amber-500/25 border border-yellow-300/60 hover:brightness-110 active:brightness-95',
  accent: 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-white font-bold shadow-lg shadow-indigo-600/30 border border-indigo-400/50 hover:brightness-110 active:brightness-95',
  secondary: 'bg-slate-800/80 hover:bg-slate-750 text-slate-200 font-bold border border-slate-700/80 shadow-md backdrop-blur-md',
  success: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-600/25 border border-emerald-400/50 hover:brightness-110',
  danger: 'bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold shadow-lg shadow-red-600/25 border border-red-400/50 hover:brightness-110',
  ghost: 'bg-transparent hover:bg-white/10 text-slate-300 hover:text-white border border-transparent font-medium',
  glass: 'bg-white/10 hover:bg-white/15 text-white font-bold border border-white/20 backdrop-blur-xl shadow-lg'
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-xl gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-2xl gap-2',
  lg: 'px-6 py-3.5 text-base rounded-2xl gap-2.5 font-black tracking-wide',
  icon: 'w-10 h-10 p-0 rounded-2xl flex items-center justify-center'
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  glow = false,
  icon,
  children,
  className = '',
  disabled,
  onClick,
  ...rest
}: ButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    playButtonPop();
    onClick?.(e);
  };

  return (
    <motion.button
      whileHover={disabled || loading ? undefined : { scale: 1.02, y: -1 }}
      whileTap={disabled || loading ? undefined : { scale: 0.96, y: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      disabled={disabled || loading}
      onClick={handleClick}
      className={`relative inline-flex items-center justify-center select-none outline-none transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${glow ? 'ring-2 ring-amber-400/50 shadow-amber-500/40 shadow-xl' : ''} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Loading…</span>
        </span>
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </motion.button>
  );
}
