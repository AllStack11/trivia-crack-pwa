import React from 'react';
import { motion } from 'motion/react';
import { Swords, Users, Trophy, BookOpen } from 'lucide-react';
import { playButtonPop, triggerHaptic } from '../../utils/audio';

export type LobbyTab = 'matches' | 'players' | 'champions' | 'packs';

export interface BottomNavProps {
  activeTab: LobbyTab;
  onChangeTab: (tab: LobbyTab) => void;
  myTurnCount?: number;
  invitationCount?: number;
}

interface NavItem {
  id: LobbyTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
  badgeHighlight?: boolean;
}

export default function BottomNav({
  activeTab,
  onChangeTab,
  myTurnCount = 0,
  invitationCount = 0,
}: BottomNavProps) {
  const items: NavItem[] = [
    {
      id: 'matches',
      label: 'Play',
      icon: Swords,
      badgeCount: myTurnCount,
      badgeHighlight: myTurnCount > 0,
    },
    {
      id: 'players',
      label: 'Friends',
      icon: Users,
      badgeCount: invitationCount,
      badgeHighlight: invitationCount > 0,
    },
    {
      id: 'champions',
      label: 'Heroes',
      icon: Trophy,
    },
    {
      id: 'packs',
      label: 'Packs',
      icon: BookOpen,
    },
  ];

  return (
    <nav
      className="game-dock fixed inset-x-0 bottom-0 z-40 bg-slate-950/95 border-t border-slate-800/80 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-1.5 px-3 select-none"
      role="navigation"
      aria-label="Bottom Navigation"
    >
      <div className="max-w-md mx-auto grid grid-cols-4 items-center gap-1">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <motion.button
              key={item.id}
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (!isActive) {
                  playButtonPop();
                  triggerHaptic('selection');
                  onChangeTab(item.id);
                }
              }}
              className={`
                relative flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl
                transition-colors duration-200 outline-none
                ${isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'}
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active Indicator Sliding Background Pill */}
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  className="absolute inset-0 bg-indigo-600/25 border border-indigo-500/35 rounded-2xl -z-10 shadow-sm shadow-indigo-500/10"
                />
              )}

              {/* Icon Container with Badge */}
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-110 text-indigo-400 stroke-[2.5]' : 'stroke-[1.8]'
                  }`}
                />

                {/* Turn / Invitation Count Badge */}
                {Boolean(item.badgeCount && item.badgeCount > 0) && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center">
                    {item.badgeHighlight && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60" />
                    )}
                    <span
                      className={`
                        relative inline-flex items-center justify-center px-1 h-4 rounded-full text-[10px] font-bold text-white shadow-sm
                        ${item.badgeHighlight ? 'bg-rose-500' : 'bg-indigo-500'}
                      `}
                    >
                      {item.badgeCount}
                    </span>
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-[11px] mt-1 font-medium transition-all ${
                  isActive ? 'font-bold text-white' : 'text-slate-400'
                }`}
              >
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
