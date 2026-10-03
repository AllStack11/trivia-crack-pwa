import { motion } from 'motion/react';
import { Crown, Share2, Download, Volume2, VolumeX, LogOut, ArrowLeft } from 'lucide-react';
import type { AccountSummary } from '../../../../shared/src/index';
import { playButtonPop, triggerHaptic } from '../../utils/audio';

const AVATAR_GRADIENTS = [
  'from-pink-500 to-rose-600',
  'from-purple-500 to-indigo-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-violet-500 to-purple-600',
  'from-fuchsia-500 to-pink-600',
  'from-cyan-500 to-blue-600',
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index]!;
}

export interface AppHeaderProps {
  account: (AccountSummary & { token?: string }) | null;
  onLogout?: () => void;
  isOnline?: boolean;
  isInstallable?: boolean;
  onInstallApp?: () => void;
  onShareApp?: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
  currentView?: 'LOBBY' | 'GAME' | 'PACK_CREATOR';
  onBackToLobby?: () => void;
  title?: string;
}

export default function AppHeader({
  account,
  onLogout,
  isOnline = true,
  isInstallable = false,
  onInstallApp,
  onShareApp,
  muted = false,
  onToggleMute,
  currentView = 'LOBBY',
  onBackToLobby,
  title,
}: AppHeaderProps) {
  const isLobby = currentView === 'LOBBY';

  return (
    <header className="game-header sticky top-0 z-40 w-full bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] pb-2.5 px-4">
      <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
        {/* Left Side: Back button or User Avatar / Logo */}
        <div className="flex items-center gap-2.5 min-w-0">
          {!isLobby && onBackToLobby ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                playButtonPop();

                onBackToLobby();
              }}
              className="p-2 -ml-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 shadow flex items-center gap-1.5 text-xs font-semibold"
              aria-label="Back to Lobby"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </motion.button>
          ) : account ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative flex-shrink-0">
                <div
                  className={`w-9 h-9 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                    account.username
                  )} flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-slate-800`}
                >
                  {account.username.slice(0, 2).toUpperCase()}
                </div>
                {/* Online indicator dot */}
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${
                    isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  title={isOnline ? 'Online' : 'Offline'}
                />
              </div>
              <div className="min-w-0 hidden sm:block">
                <p className="text-xs font-bold text-white truncate max-w-[100px]">
                  {account.username}
                </p>
                <p className="text-[10px] text-slate-400 leading-none">
                  {isOnline ? 'Connected' : 'Offline'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Crown className="w-5 h-5 fill-amber-400" />
              </div>
            </div>
          )}

          {/* Title or Logo in Header */}
          <div className="min-w-0">
            {title ? (
              <h1 className="text-base font-extrabold text-white truncate tracking-tight">
                {title}
              </h1>
            ) : (
              <div className="flex items-center gap-1.5">
                {isLobby && !account && (
                  <Crown className="w-4 h-4 text-amber-400 fill-amber-400 sm:hidden" />
                )}
                <span className="text-sm font-black tracking-wider game-wordmark">
                  TRIVIA CLASH
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Action icons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Share Duel Button */}
          {onShareApp && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                playButtonPop();

                onShareApp();
              }}
              title="Share duel link"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 shadow-sm"
              aria-label="Share"
            >
              <Share2 className="w-4 h-4" />
            </motion.button>
          )}

          {/* PWA Install Button */}
          {isInstallable && onInstallApp && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                playButtonPop();
                triggerHaptic('selection');
                onInstallApp();
              }}
              title="Install App"
              className="hidden sm:flex p-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-900/30 border border-indigo-400/40 animate-pulse"
              aria-label="Install App"
            >
              <Download className="w-4 h-4" />
            </motion.button>
          )}

          {/* Sound Toggle */}
          {onToggleMute && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                triggerHaptic('selection');
                onToggleMute();
              }}
              title={muted ? 'Unmute Audio' : 'Mute Audio'}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 shadow-sm"
              aria-label={muted ? "Unmute sound" : "Mute sound"}
              aria-pressed={muted}
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </motion.button>
          )}

          {/* Logout / Switch User */}
          {account && onLogout && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                playButtonPop();
                triggerHaptic('medium');
                onLogout();
              }}
              title="Switch Player / Log Out"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 border border-slate-700/60 shadow-sm"
              aria-label="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>
    </header>
  );
}
