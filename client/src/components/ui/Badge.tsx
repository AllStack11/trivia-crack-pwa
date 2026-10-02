import React from 'react';
import type { Category } from '../../../../shared/src/index';
import { CATEGORIES } from '../../../../shared/src/index';

export interface BadgeProps {
  variant?: 'default' | 'gold' | 'category' | 'turn' | 'danger' | 'success';
  category?: Category;
  pulse?: boolean;
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

export default function Badge({
  variant = 'default',
  category,
  pulse = false,
  size = 'sm',
  children,
  className = ''
}: BadgeProps) {
  let styleClasses = 'inline-flex items-center font-bold tracking-wide rounded-full border shadow-sm select-none ';

  if (size === 'sm') {
    styleClasses += 'px-2 py-0.5 text-[10px] gap-1 ';
  } else {
    styleClasses += 'px-3 py-1 text-xs gap-1.5 ';
  }

  const categoryInfo = category ? CATEGORIES[category] : undefined;

  switch (variant) {
    case 'gold':
      styleClasses += 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-yellow-300 border-amber-400/40 shadow-amber-500/10 ';
      break;
    case 'turn':
      styleClasses += 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-emerald-500/10 ';
      break;
    case 'danger':
      styleClasses += 'bg-red-500/20 text-red-300 border-red-400/40 shadow-red-500/10 ';
      break;
    case 'success':
      styleClasses += 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 ';
      break;
    case 'category':
      if (categoryInfo) {
        return (
          <span
            className={`${styleClasses} ${className}`}
            style={{
              backgroundColor: `${categoryInfo.color}25`,
              color: '#FFFFFF',
              borderColor: `${categoryInfo.color}60`
            }}
          >
            {pulse && (
              <span
                className="w-1.5 h-1.5 rounded-full animate-ping"
                style={{ backgroundColor: categoryInfo.color }}
              />
            )}
            {children}
          </span>
        );
      }
      styleClasses += 'bg-slate-800 text-slate-300 border-slate-700 ';
      break;
    case 'default':
    default:
      styleClasses += 'bg-slate-800/80 text-slate-300 border-slate-700/80 ';
      break;
  }

  return (
    <span className={`${styleClasses} ${className}`}>
      {pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />}
      {children}
    </span>
  );
}
