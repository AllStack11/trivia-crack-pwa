import { useState } from 'react';
import type { Category, GameStateSync } from '../../../shared/src/index';
import { CATEGORIES } from '../../../shared/src/index';
import { playButtonPop } from '../utils/audio';

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
      <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center max-w-sm w-full shadow-2xl">
          <div className="text-4xl mb-3 animate-bounce">👑</div>
          <h3 className="text-lg font-bold text-white mb-1">Crown Challenge!</h3>
          <p className="text-xs text-slate-400">
            Opponent is selecting a Crown Character to challenge...
          </p>
        </div>
      </div>
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

  return (
    <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 max-w-md w-full shadow-2xl flex flex-col gap-4 animate-scale-up">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-2xl shadow-inner">
            👑
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">Crown Challenge!</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Answer correctly to win a character crown and retain your turn
          </p>
        </div>

        {/* Action Toggle (Claim vs Steal) */}
        {canSteal && (
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => {
                setMode('claim');
                setSelectedTarget(unownedCategories[0] || null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'claim'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              👑 Claim New Crown
            </button>
            <button
              onClick={() => {
                setMode('steal');
                setSelectedTarget(opponentCrowns[0] || null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'steal'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚔️ Steal from Opponent
            </button>
          </div>
        )}

        {/* Claim Mode: Select Category to Win */}
        {mode === 'claim' ? (
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Select a crown character to play for:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {unownedCategories.map((cat) => {
                const info = CATEGORIES[cat];
                const isSelected = selectedTarget === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedTarget(cat)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-yellow-400 bg-yellow-400/10 ring-2 ring-yellow-400 shadow-lg'
                        : 'border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow"
                      style={{ backgroundColor: info.color }}
                    >
                      {cat === 'ART' && '🎨'}
                      {cat === 'SCIENCE' && '🔬'}
                      {cat === 'SPORTS' && '🏆'}
                      {cat === 'ENTERTAINMENT' && '🎬'}
                      {cat === 'GEOGRAPHY' && '🌍'}
                      {cat === 'HISTORY' && '⏳'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">{info.characterName}</div>
                      <div className="text-[10px] text-slate-400 truncate">{info.name}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Steal Mode: Select Opponent's Crown and Wager One of Yours */
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-amber-300 mb-1.5">
                1. Target Opponent's Crown to Capture:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {opponentCrowns.map((cat) => {
                  const info = CATEGORIES[cat];
                  const isSelected = selectedTarget === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedTarget(cat)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'border-amber-400 bg-amber-400/10 ring-2 ring-amber-400 shadow-lg'
                          : 'border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow"
                        style={{ backgroundColor: info.color }}
                      >
                        👑
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{info.characterName}</div>
                        <div className="text-[10px] text-slate-400 truncate">{info.name}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-rose-300 mb-1.5">
                2. Wager One of Your Crowns (Risk of Forfeit):
              </label>
              <div className="grid grid-cols-2 gap-2">
                {myCrowns.map((cat) => {
                  const info = CATEGORIES[cat];
                  const isSelected = selectedWager === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedWager(cat)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'border-rose-400 bg-rose-400/10 ring-2 ring-rose-400 shadow-lg'
                          : 'border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow"
                        style={{ backgroundColor: info.color }}
                      >
                        ⚠️
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{info.characterName}</div>
                        <div className="text-[10px] text-slate-400 truncate">{info.name}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-[10px] text-rose-400 italic">
              * Notice: If you answer incorrectly, you lose your wagered crown to your opponent!
            </p>
          </div>
        )}

        {/* Confirm Button */}
        <button
          onClick={handleConfirm}
          disabled={!selectedTarget || (mode === 'steal' && !selectedWager)}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-extrabold text-sm rounded-2xl shadow-lg transition-transform active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          {mode === 'claim' ? 'Start Crown Question' : 'Initiate Crown Steal Battle!'}
        </button>
      </div>
    </div>
  );
}
