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
        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs transition-all duration-300 relative ${
          isUnlocked
            ? 'shadow-md border-2 border-yellow-300 transform scale-105'
            : 'bg-slate-800/80 border border-slate-700/60 opacity-30 grayscale'
        }`}
        style={{
          backgroundColor: isUnlocked ? info.color : undefined
        }}
      >
        <span className="text-xs">{icon}</span>
        {isUnlocked && (
          <span className="absolute -top-1 -right-1 text-[8px] bg-yellow-400 text-slate-950 font-black rounded-full px-0.5 shadow">
            👑
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-3 shadow-xl flex flex-col gap-2.5">
      {/* Top Players Row */}
      <div className="flex items-center justify-between gap-2">
        {/* Player 1 */}
        <div
          className={`flex-1 p-2 rounded-2xl border transition-all ${
            isP1Turn
              ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-950/30'
              : 'bg-slate-800/40 border-slate-700/40 opacity-80'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white text-xs shadow">
              {p1.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-xs text-white truncate max-w-[80px]">
                  {p1.username}
                </span>
                {myPlayerId === p1.id && (
                  <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1 py-0.2 rounded font-semibold">
                    YOU
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <span>⭐ {p1.score}</span>
                {isP1Turn && (
                  <span className="text-yellow-400 font-extrabold animate-pulse">● TURN</span>
                )}
              </div>
            </div>
          </div>
          {/* P1 Crowns */}
          <div className="flex items-center justify-between gap-0.5">
            {CROWN_CATEGORIES.map((cat) => renderCrownBadge(p1, cat))}
          </div>
        </div>

        {/* Center Round Badge */}
        <div className="flex flex-col items-center justify-center px-1">
          <div className="text-[10px] uppercase font-bold text-slate-500">Round</div>
          <div className="text-xs font-black text-slate-300">
            {state.roundNumber}/{state.maxRounds}
          </div>
        </div>

        {/* Player 2 */}
        <div
          className={`flex-1 p-2 rounded-2xl border transition-all ${
            isP2Turn
              ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-950/30'
              : 'bg-slate-800/40 border-slate-700/40 opacity-80'
          }`}
        >
          {p2 ? (
            <>
              <div className="flex items-center gap-2 mb-1.5 justify-end">
                <div className="flex-1 min-w-0 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    {myPlayerId === p2.id && (
                      <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1 py-0.2 rounded font-semibold">
                        YOU
                      </span>
                    )}
                    <span className="font-bold text-xs text-white truncate max-w-[80px]">
                      {p2.username}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 justify-end">
                    {isP2Turn && (
                      <span className="text-yellow-400 font-extrabold animate-pulse">TURN ●</span>
                    )}
                    <span>⭐ {p2.score}</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center font-bold text-white text-xs shadow">
                  {p2.username.charAt(0).toUpperCase()}
                </div>
              </div>
              {/* P2 Crowns */}
              <div className="flex items-center justify-between gap-0.5">
                {CROWN_CATEGORIES.map((cat) => renderCrownBadge(p2, cat))}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-2 text-center">
              <span className="text-xs text-yellow-400 font-bold animate-pulse">Awaiting P2...</span>
              <span className="text-[9px] text-slate-400">Share room code</span>
            </div>
          )}
        </div>
      </div>

      {/* 3-Point Crown Gauge */}
      <div className="bg-slate-950/60 rounded-2xl px-3 py-2 border border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">👑</span>
          <span className="text-[11px] font-bold text-slate-300">Crown Gauge</span>
        </div>

        {/* 3 Slot Indicator */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((slot) => {
            const isFilled = currentGauge >= slot;
            return (
              <div
                key={slot}
                className={`w-7 h-3 rounded-full transition-all duration-300 ${
                  isFilled
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 shadow-md shadow-yellow-500/40 ring-1 ring-yellow-200'
                    : 'bg-slate-800 border border-slate-700'
                }`}
              />
            );
          })}
        </div>

        <div className="text-[10px] font-bold text-slate-400">
          {currentGauge >= 3 ? (
            <span className="text-yellow-400 font-extrabold animate-pulse">CROWN READY!</span>
          ) : (
            <span>{currentGauge}/3 points</span>
          )}
        </div>
      </div>
    </div>
  );
}
