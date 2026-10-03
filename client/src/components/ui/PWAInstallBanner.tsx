import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Share, X } from 'lucide-react';
import { playButtonPop, triggerHaptic } from '../../utils/audio';

export interface PWAInstallBannerProps {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  onInstall: () => void;
  onShowIOSGuide: () => void;
}

export default function PWAInstallBanner({
  isInstallable,
  isInstalled,
  isIOS,
  onInstall,
  onShowIOSGuide,
}: PWAInstallBannerProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setDismissed(sessionStorage.getItem('trivia_pwa_banner_dismissed') === 'true');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (isInstalled || dismissed) return null;
  if (!isInstallable && !isIOS) return null;

  const handleDismiss = () => {
    playButtonPop();
    setDismissed(true);
    try {
      sessionStorage.setItem('trivia_pwa_banner_dismissed', 'true');
    } catch {
      // Ignore sessionStorage errors
    }
  };

  const handleAction = () => {
    playButtonPop();
    triggerHaptic('selection');
    if (isIOS) {
      onShowIOSGuide();
    } else {
      onInstall();
    }
  };

  // Stay above the routed main content (z-20) so it cannot intercept banner clicks.
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] inset-x-3 z-30 max-w-md mx-auto pointer-events-auto"
      >
        <div className="bg-slate-900/95 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3 shadow-indigo-950/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-amber-500 flex items-center justify-center shadow-md flex-shrink-0">
              <img src="/icons/app-192.png" alt="" className="w-11 h-11 rounded-xl" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5 truncate">
                Install Trivia Clash
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 font-semibold">
                  App
                </span>
              </h4>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">
                {isIOS ? 'Add to Home Screen for full app mode' : 'Quick launch and full-screen play'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleAction}
              className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs shadow-md shadow-indigo-900/30 active:scale-95 transition-all flex items-center gap-1.5"
            >
              {isIOS ? (
                <>
                  <Share className="w-3.5 h-3.5" />
                  <span>Guide</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Install</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
