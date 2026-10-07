import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Category } from '../../../../shared/src/index';
import { CATEGORIES } from '../../../../shared/src/index';
import CategoryCharacter from './CategoryCharacter';
import { CHARACTER_PROFILES } from './characterData';
import { playButtonPop } from '../../utils/audio';

const ALL_CATEGORIES: Category[] = [
  'ART',
  'SCIENCE',
  'SPORTS',
  'ENTERTAINMENT',
  'GEOGRAPHY',
  'HISTORY', 'MEMES', 'CUSTOM', 'MOVIES_TV', 'VIDEO_GAMES'
];

interface CharacterShowcaseProps {
  initialCategory?: Category;
  unlockedCrowns?: Category[];
  className?: string;
}

export default function CharacterShowcase({
  initialCategory = 'SCIENCE',
  unlockedCrowns,
  className = ''
}: CharacterShowcaseProps) {
  const [selectedCat, setSelectedCat] = useState<Category>(initialCategory);
  const profile = CHARACTER_PROFILES[selectedCat];
  const catInfo = CATEGORIES[selectedCat];
  const isCrownUnlocked = unlockedCrowns?.includes(selectedCat);

  const handleSelect = (cat: Category) => {
    setSelectedCat(cat);
    playButtonPop();
  };

  return (
    <div className={`w-full rounded-3xl bg-slate-900/90 border border-slate-800/80 p-4 sm:p-5 shadow-xl overflow-hidden relative ${className}`}>
      {/* Background radial glow matching selected category without costly blur filters */}
      <div
        className="absolute -top-24 -right-24 w-64 h-64 rounded-full transition-all duration-700 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${profile.color}45 0%, transparent 70%)` }}
      />
      <div
        className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full transition-all duration-700 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${profile.accentColor}35 0%, transparent 70%)` }}
      />

      {/* Header Title */}
      <div className="flex flex-col items-start gap-3 mb-4 relative z-10">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Meet The Champions</span>
          <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
            <span>Crown Guardians</span>
            {unlockedCrowns && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-400/30">
              {unlockedCrowns.length}/{ALL_CATEGORIES.length} Unlocked
            </span>}
          </h3>
        </div>

        {/* Character Mini-Pills */}
        <div className="flex gap-1 sm:gap-1.5 p-1 bg-slate-950/70 border border-slate-800 rounded-2xl">
          {ALL_CATEGORIES.map((cat) => {
            const isSelected = selectedCat === cat;
            const hasCrown = unlockedCrowns?.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${CHARACTER_PROFILES[cat].name}, ${CATEGORIES[cat].name}`}
                onClick={() => handleSelect(cat)}
                className={`relative w-11 h-11 rounded-xl flex items-center justify-center text-sm transition-all ${
                  isSelected
                    ? 'ring-2 ring-white/80 shadow-md scale-105'
                    : 'opacity-65 hover:opacity-100 hover:scale-100'
                }`}
                style={{
                  backgroundColor: isSelected ? CATEGORIES[cat].color : '#edf6ed'
                }}
                title={`${CHARACTER_PROFILES[cat].name} - ${CATEGORIES[cat].name}`}
              >
                <CategoryCharacter category={cat} size="sm" />
                {hasCrown && (
                  <span className="absolute -top-1 -right-1 text-[8px] bg-yellow-400 text-slate-950 rounded-full px-0.5 font-black shadow">
                    👑
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Showcase Stage */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedCat}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative z-10 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 champion-stage bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5"
        >
          {/* Animated Avatar */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <CategoryCharacter
              category={selectedCat}
              size="xl"
              mood="happy"
              showCrown={isCrownUnlocked}
            />
            <span
              className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full text-white shadow-sm"
              style={{ backgroundColor: profile.color }}
            >
              {catInfo.name}
            </span>
          </div>

          {/* Character Lore and Dialogue */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <h4 className="text-xl font-black text-white">{profile.name}</h4>
              <span className="text-xs font-bold text-slate-400">· {profile.title}</span>
              {isCrownUnlocked && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-yellow-400/20 text-yellow-300 border border-yellow-300/40">
                  👑 Crown Owned
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 mb-3 italic">"{profile.tagline}"</p>

            {/* Speech Bubble Quote */}
            <div className="relative bg-slate-900/90 border border-slate-700/60 rounded-xl p-3 shadow-inner text-xs text-amber-200/90 font-medium">
              <div className="text-[9px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Character Voice:</div>
              "{profile.quotes.greeting}"
            </div>

            {/* Bio summary */}
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              {profile.bio}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
