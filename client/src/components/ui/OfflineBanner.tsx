import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, Zap } from 'lucide-react';

export interface OfflineBannerProps {
  isOnline: boolean;
}

export default function OfflineBanner({ isOnline }: OfflineBannerProps) {
  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="fixed top-[calc(env(safe-area-inset-top,0px)+3.85rem)] inset-x-4 z-30 max-w-sm mx-auto pointer-events-none"
        >
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-amber-950/90 border border-amber-500/50 shadow-lg shadow-amber-950/40 backdrop-blur-xl text-amber-200">
            <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400 flex-shrink-0 animate-pulse">
              <WifiOff className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs font-medium tracking-tight flex-1 truncate">
              <span className="font-bold">Offline mode</span> &bull; Matches will sync once connection resumes
            </p>
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400/50 flex-shrink-0" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
