import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Category, GameStateSync } from '../../../shared/src/index';
import { CATEGORIES } from '../../../shared/src/index';
import { playButtonPop } from '../utils/audio';
import CategoryCharacter from './characters/CategoryCharacter';
import { CHARACTER_PROFILES } from './characters/characterData';
import Modal from './ui/Modal';
import Button from './ui/Button';

interface CrownModalProps {
  state: GameStateSync;
  myPlayerId: string;
  onChooseCrown: (action: 'claim' | 'steal', category: Category, wagerCategory?: Category) => void;
}

const ALL_CATEGORIES: Category[] = [
  'ART',
  'SCIENCE',
  'SPORTS',
  'ENTERTAINMENT',
  'GEOGRAPHY',
  'HISTORY'
];

export default function CrownModal({ state, myPlayerId, onChooseCrown }: CrownModalProps) {
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

  if (!isMyTurn) {
    return (
      <Modal isOpen={true} maxWidth="sm">
        <div className="text-center py-6 flex flex-col items-center gap-3">
          <motion.div
            animate={{ rotate: [0, -10, 10, -5, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-3xl shadow-xl shadow-amber-500/10"
          >
            👑
          </motion.div>
          <div>
            <h3 className="text-lg font-black text-white">Crown Challenge!</h3>
            <p className="text-xs text-slate-400 mt-1">
              Opponent is selecting a character champion to duel…
            </p>
          </div>
        </div>
      </Modal>
    );
  }

  const handleConfirm = () => {
    if (mode === 'claim') {
      if (!selectedTarget) return;
      playButtonPop();
      onChooseCrown('claim', selectedTarget);
    } else {
      if (!selectedTarget || !selectedWager) return;
      playButtonPop();
      onChooseCrown('steal', selectedTarget, selectedWager);
    }
  };

  const selectedProfile = selectedTarget ? CHARACTER_PROFILES[selectedTarget as Category] : null;

  return (
    <Modal isOpen={true} maxWidth="md" className="max-h-[92dvh] overflow-y-auto">
      {/* Header Banner */}
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-2 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 text-slate-950 flex items-center justify-center text-3xl font-black shadow-lg shadow-amber-500/30 border border-yellow-200">
          👑
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">Crown Duel!</h2>
        <p className="text-xs text-slate-300 mt-0.5">
          Select a character guardian to challenge. Answer correctly to claim their crown!
        </p>
      </div>

      {/* Mode Switcher (Claim vs Steal) */}
      {canSteal && (
        <div className="flex bg-slate-950/80 p-1 rounded-2xl border border-slate-800">
          <button
            onClick={() => {
              setMode('claim');
              playButtonPop();
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
            onClick={() => {
              setMode('steal');
              playButtonPop();
            }}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
              mode === 'steal'
                ? 'bg-red-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚔️ Steal Opponent Crown
          </button>
        </div>
      )}

      {/* Steal Mode: Select Your Wager */}
      {mode === 'steal' && (
        <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-2xl">
          <span className="text-[10px] font-black uppercase text-red-300 tracking-wider block mb-2">
            1. Select Your Wager (You risk losing this if you fail):
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {myCrowns.map((cat: Category) => {
              const isSelected = selectedWager === cat;
              const catInfo = CATEGORIES[cat];
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedWager(cat);
                    playButtonPop();
                  }}
                  className={`p-2 rounded-xl flex flex-col items-center gap-1 border transition-all ${
                    isSelected
                      ? 'bg-red-600/30 border-red-400 ring-2 ring-red-400'
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

      {/* Category Selection Grid */}
      <div>
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">
          {mode === 'claim' ? 'Choose Champion Crown to Win:' : '2. Choose Opponent Crown to Seize:'}
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {((mode === 'claim' ? unownedCategories : opponentCrowns) as Category[]).map((cat: Category) => {
            const isSelected = selectedTarget === cat;
            const profile = CHARACTER_PROFILES[cat as Category];

            return (
              <motion.button
                key={cat}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSelectedTarget(cat);
                  playButtonPop();
                }}
                className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all relative overflow-hidden ${
                  isSelected
                    ? 'ring-2 ring-white shadow-xl shadow-indigo-500/20'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
                style={{
                  backgroundColor: isSelected ? `${profile.color}25` : undefined,
                  borderColor: isSelected ? profile.color : undefined
                }}
              >
                <CategoryCharacter
                  category={cat}
                  size="sm"
                  mood={isSelected ? 'celebrating' : 'idle'}
                />
                <div className="min-w-0">
                  <div className="text-xs font-black text-white truncate">{profile.name}</div>
                  <div className="text-[10px] text-slate-300 font-medium truncate">{profile.title}</div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Selected Champion Spotlight */}
      <AnimatePresence mode="wait">
        {selectedProfile && (
          <motion.div
            key={selectedProfile.category}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center gap-3.5"
          >
            <CategoryCharacter
              category={selectedProfile.category}
              size="md"
              mood="happy"
              showCrown
            />
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
              <p className="text-[11px] text-amber-200/90 italic mt-0.5">
                "{selectedProfile.quotes.claim}"
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Button */}
      <Button
        variant="primary"
        size="lg"
        glow
        onClick={handleConfirm}
        disabled={!selectedTarget || (mode === 'steal' && !selectedWager)}
        className="w-full"
      >
        {mode === 'claim' ? '⚡ Start Crown Question!' : '⚔️ Initiate Steal Duel!'}
      </Button>
    </Modal>
  );
}
