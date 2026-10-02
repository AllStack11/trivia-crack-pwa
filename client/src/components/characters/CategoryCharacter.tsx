import { useId } from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
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

const SIZE_MAP = {
  xs: 'w-7 h-7',
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-36 h-36',
  '2xl': 'w-48 h-48'
};

export default function CategoryCharacter({
  category,
  size = 'md',
  mood = 'idle',
  showCrown = false,
  interactive = false,
  className = '',
  onClick
}: CategoryCharacterProps) {
  const profile = CHARACTER_PROFILES[category] || CHARACTER_PROFILES.ART;
  const uid = useId().replace(/:/g, '');

  // Floating animation based on mood
  const getMotionAnimation = () => {
    switch (mood) {
      case 'celebrating':
        return {
          y: [0, -10, 0, -8, 0],
          rotate: [0, -3, 3, -2, 0],
          scale: [1, 1.05, 1, 1.04, 1],
          transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' as const }
        };
      case 'worried':
        return {
          x: [-2, 2, -2, 2, 0],
          y: [0, 1, 0, 1, 0],
          transition: { duration: 0.4, repeat: Infinity, ease: 'linear' as const }
        };
      case 'thinking':
        return {
          rotate: [-2, 2, -2],
          y: [0, -3, 0],
          transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' as const }
        };
      case 'defeated':
        return {
          y: [4, 6, 4],
          rotate: [2, 3, 2],
          filter: 'grayscale(0.35)',
          transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const }
        };
      case 'happy':
        return {
          y: [0, -6, 0],
          scale: [1, 1.03, 1],
          transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' as const }
        };
      case 'idle':
      default:
        return {
          y: [0, -4, 0],
          transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' as const }
        };
    }
  };

  const containerProps: HTMLMotionProps<'div'> = {
    animate: getMotionAnimation(),
    whileHover: interactive ? { scale: 1.08, rotate: 2, transition: { duration: 0.2 } } : undefined,
    whileTap: interactive ? { scale: 0.94 } : undefined,
    onClick,
    className: `relative inline-flex items-center justify-center select-none ${SIZE_MAP[size]} ${interactive ? 'cursor-pointer' : ''} ${className}`
  };

  return (
    <motion.div {...containerProps}>
      {/* Ambient background glow ring */}
      <div
        className="absolute inset-0 rounded-full blur-md opacity-40 transition-opacity duration-300 pointer-events-none"
        style={{ backgroundColor: profile.color }}
      />

      {/* Main Character SVG */}
      <svg
        viewBox="0 0 120 120"
        className="w-full h-full relative z-10 drop-shadow-lg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id={`grad-skin-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE0BD" />
            <stop offset="100%" stopColor="#F6C391" />
          </linearGradient>

          <linearGradient id={`grad-bg-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={profile.color} />
            <stop offset="100%" stopColor={profile.accentColor} />
          </linearGradient>

          <radialGradient id={`glow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
            <stop offset="100%" stopColor={profile.color} stopOpacity="0" />
          </radialGradient>

          <filter id={`shadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="rgba(0,0,0,0.35)" />
          </filter>
        </defs>

        {/* Circular Medallion Backing */}
        <circle cx="60" cy="60" r="54" fill={`url(#grad-bg-${uid})`} filter={`url(#shadow-${uid})`} />
        <circle cx="60" cy="60" r="53" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
        <circle cx="60" cy="60" r="50" fill={`url(#glow-${uid})`} />

        {/* CHARACTER SPECIFIC ARTWORK */}
        {category === 'ART' && (
          <g id="arthur-art">
            {/* Beret */}
            <path
              d="M32 40 C34 22, 78 18, 88 34 C94 44, 76 50, 48 48 Z"
              fill="#991B1B"
              filter={`url(#shadow-${uid})`}
            />
            <circle cx="62" cy="22" r="3.5" fill="#EF4444" />
            {/* Face */}
            <circle cx="60" cy="62" r="24" fill={`url(#grad-skin-${uid})`} />
            {/* Cheeks */}
            <ellipse cx="46" cy="67" rx="4" ry="2.5" fill="#F87171" opacity="0.6" />
            <ellipse cx="74" cy="67" rx="4" ry="2.5" fill="#F87171" opacity="0.6" />
            {/* Eyes */}
            {mood === 'worried' ? (
              <>
                <circle cx="51" cy="59" r="3" fill="#1E293B" />
                <circle cx="69" cy="59" r="3" fill="#1E293B" />
                <path d="M47 54 L55 56" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
                <path d="M73 54 L65 56" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
              </>
            ) : mood === 'thinking' ? (
              <>
                <circle cx="53" cy="57" r="3.2" fill="#1E293B" />
                <circle cx="71" cy="57" r="3.2" fill="#1E293B" />
                <path d="M47 53 Q51 51 55 54" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
                <path d="M65 54 Q69 51 73 53" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
              </>
            ) : (
              <>
                <circle cx="50" cy="60" r="3.5" fill="#1E293B" />
                <circle cx="70" cy="60" r="3.5" fill="#1E293B" />
                <circle cx="51.5" cy="58.5" r="1.2" fill="#FFFFFF" />
                <circle cx="71.5" cy="58.5" r="1.2" fill="#FFFFFF" />
              </>
            )}
            {/* Arthur's Signature Dapper Mustache */}
            <path
              d="M48 70 C52 74, 58 72, 60 70 C62 72, 68 74, 72 70 C75 66, 68 66, 60 68 C52 66, 45 66, 48 70 Z"
              fill="#78350F"
            />
            {/* Smile / Mouth */}
            <path d="M56 75 Q60 78 64 75" stroke="#78350F" strokeWidth="2" strokeLinecap="round" />
            {/* Palette with Paint Dots */}
            <g transform="translate(18, 70)">
              <ellipse cx="14" cy="14" rx="14" ry="11" fill="#FEF08A" stroke="#CA8A04" strokeWidth="1.5" />
              <circle cx="16" cy="18" r="3.5" fill="#F8FAFC" />
              {/* Paint Dabs */}
              <circle cx="7" cy="10" r="2.5" fill="#EF4444" />
              <circle cx="13" cy="7" r="2.5" fill="#3B82F6" />
              <circle cx="20" cy="10" r="2.5" fill="#10B981" />
              <circle cx="22" cy="16" r="2.5" fill="#EC4899" />
            </g>
            {/* Paintbrush */}
            <path d="M84 62 L102 44" stroke="#D97706" strokeWidth="3" strokeLinecap="round" />
            <path d="M82 64 L86 60" stroke="#94A3B8" strokeWidth="4" />
            <path d="M79 67 Q83 67 82 64 Q80 62 79 67 Z" fill="#EF4444" />
          </g>
        )}

        {category === 'SCIENCE' && (
          <g id="albert-science">
            {/* Wild Einstein/Professor Hair */}
            <path
              d="M28 62 C22 52, 26 34, 38 28 C42 16, 56 16, 64 20 C72 14, 88 18, 92 30 C102 36, 102 54, 94 66 C98 56, 88 44, 84 48 C82 32, 60 30, 48 38 C40 40, 32 50, 28 62 Z"
              fill="#E2E8F0"
              filter={`url(#shadow-${uid})`}
            />
            {/* Face */}
            <circle cx="60" cy="64" r="23" fill={`url(#grad-skin-${uid})`} />
            {/* Round Goggles with Glowing Lenses */}
            <circle cx="48" cy="62" r="10" fill="#064E3B" stroke="#FDE047" strokeWidth="2.5" />
            <circle cx="72" cy="62" r="10" fill="#064E3B" stroke="#FDE047" strokeWidth="2.5" />
            <path d="M58 62 L62 62" stroke="#FDE047" strokeWidth="3" />
            {/* Goggle Lens Glow and Glint */}
            <circle cx="48" cy="62" r="7.5" fill="#34D399" opacity="0.85" />
            <circle cx="72" cy="62" r="7.5" fill="#34D399" opacity="0.85" />
            <path d="M44 57 L47 57 M43 60 L49 60" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M68 57 L71 57 M67 60 L73 60" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
            {/* Cute Scientist Smile */}
            <path d="M54 77 Q60 82 66 77" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
            {/* Lab Beaker with Bubbling Potion */}
            <g transform="translate(80, 68)">
              <path d="M6 2 L14 2 M9 2 L9 8 L3 20 C2 22, 4 24, 7 24 L13 24 C16 24, 18 22, 17 20 L11 8 L11 2" stroke="#E2E8F0" strokeWidth="1.8" fill="none" />
              <path d="M4 18 L16 18 L14 23 C13 23.5, 7 23.5, 6 23 Z" fill="#10B981" />
              {/* Bubbles */}
              <circle cx="10" cy="14" r="1.5" fill="#6EE7B7" />
              <circle cx="7" cy="11" r="1" fill="#6EE7B7" />
              <circle cx="11" cy="6" r="1.2" fill="#A7F3D0" />
            </g>
            {/* Orbiting Atom Rings */}
            <ellipse cx="60" cy="64" rx="38" ry="12" stroke="#A7F3D0" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" transform="rotate(-25 60 64)" />
            <circle cx="30" cy="50" r="2.5" fill="#34D399" />
          </g>
        )}

        {category === 'SPORTS' && (
          <g id="bonzo-sports">
            {/* Athletic Head */}
            <circle cx="60" cy="62" r="24" fill={`url(#grad-skin-${uid})`} />
            {/* Champion Headband */}
            <path d="M36 50 Q60 44 84 50 L84 56 Q60 50 36 56 Z" fill="#F97316" filter={`url(#shadow-${uid})`} />
            <path d="M57 48 L61 52 L65 48" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {/* Energetic Eyebrows & Eyes */}
            <path d="M45 56 L55 58" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M75 56 L65 58" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
            {mood === 'defeated' ? (
              <>
                <path d="M48 64 L54 62 M48 62 L54 64" stroke="#1E293B" strokeWidth="2" />
                <path d="M66 64 L72 62 M66 62 L72 64" stroke="#1E293B" strokeWidth="2" />
              </>
            ) : (
              <>
                <circle cx="51" cy="63" r="3.5" fill="#1E293B" />
                <circle cx="69" cy="63" r="3.5" fill="#1E293B" />
                <circle cx="52.5" cy="61.5" r="1.2" fill="#FFFFFF" />
                <circle cx="70.5" cy="61.5" r="1.2" fill="#FFFFFF" />
              </>
            )}
            {/* Winning Broad Grin */}
            <path d="M50 72 Q60 82 70 72 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.5" />
            {/* Golden Championship Whistle */}
            <path d="M58 84 L64 84 L67 87 L67 89 L62 89 L60 86 Z" fill="#FBBF24" stroke="#D97706" strokeWidth="1" />
            <path d="M60 84 Q56 78 50 78" stroke="#EF4444" strokeWidth="1.5" fill="none" />
            {/* Trophy on Right Shoulder */}
            <g transform="translate(82, 58)">
              <path d="M4 4 L14 4 L12 12 Q9 16 9 18 L13 22 L5 22 L9 18 Q9 16 6 12 Z" fill="#FBBF24" stroke="#D97706" strokeWidth="1" />
              <path d="M4 6 C1 6, 1 10, 5 11" stroke="#FBBF24" strokeWidth="1.5" fill="none" />
              <path d="M14 6 C17 6, 17 10, 13 11" stroke="#FBBF24" strokeWidth="1.5" fill="none" />
              <polygon points="9,6 10,8 12,8 10.5,9.5 11,11.5 9,10 7,11.5 7.5,9.5 6,8 8,8" fill="#FFFFFF" />
            </g>
          </g>
        )}

        {category === 'ENTERTAINMENT' && (
          <g id="pop-entertainment">
            {/* Stylish Voluminous Hair */}
            <path
              d="M30 52 C24 32, 48 18, 60 18 C72 18, 96 32, 90 52 C96 64, 88 78, 86 80 C82 66, 80 50, 78 46 C60 40, 48 44, 40 50 C38 60, 36 74, 34 80 C32 76, 26 62, 30 52 Z"
              fill="#831843"
              filter={`url(#shadow-${uid})`}
            />
            {/* Face */}
            <circle cx="60" cy="62" r="23" fill={`url(#grad-skin-${uid})`} />
            {/* Star-Shaped Hollywood Sunglasses */}
            <g transform="translate(0, 2)">
              {/* Left Star Lens */}
              <polygon
                points="49,50 51.5,56 57.5,56 52.5,59.5 54.5,65.5 49,62 43.5,65.5 45.5,59.5 40.5,56 46.5,56"
                fill="#DB2777"
                stroke="#FDF2F8"
                strokeWidth="1.5"
              />
              {/* Right Star Lens */}
              <polygon
                points="71,50 73.5,56 79.5,56 74.5,59.5 76.5,65.5 71,62 65.5,65.5 67.5,59.5 62.5,56 68.5,56"
                fill="#DB2777"
                stroke="#FDF2F8"
                strokeWidth="1.5"
              />
              <path d="M55 58 L65 58" stroke="#FDF2F8" strokeWidth="2" />
            </g>
            {/* Glamorous Lip Smile */}
            <path d="M52 75 Q60 82 68 75 Q60 78 52 75 Z" fill="#F43F5E" />
            {/* Vintage Golden Microphone */}
            <g transform="translate(18, 66)">
              <rect x="6" y="8" width="8" height="12" rx="4" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1" />
              <line x1="6" y1="12" x2="14" y2="12" stroke="#64748B" strokeWidth="1" />
              <line x1="6" y1="16" x2="14" y2="16" stroke="#64748B" strokeWidth="1" />
              <path d="M4 14 C4 18, 16 18, 16 14" stroke="#64748B" strokeWidth="1.5" fill="none" />
              <line x1="10" y1="18" x2="10" y2="24" stroke="#64748B" strokeWidth="2" />
            </g>
            {/* Hollywood Star Glints */}
            <polygon points="96,28 98,33 103,33 99,36 100.5,41 96,38 91.5,41 93,36 89,33 94,33" fill="#FDE047" opacity="0.9" />
          </g>
        )}

        {category === 'GEOGRAPHY' && (
          <g id="tina-geography">
            {/* Pith Explorer Hat */}
            <ellipse cx="60" cy="46" rx="34" ry="11" fill="#CA8A04" filter={`url(#shadow-${uid})`} />
            <path d="M38 46 C38 28, 82 28, 82 46 Z" fill="#EAB308" />
            <path d="M38 44 Q60 41 82 44" stroke="#78350F" strokeWidth="3" />
            {/* Face */}
            <circle cx="60" cy="64" r="23" fill={`url(#grad-skin-${uid})`} />
            {/* Adventurous Eyes */}
            <circle cx="50" cy="62" r="3.5" fill="#1E293B" />
            <circle cx="70" cy="62" r="3.5" fill="#1E293B" />
            <circle cx="51.5" cy="60.5" r="1.2" fill="#FFFFFF" />
            <circle cx="71.5" cy="60.5" r="1.2" fill="#FFFFFF" />
            <path d="M46 56 Q51 54 56 56" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
            <path d="M64 56 Q69 54 74 56" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
            {/* Confident Smile */}
            <path d="M53 74 Q60 79 67 74" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
            {/* Brass Binoculars around Neck */}
            <g transform="translate(47, 80)">
              <rect x="2" y="2" width="9" height="13" rx="2" fill="#D97706" stroke="#78350F" strokeWidth="1" />
              <rect x="15" y="2" width="9" height="13" rx="2" fill="#D97706" stroke="#78350F" strokeWidth="1" />
              <rect x="9" y="5" width="8" height="3" fill="#B45309" />
              <circle cx="6.5" cy="12" r="2.5" fill="#60A5FA" />
              <circle cx="19.5" cy="12" r="2.5" fill="#60A5FA" />
            </g>
            {/* Spinning Mini-Globe */}
            <g transform="translate(16, 68)">
              <circle cx="12" cy="12" r="10" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="1.5" />
              {/* Continents */}
              <path d="M6 10 Q10 8 12 11 Q14 14 10 16 Q7 15 6 10 Z" fill="#10B981" />
              <path d="M14 8 Q17 7 19 10 Q18 14 15 13 Z" fill="#10B981" />
              {/* Orbit Stand */}
              <path d="M2 12 A10 10 0 0 0 22 12" stroke="#FDE047" strokeWidth="1.8" fill="none" />
            </g>
          </g>
        )}

        {category === 'HISTORY' && (
          <g id="hector-history">
            {/* Silver Distinguished Hair & Toga Collar */}
            <path
              d="M34 52 C30 40, 42 26, 60 26 C78 26, 90 40, 86 52 C90 62, 86 78, 82 82 C78 68, 76 60, 60 60 C44 60, 42 68, 38 82 C34 78, 30 62, 34 52 Z"
              fill="#E2E8F0"
              filter={`url(#shadow-${uid})`}
            />
            {/* Golden Laurel Wreath */}
            <g transform="translate(0, -2)">
              <path d="M38 38 Q48 30 60 30 Q72 30 82 38" stroke="#F59E0B" strokeWidth="2.5" fill="none" />
              {/* Leaves */}
              <ellipse cx="44" cy="34" rx="4" ry="2" fill="#FDE047" transform="rotate(-30 44 34)" />
              <ellipse cx="52" cy="30" rx="4" ry="2" fill="#FDE047" transform="rotate(-15 52 30)" />
              <ellipse cx="60" cy="28" rx="4" ry="2" fill="#FDE047" />
              <ellipse cx="68" cy="30" rx="4" ry="2" fill="#FDE047" transform="rotate(15 68 30)" />
              <ellipse cx="76" cy="34" rx="4" ry="2" fill="#FDE047" transform="rotate(30 76 34)" />
            </g>
            {/* Face */}
            <circle cx="60" cy="62" r="23" fill={`url(#grad-skin-${uid})`} />
            {/* Wise Monocle with Chain */}
            <circle cx="50" cy="59" r="8" fill="none" stroke="#F59E0B" strokeWidth="2" />
            <circle cx="50" cy="59" r="6" fill="#FEF3C7" opacity="0.4" />
            <path d="M50 67 Q54 75 58 78" stroke="#F59E0B" strokeWidth="1" fill="none" />
            {/* Eyes */}
            <circle cx="50" cy="59" r="3" fill="#1E293B" />
            <circle cx="70" cy="59" r="3" fill="#1E293B" />
            {/* Philosopher Beard */}
            <path
              d="M48 68 C44 76, 52 86, 60 88 C68 86, 76 76, 72 68 C68 70, 64 71, 60 71 C56 71, 52 70, 48 68 Z"
              fill="#CBD5E1"
            />
            {/* Dignified Gentle Smile */}
            <path d="M55 72 Q60 75 65 72" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
            {/* Hourglass */}
            <g transform="translate(80, 66)">
              <polygon points="4,2 14,2 9,10" fill="#FEF08A" stroke="#B45309" strokeWidth="1" />
              <polygon points="9,10 14,18 4,18" fill="#FEF08A" stroke="#B45309" strokeWidth="1" />
              <rect x="2" y="1" width="16" height="2" fill="#92400E" rx="1" />
              <rect x="2" y="17" width="16" height="2" fill="#92400E" rx="1" />
              {/* Sand */}
              <circle cx="9" cy="15" r="2" fill="#F59E0B" />
            </g>
          </g>
        )}
      </svg>

      {/* Floating Crown Badge (If Unlocked or Celebrated) */}
      {showCrown && (
        <motion.div
          initial={{ scale: 0, rotate: -20, y: 5 }}
          animate={{ scale: 1, rotate: 0, y: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className="absolute -top-1.5 -right-1.5 z-20 w-6 h-6 rounded-full bg-gradient-to-tr from-yellow-300 via-amber-400 to-yellow-500 border border-yellow-200 shadow-md flex items-center justify-center text-xs"
        >
          👑
        </motion.div>
      )}
    </motion.div>
  );
}
