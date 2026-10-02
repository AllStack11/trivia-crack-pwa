import React, { useEffect, useRef, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { playButtonPop } from '../../utils/audio';

export interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
  className?: string;
}

const MAX_WIDTHS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg'
};

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  maxWidth = 'md',
  className = ''
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogFocus(isOpen, panelRef);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        playButtonPop();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            className={`relative z-10 w-full ${MAX_WIDTHS[maxWidth]} rounded-3xl bg-slate-900/95 border border-slate-700/80 p-5 sm:p-6 shadow-2xl shadow-black/80 flex flex-col gap-4 overflow-hidden ${className}`}
          >
            {/* Top Sheen */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

            {/* Header (if provided) */}
            {(title || icon) && (
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {icon && (
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-xl shrink-0 shadow-inner">
                      {icon}
                    </div>
                  )}
                  <div>
                    {title && <h3 id={titleId} className="text-lg font-black text-white tracking-tight leading-tight">{title}</h3>}
                    {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
                  </div>
                </div>

                {onClose && (
                  <button
                    onClick={() => {
                      playButtonPop();
                      onClose();
                    }}
                    className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm transition-colors"
                    aria-label="Close modal"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Modal Body */}
            <div>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
