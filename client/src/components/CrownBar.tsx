import type { Category, GameStateSync, PlayerState } from '../../../shared/src/index';
import { CATEGORIES } from '../../../shared/src/index';

interface CrownBarProps {
  state: GameStateSync;
  myPlayerId: string;
}

const CROWN_CATEGORIES: Category[] = [
  'ART',
  'SCIENCE',
  'SPORTS',
  'ENTERTAINMENT',
  'GEOGRAPHY',
  'HISTORY'
];

export default function CrownBar({ state, myPlayerId }: CrownBarProps) {
  const p1 = state.players.p1;
  const p2 = state.players.p2;

  const isP1Turn = state.currentTurnPlayerId === p1.id;
  const isP2Turn = p2 ? state.currentTurnPlayerId === p2.id : false;

  const activePlayer = isP1Turn ? p1 : p2;
  const currentGauge = activePlayer?.crownGauge || 0;

  const renderCrownBadge = (player: PlayerState, category: Category) => {
    const isUnlocked = player.crowns.includes(category);
    const info = CATEGORIES[category];

    let icon = '🎨';
    if (category === 'SCIENCE') icon = '🔬';
    if (category === 'SPORTS') icon = '🏆';
    if (category === 'ENTERTAINMENT') icon = '🎬';
    if (category === 'GEOGRAPHY') icon = '🌍';
    if (category === 'HISTORY') icon = '⏳';

    return (
      <div
        key={category}
        title={`${info.characterName} (${info.name}) - ${isUnlocked ? 'Unlocked' : 'Locked'}`}
        className={`w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center text-[10px] sm:text-xs transition-all duration-300 relative shrink-0 ${
          isUnlocked
            ? 'shadow-sm border border-yellow-300 transform scale-105'
            : 'bg-slate-800/90 border border-slate-700/60 opacity-30 grayscale'
        }`}
        style={{
          backgroundColor: isUnlocked ? info.color : undefined
        }}
      >
        <span className="text-[10px] sm:text-xs leading-none">{icon}</span>
        {isUnlocked && (
          <span className="absolute -top-1 -right-1 text-[7px] leading-none bg-yellow-400 text-slate-950 font-black rounded-full px-0.5 shadow">
            👑
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-2 sm:p-3 shadow-xl flex flex-col gap-1.5 sm:gap-2">
      {/* Top Players Row - grid with 3 columns fitting 100% of mobile screens */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-2 w-full">
        {/* Player 1 */}
        <div
          className={`min-w-0 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border transition-all ${
            isP1Turn
              ? 'bg-indigo-950/50 border-indigo-500 shadow-md shadow-indigo-950/40'
              : 'bg-slate-800/30 border-slate-700/30 opacity-75'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1 min-w-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white text-[10px] sm:text-xs shadow shrink-0">
              {p1.username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 min-w-0">
                <span className="font-bold text-[11px] sm:text-xs text-white truncate block">
                  {p1.username}
                </span>
                {myPlayerId === p1.id && (
                  <span className="text-[8px] bg-indigo-500/40 text-indigo-300 px-1 rounded font-bold shrink-0">
                    YOU
                  </span>
                )}
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-400 flex items-center gap-1">
                <span>⭐{p1.score}</span>
                {isP1Turn && (
                  <span className="text-yellow-400 font-extrabold text-[8px] sm:text-[9px] animate-pulse shrink-0">
                    ● TURN
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* P1 Crowns */}
          <div className="flex items-center justify-start gap-1 overflow-x-hidden">
            {CROWN_CATEGORIES.map((cat) => renderCrownBadge(p1, cat))}
          </div>
        </div>

        {/* Center Round Badge */}
        <div className="flex flex-col items-center justify-center px-1 shrink-0">
          <div className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-500">Round</div>
          <div className="text-[11px] sm:text-xs font-black text-slate-300">
            {state.roundNumber}/{state.maxRounds}
          </div>
        </div>

        {/* Player 2 */}
        <div
          className={`min-w-0 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border transition-all ${
            isP2Turn
              ? 'bg-indigo-950/50 border-indigo-500 shadow-md shadow-indigo-950/40'
              : 'bg-slate-800/30 border-slate-700/30 opacity-75'
          }`}
        >
          {p2 ? (
            <>
              <div className="flex items-center gap-1.5 mb-1 min-w-0 justify-end">
                <div className="min-w-0 flex-1 text-right">
                  <div className="flex items-center gap-1 justify-end min-w-0">
                    {myPlayerId === p2.id && (
                      <span className="text-[8px] bg-indigo-500/40 text-indigo-300 px-1 rounded font-bold shrink-0">
                        YOU
                      </span>
                    )}
                    <span className="font-bold text-[11px] sm:text-xs text-white truncate block">
                      {p2.username}
                    </span>
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-slate-400 flex items-center gap-1 justify-end">
                    {isP2Turn && (
                      <span className="text-yellow-400 font-extrabold text-[8px] sm:text-[9px] animate-pulse shrink-0">
                        TURN ●
                      </span>
                    )}
                    <span>⭐{p2.score}</span>
                  </div>
                </div>
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center font-bold text-white text-[10px] sm:text-xs shadow shrink-0">
                  {p2.username.charAt(0).toUpperCase()}
                </div>
              </div>
              {/* P2 Crowns */}
              <div className="flex items-center justify-end gap-1 overflow-x-hidden">
                {CROWN_CATEGORIES.map((cat) => renderCrownBadge(p2, cat))}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-1 text-center">
              <span className="text-[10px] sm:text-xs text-yellow-400 font-bold animate-pulse">
                Awaiting P2...
              </span>
              <span className="text-[8px] text-slate-400">Share code</span>
            </div>
          )}
        </div>
      </div>

      {/* 3-Point Crown Gauge */}
      <div className="bg-slate-950/60 rounded-xl px-2.5 py-1.5 border border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs">👑</span>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-300">Gauge</span>
        </div>

        {/* 3 Slot Indicator */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {[1, 2, 3].map((slot) => {
            const isFilled = currentGauge >= slot;
            return (
              <div
                key={slot}
                className={`w-6 sm:w-7 h-2 sm:h-2.5 rounded-full transition-all duration-300 ${
                  isFilled
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 shadow-sm shadow-yellow-500/40 ring-1 ring-yellow-200'
                    : 'bg-slate-800 border border-slate-700'
                }`}
              />
            );
          })}
        </div>

        <div className="text-[9px] sm:text-[10px] font-bold text-slate-400">
          {currentGauge >= 3 ? (
            <span className="text-yellow-400 font-extrabold animate-pulse">CROWN READY!</span>
          ) : (
            <span>{currentGauge}/3</span>
          )}
        </div>
      </div>
    </div>
  );
}
