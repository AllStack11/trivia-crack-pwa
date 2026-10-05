import { useReducedMotion } from 'motion/react';
import { Crown } from 'lucide-react';
import type { Category } from '../../../../shared/src/index';
import { CHARACTER_PROFILES } from './characterData';

export type CharacterMood = 'idle' | 'happy' | 'thinking' | 'worried' | 'defeated' | 'celebrating';

export interface CategoryCharacterProps {
  category: Category;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  mood?: CharacterMood;
  showCrown?: boolean;
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizes = {
  xs: 'w-7 h-7',
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-36 h-36',
  '2xl': 'w-48 h-48',
};

export default function CategoryCharacter({
  category,
  size = 'md',
  mood = 'idle',
  showCrown = false,
  interactive = false,
  className = '',
  onClick,
}: CategoryCharacterProps) {
  const reduced = useReducedMotion();
  const profile = CHARACTER_PROFILES[category];

  let animClass = '';
  if (!reduced) {
    if (mood === 'celebrating') animClass = 'mascot-anim-celebrating';
    else if (mood === 'thinking') animClass = 'mascot-anim-thinking';
    else if (mood === 'happy') animClass = 'mascot-anim-happy';
  }

  const art = (
    <>
      <img
        src={`/art/${category.toLowerCase()}.webp`}
        alt={`${profile.name}, ${profile.title}`}
        draggable={false}
        loading="lazy"
        decoding="async"
        className={`w-full h-full object-contain drop-shadow-sm pointer-events-none ${animClass}`}
        style={{ filter: mood === 'defeated' ? 'grayscale(.7)' : undefined }}
      />
      {showCrown && (
        <Crown
          className="absolute -top-2 left-1/2 -translate-x-1/2 w-[35%] h-[35%] text-amber-600 fill-yellow-300 pointer-events-none"
          aria-label="Crown earned"
        />
      )}
    </>
  );

  const cls = `relative inline-flex items-center justify-center shrink-0 ${sizes[size]} ${className}`;
  return interactive || onClick ? (
    <button
      type="button"
      aria-label={`Meet ${profile.name}`}
      onClick={onClick}
      className={`${cls} active:scale-95 transition-transform duration-100 touch-manipulation`}
    >
      {art}
    </button>
  ) : (
    <span className={cls}>{art}</span>
  );
}
