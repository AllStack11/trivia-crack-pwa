import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import { playButtonPop, triggerHaptic } from '../../utils/audio';

export type ToastType = 'info' | 'success' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  showConfirm: (options: ConfirmDialogOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let globalShowToast: ((message: string, type?: ToastType) => void) | null = null;
let globalShowConfirm: ((options: ConfirmDialogOptions) => void) | null = null;

export function notify(message: string, type: ToastType = 'info'): void {
  if (globalShowToast) {
    globalShowToast(message, type);
  }
}

export function promptConfirm(options: ConfirmDialogOptions): void {
  if (globalShowConfirm) {
    globalShowConfirm(options);
  } else {
    // Fallback if rendered outside provider
    if (window.confirm(`${options.title}\n\n${options.message}`)) {
      options.onConfirm();
    } else {
      options.onCancel?.();
    }
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);

    if (type === 'success') {
      triggerHaptic('success');
    } else if (type === 'error') {
      triggerHaptic('error');
    } else {
      triggerHaptic('light');
    }

    setTimeout(() => {
      removeToast(id);
    }, 3500);
  }, [removeToast]);

  const showConfirm = useCallback((options: ConfirmDialogOptions) => {
    triggerHaptic('medium');
    setConfirmDialog(options);
  }, []);

  useEffect(() => {
    globalShowToast = showToast;
    globalShowConfirm = showConfirm;
    return () => {
      globalShowToast = null;
      globalShowConfirm = null;
    };
  }, [showToast, showConfirm]);

  const value = useMemo(() => ({ showToast, showConfirm }), [showToast, showConfirm]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Floating Toasts at top of viewport */}
      <div className="fixed top-0 inset-x-0 z-[100] flex flex-col items-center pointer-events-none pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] px-4 gap-2">
        <AnimatePresence>
          {toasts.map((toast) => {
            const icons = {
              success: <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
              error: <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />,
              info: <Info className="w-5 h-5 text-indigo-400 flex-shrink-0" />,
            };

            const borderColors = {
              success: 'border-emerald-500/40 bg-slate-900/95 text-emerald-200',
              error: 'border-rose-500/40 bg-slate-900/95 text-rose-200',
              info: 'border-indigo-500/40 bg-slate-900/95 text-slate-100',
            };

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.9 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className={`
                  pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl
                  border shadow-xl backdrop-blur-xl max-w-sm w-full
                  ${borderColors[toast.type]}
                `}
              >
                {icons[toast.type]}
                <p className="text-sm font-medium flex-1 truncate">{toast.message}</p>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="p-1 rounded-full text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Confirm Bottom Sheet Dialog */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-[110] flex flex-col justify-end pointer-events-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                playButtonPop();
                confirmDialog.onCancel?.();
                setConfirmDialog(null);
              }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md pointer-events-auto"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="
                relative z-10 w-full max-w-md mx-auto pointer-events-auto
                bg-slate-900/95 backdrop-blur-2xl border-t border-slate-700/80
                rounded-t-3xl shadow-2xl p-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]
              "
            >
              <div className="w-12 h-1.5 rounded-full bg-slate-600/80 mx-auto mb-4" />

              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`p-2.5 rounded-2xl ${
                    confirmDialog.isDestructive
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {confirmDialog.title}
                </h3>
              </div>

              <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                {confirmDialog.message}
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    playButtonPop();
                    confirmDialog.onCancel?.();
                    setConfirmDialog(null);
                  }}
                  className="
                    flex-1 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700
                    border border-slate-700 text-slate-200 font-semibold text-sm
                    active:scale-95 transition-all
                  "
                >
                  {confirmDialog.cancelText || 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playButtonPop();
                    triggerHaptic(confirmDialog.isDestructive ? 'heavy' : 'success');
                    confirmDialog.onConfirm();
                    setConfirmDialog(null);
                  }}
                  className={`
                    flex-1 py-3 px-4 rounded-2xl font-semibold text-sm text-white shadow-lg active:scale-95 transition-all
                    ${
                      confirmDialog.isDestructive
                        ? 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 shadow-rose-900/30'
                        : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-indigo-900/30'
                    }
                  `}
                >
                  {confirmDialog.confirmText || 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: notify,
      showConfirm: promptConfirm,
    };
  }
  return ctx;
}
