import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Category, GameStateSync } from '../../../shared/src/index';
import { CATEGORIES } from '../../../shared/src/index';
import { playButtonPop, triggerHaptic } from '../utils/audio';
import CategoryCharacter from './characters/CategoryCharacter';
import { CHARACTER_PROFILES } from './characters/characterData';
import BottomSheet from './ui/BottomSheet';
import { Crown, Sparkles, Swords } from 'lucide-react';

interface CrownModalProps {
  state: GameStateSync;
  myPlayerId: string;
  onChooseCrown: (action: 'claim' | 'steal', category: Category, wagerCategory?: Category) => void;
  onClose?: () => void;
}

const ALL_CATEGORIES: Category[] = [
  'ART',
  'SCIENCE',
  'SPORTS',
  'ENTERTAINMENT',
  'GEOGRAPHY',
  'HISTORY',
];

export default function CrownModal({
  state,
  myPlayerId,
  onChooseCrown,
  onClose,
}: CrownModalProps) {
  const isMyTurn = state.currentTurnPlayerId === myPlayerId;
  const isP1 = state.players.p1.id === myPlayerId;
  const myPlayer = isP1 ? state.players.p1 : state.players.p2;
  const opponent = isP1 ? state.players.p2 : state.players.p1;

  const myCrowns = myPlayer?.crowns || [];
  const opponentCrowns = opponent?.crowns || [];

  const unownedCategories = ALL_CATEGORIES.filter((c) => !myCrowns.includes(c));
  const canSteal = myCrowns.length > 0 && opponentCrowns.length > 0;

  const [mode, setMode] = useState<'claim' | 'steal'>('claim');
  const [selectedTarget, setSelectedTarget] = useState<Category | null>(
    unownedCategories.length > 0 ? unownedCategories[0] : null
  );
  const [selectedWager, setSelectedWager] = useState<Category | null>(
    myCrowns.length > 0 ? myCrowns[0] : null
  );

  const handleConfirm = () => {
    if (!selectedTarget) return;
    playButtonPop();
    triggerHaptic('heavy');
    if (mode === 'steal') {
      if (!selectedWager) return;
      onChooseCrown('steal', selectedTarget, selectedWager);
    } else {
      onChooseCrown('claim', selectedTarget);
    }
  };

  const selectedProfile = selectedTarget ? CHARACTER_PROFILES[selectedTarget as Category] : null;

  return (
    <BottomSheet
      isOpen={isMyTurn}
      onClose={onClose || (() => {})}
      showCloseButton={false}
      title="Crown Duel Challenge!"
      subtitle="Select a character guardian to win their crown"
      icon={<Crown className="w-5 h-5 text-amber-400" />}
      className="pb-6"
    >
      <div className="flex flex-col gap-4 py-1 select-none">
        {/* Mode Switcher: Claim vs Steal */}
        {canSteal && (
          <div className="flex bg-slate-950/80 p-1 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode('claim');
                playButtonPop();
                if (unownedCategories.length > 0 && !unownedCategories.includes(selectedTarget as Category)) {
                  setSelectedTarget(unownedCategories[0]);
                }
              }}
              className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
                mode === 'claim'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🎯 Claim New Crown
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('steal');
                playButtonPop();
                if (opponentCrowns.length > 0 && !opponentCrowns.includes(selectedTarget as Category)) {
                  setSelectedTarget(opponentCrowns[0]);
                }
              }}
              className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
                mode === 'steal'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚔️ Steal Opponent Crown
            </button>
          </div>
        )}

        {/* Steal Mode: Wager Crown Selector */}
        {mode === 'steal' && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-2xl">
            <span className="text-[10px] font-black uppercase text-rose-300 tracking-wider block mb-2">
              1. Select Your Wager (You risk losing this if you fail):
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {myCrowns.map((cat: Category) => {
                const isSelected = selectedWager === cat;
                const catInfo = CATEGORIES[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setSelectedWager(cat);
                      playButtonPop();
                    }}
                    className={`p-2 rounded-xl flex flex-col items-center gap-1 border transition-all ${
                      isSelected
                        ? 'bg-rose-600/40 border-rose-400 ring-2 ring-rose-400 shadow-md'
                        : 'bg-slate-900 border-slate-800 opacity-60'
                    }`}
                  >
                    <CategoryCharacter category={cat} size="xs" />
                    <span className="text-[10px] font-bold text-white truncate max-w-full">
                      {catInfo.characterName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Guardian Category Selection Grid */}
        <div>
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">
            {mode === 'claim' ? 'Choose Guardian Crown to Win:' : '2. Choose Opponent Crown to Seize:'}
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {((mode === 'claim' ? unownedCategories : opponentCrowns) as Category[]).map(
              (cat: Category) => {
                const isSelected = selectedTarget === cat;
                const profile = CHARACTER_PROFILES[cat as Category];

                return (
                  <motion.button
                    key={cat}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      setSelectedTarget(cat);
                      playButtonPop();
                    }}
                    className={`
                      p-3 rounded-2xl border text-left flex items-center gap-3 transition-all relative overflow-hidden
                      ${
                        isSelected
                          ? 'ring-2 ring-amber-400 shadow-xl shadow-amber-500/20'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                      }
                    `}
                    style={{
                      backgroundColor: isSelected ? `${profile.color}25` : undefined,
                      borderColor: isSelected ? profile.color : undefined,
                    }}
                  >
                    <CategoryCharacter
                      category={cat}
                      size="sm"
                      mood={isSelected ? 'celebrating' : 'idle'}
                      showCrown
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-black text-white truncate">{profile.name}</div>
                      <div className="text-[10px] text-slate-300 font-medium truncate">
                        {profile.title}
                      </div>
                    </div>
                  </motion.button>
                );
              }
            )}
          </div>
        </div>

        {/* Selected Champion Spotlight with Pedestal & Quote */}
        <AnimatePresence mode="wait">
          {selectedProfile && (
            <motion.div
              key={selectedProfile.category}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-3.5 bg-slate-950/80 border border-slate-700/80 rounded-2xl flex items-center gap-3.5 shadow-lg"
            >
              <div className="relative">
                <CategoryCharacter
                  category={selectedProfile.category}
                  size="md"
                  mood="happy"
                  showCrown
                />
                <div className="absolute -bottom-1 inset-x-0 h-1 bg-amber-400/50 rounded-full blur-[2px]" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-white">{selectedProfile.name}</span>
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: selectedProfile.color }}
                  >
                    {CATEGORIES[selectedProfile.category].name}
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/90 italic mt-0.5 leading-snug">
                  "{selectedProfile.quotes.claim}"
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm Duel Action Button */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selectedTarget || (mode === 'steal' && !selectedWager)}
          className={`
            w-full py-4 px-4 rounded-2xl font-black text-sm text-white shadow-xl active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-40
            ${
              mode === 'claim'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-amber-900/40'
                : 'bg-gradient-to-r from-rose-600 to-red-500 shadow-rose-900/40'
            }
          `}
        >
          {mode === 'claim' ? (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Start Crown Question!</span>
            </>
          ) : (
            <>
              <Swords className="w-4 h-4" />
              <span>Initiate Steal Duel!</span>
            </>
          )}
        </button>
      </div>
    </BottomSheet>
  );
}
