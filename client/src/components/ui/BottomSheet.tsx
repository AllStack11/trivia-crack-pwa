import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, type PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import { playButtonPop } from '../../utils/audio';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  height?: 'auto' | 'full';
  className?: string;
  showCloseButton?: boolean;
}

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  height = 'auto',
  className = '',
  showCloseButton = true,
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        playButtonPop();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 400) {
      playButtonPop();
      onClose();
    }
  };

  const content = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              playButtonPop();
              onClose();
            }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Sheet panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.65 }}
            onDragEnd={handleDragEnd}
            className={`
              relative z-10 w-full max-w-lg mx-auto
              bg-slate-900/98 backdrop-blur-xl border-t border-slate-700/80
              rounded-t-3xl shadow-2xl flex flex-col overflow-hidden
              pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]
              ${height === 'full' ? 'h-[92vh]' : 'max-h-[90vh]'}
              ${className}
            `.trim()}
            role="dialog"
            aria-modal="true"
          >
            {/* Drag Handle Bar */}
            <div className="pt-3 pb-2 w-full flex justify-center cursor-grab active:cursor-grabbing touch-none">
              <div className="w-12 h-1.5 rounded-full bg-slate-600/80 active:bg-slate-400 transition-colors" />
            </div>

            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-6 pt-1 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-3 min-w-0">
                  {icon && (
                    <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex-shrink-0">
                      {icon}
                    </div>
                  )}
                  <div className="min-w-0">
                    {title && (
                      <h3 className="text-lg font-bold text-white tracking-tight truncate">
                        {title}
                      </h3>
                    )}
                    {subtitle && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {showCloseButton && (
                  <button
                    type="button"
                    onClick={() => {
                      playButtonPop();
                      onClose();
                    }}
                    className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800/80 transition-colors flex-shrink-0 ml-2"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
