import { useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { Delete, X } from 'lucide-react';
import { playButtonPop, playIncorrectBuzzer, triggerHaptic } from '../../utils/audio';

export interface KeypadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (pin?: string) => void;
  maxLength?: number;
  disabled?: boolean;
  error?: boolean;
  title?: string;
  subtitle?: string;
}

export default function Keypad({
  value,
  onChange,
  onSubmit,
  maxLength = 4,
  disabled = false,
  error = false,
  title,
  subtitle,
}: KeypadProps) {
  const submitTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      clearTimeout(submitTimeoutRef.current);
    };
  }, []);

  const handleDigit = useCallback(
    (digit: string) => {
      if (disabled || value.length >= maxLength) return;
      playButtonPop();
      triggerHaptic('selection');
      const next = value + digit;
      onChange(next);
      if (next.length === maxLength && onSubmit) {
        clearTimeout(submitTimeoutRef.current);
        submitTimeoutRef.current = window.setTimeout(() => onSubmit(next), 60);
      }
    },
    [disabled, value, maxLength, onChange, onSubmit]
  );

  const handleDelete = useCallback(() => {
    if (disabled || value.length === 0) return;
    playButtonPop();
    triggerHaptic('light');
    onChange(value.slice(0, -1));
  }, [disabled, value, onChange]);

  const handleClear = useCallback(() => {
    if (disabled || value.length === 0) return;
    playButtonPop();
    triggerHaptic('medium');
    onChange('');
  }, [disabled, value, onChange]);

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter' && value.length === maxLength && onSubmit) {
        e.preventDefault();
        onSubmit(value);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, handleDigit, handleDelete, handleClear, value, maxLength, onSubmit]);

  useEffect(() => {
    if (error) {
      playIncorrectBuzzer();
      triggerHaptic('error');
    }
  }, [error]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-xs mx-auto py-2">
      {/* Title & Subtitle */}
      {title && (
        <h4 className="text-base font-semibold text-white mb-1 text-center">{title}</h4>
      )}
      {subtitle && <p className="text-xs text-slate-400 mb-4 text-center">{subtitle}</p>}

      {/* 4-dot indicator row with shake animation on error */}
      <motion.div
        animate={error ? { x: [-12, 12, -8, 8, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-center gap-4 mb-6 py-2"
        role="group"
        aria-label="PIN entry progress"
      >
        {Array.from({ length: maxLength }).map((_, index) => {
          const filled = index < value.length;
          return (
            <motion.div
              key={index}
              animate={{
                scale: filled ? [1, 1.3, 1] : 1,
              }}
              transition={{ duration: 0.18 }}
              className={`
                w-4 h-4 rounded-full border-2 transition-all duration-200
                ${
                  filled
                    ? error
                      ? 'bg-rose-500 border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.7)]'
                      : 'bg-gradient-to-tr from-amber-400 to-amber-200 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                    : 'bg-slate-800 border-slate-600'
                }
              `.trim()}
            />
          );
        })}
      </motion.div>

      {/* 3x4 Grid */}
      <div className="grid grid-cols-3 gap-3 w-full px-2">
        {keys.map((num) => (
          <motion.button
            key={num}
            type="button"
            aria-label={`Digit ${num}`}
            disabled={disabled}
            whileTap={{ scale: 0.88 }}
            onClick={() => handleDigit(num)}
            className="
              h-14 sm:h-16 rounded-2xl bg-slate-800/80 hover:bg-slate-700/90
              border border-slate-700/60 shadow-lg
              flex items-center justify-center text-xl sm:text-2xl font-bold text-white
              active:bg-indigo-600 active:border-indigo-400 active:text-white
              disabled:opacity-40 disabled:pointer-events-none transition-colors select-none
            "
          >
            {num}
          </motion.button>
        ))}

        {/* Clear Key */}
        <motion.button
          type="button"
          disabled={disabled || value.length === 0}
          whileTap={{ scale: 0.88 }}
          onClick={handleClear}
          aria-label="Clear PIN"
          className="
            h-14 sm:h-16 rounded-2xl bg-slate-800/40 hover:bg-slate-800/80
            border border-slate-700/30
            flex items-center justify-center text-slate-400 hover:text-white
            disabled:opacity-20 disabled:pointer-events-none transition-colors select-none
          "
        >
          <X className="w-5 h-5" />
        </motion.button>

        {/* Zero */}
        <motion.button
          type="button"
          aria-label="Digit 0"
          disabled={disabled}
          whileTap={{ scale: 0.88 }}
          onClick={() => handleDigit('0')}
          className="
            h-14 sm:h-16 rounded-2xl bg-slate-800/80 hover:bg-slate-700/90
            border border-slate-700/60 shadow-lg
            flex items-center justify-center text-xl sm:text-2xl font-bold text-white
            active:bg-indigo-600 active:border-indigo-400 active:text-white
            disabled:opacity-40 disabled:pointer-events-none transition-colors select-none
          "
        >
          0
        </motion.button>

        {/* Backspace Key */}
        <motion.button
          type="button"
          disabled={disabled || value.length === 0}
          whileTap={{ scale: 0.88 }}
          onClick={handleDelete}
          aria-label="Backspace"
          className="
            h-14 sm:h-16 rounded-2xl bg-slate-800/40 hover:bg-slate-800/80
            border border-slate-700/30
            flex items-center justify-center text-slate-400 hover:text-white
            disabled:opacity-20 disabled:pointer-events-none transition-colors select-none
          "
        >
          <Delete className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}
