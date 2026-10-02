import { motion } from 'motion/react';
import type { Category, GameStateSync, PlayerState } from '../../../shared/src/index';
import { CATEGORIES } from '../../../shared/src/index';
import CategoryCharacter from './characters/CategoryCharacter';
import Card from './ui/Card';

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

  const renderPlayerCrowns = (player: PlayerState) => {
    return (
      <div className="flex items-center justify-between gap-0.5">
        {CROWN_CATEGORIES.map((category) => {
          const isUnlocked = player.crowns.includes(category);
          const catInfo = CATEGORIES[category];

          return (
            <div
              key={category}
              title={`${catInfo.characterName} (${catInfo.name}): ${isUnlocked ? 'Crown Unlocked! 👑' : 'Locked'}`}
              className="relative"
            >
              {isUnlocked ? (
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="relative"
                >
                  <CategoryCharacter
                    category={category}
                    size="xs"
                    mood="celebrating"
                    showCrown
                    className="!w-5 !h-6 drop-shadow-sm"
                  />
                </motion.div>
              ) : (
                <div
                  className="w-5 h-6 rounded-full flex items-center justify-center text-[10px] bg-slate-900/90 border border-slate-700/60 opacity-50 grayscale transition-all"
                  style={{ borderColor: `${catInfo.color}40` }}
                >
                  <CategoryCharacter category={category} size="xs" className="!w-5 !h-6" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card
      variant="glass"
      className="w-full max-w-md mx-auto p-2.5 sm:p-3.5 flex flex-col gap-2 relative z-20 shadow-2xl"
    >
      {/* Players Row */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
        {/* Player 1 Card */}
        <div
          className={`min-w-0 p-2 sm:p-2.5 rounded-2xl border transition-all duration-300 relative ${
            isP1Turn
              ? 'bg-indigo-950/70 border-indigo-400 shadow-lg shadow-indigo-500/20'
              : 'bg-slate-950/40 border-slate-800/80 opacity-70'
          }`}
        >
          {isP1Turn && (
            <motion.span
              layoutId="turnIndicator"
              className="absolute -top-1.5 -left-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black uppercase tracking-wider shadow"
            >
              Turn
            </motion.span>
          )}
          <div className="flex items-center gap-2 mb-1.5 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center font-black text-white text-xs shadow shrink-0">
              {p1.username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-xs text-white truncate">{p1.username}</span>
                {myPlayerId === p1.id && (
                  <span className="text-[9px] font-bold text-indigo-300 bg-indigo-500/20 px-1 rounded">You</span>
                )}
              </div>
              <div className="text-[10px] text-amber-300 font-bold flex items-center gap-0.5">
                <span>👑</span>
                <span>{p1.crowns.length}/6</span>
              </div>
            </div>
          </div>
          {/* Crowns Badges */}
          {renderPlayerCrowns(p1)}
        </div>

        {/* Center VS & Turn Banner */}
        <div className="flex flex-col items-center justify-center px-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-b from-amber-400 to-yellow-600 text-slate-950 flex items-center justify-center text-xs font-black shadow-lg shadow-amber-500/20 border border-yellow-300">
            VS
          </div>
        </div>

        {/* Player 2 Card */}
        {p2 ? (
          <div
            className={`min-w-0 p-2 sm:p-2.5 rounded-2xl border transition-all duration-300 relative ${
              isP2Turn
                ? 'bg-rose-950/70 border-rose-400 shadow-lg shadow-rose-500/20'
                : 'bg-slate-950/40 border-slate-800/80 opacity-70'
            }`}
          >
            {isP2Turn && (
              <motion.span
                layoutId="turnIndicator"
                className="absolute -top-1.5 -right-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black uppercase tracking-wider shadow"
              >
                Turn
              </motion.span>
            )}
            <div className="flex items-center gap-2 mb-1.5 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-600 flex items-center justify-center font-black text-white text-xs shadow shrink-0">
                {p2.username.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="font-extrabold text-xs text-white truncate">{p2.username}</span>
                  {myPlayerId === p2.id && (
                    <span className="text-[9px] font-bold text-rose-300 bg-rose-500/20 px-1 rounded">You</span>
                  )}
                </div>
                <div className="text-[10px] text-amber-300 font-bold flex items-center gap-0.5">
                  <span>👑</span>
                  <span>{p2.crowns.length}/6</span>
                </div>
              </div>
            </div>
            {/* Crowns Badges */}
            {renderPlayerCrowns(p2)}
          </div>
        ) : (
          <div className="p-2.5 rounded-2xl border border-dashed border-slate-700/60 bg-slate-950/20 text-center flex flex-col items-center justify-center">
            <span className="text-[10px] text-slate-400 font-medium">Waiting for opponent…</span>
          </div>
        )}
      </div>

      {/* Crown Gauge Meter (Liquid Neon Meter) */}
      <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-amber-400 font-black text-[11px] flex items-center gap-1">
            <span>👑</span>
            <span>CROWN GAUGE:</span>
          </span>
          <span className="text-[10px] font-bold text-slate-300">{currentGauge}/3</span>
        </div>

        {/* 3-Bar Liquid Progress */}
        <div className="flex items-center gap-1.5 flex-1 max-w-[140px]">
          {[1, 2, 3].map((step) => {
            const isFilled = currentGauge >= step;
            return (
              <div
                key={step}
                className="h-2.5 flex-1 rounded-full bg-slate-800/90 overflow-hidden relative border border-slate-700/50"
              >
                {isFilled && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 shadow-sm shadow-amber-400"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Status Callout */}
        <div className="text-[10px] font-extrabold text-right shrink-0">
          {currentGauge >= 3 ? (
            <span className="text-amber-300 animate-pulse flex items-center gap-1">
              <span>⚡</span> CROWN READY!
            </span>
          ) : (
            <span className="text-slate-400">
              {3 - currentGauge} to Crown
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
