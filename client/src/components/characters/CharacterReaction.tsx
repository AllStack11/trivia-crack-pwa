import { motion, useReducedMotion } from 'motion/react';
import type { Category, QuestionResult } from '../../../../shared/src/index';
import CategoryCharacter from './CategoryCharacter';
import { CHARACTER_ENTRANCES } from './reactions';
import { CHARACTER_PROFILES } from './characterData';

export default function CharacterReaction({ category, quote, result, onContinue, onClose }: {
  category: Category;
  quote: string;
  result?: QuestionResult;
  onContinue?: () => void;
  onClose?: () => void;
}) {
  const reduced = useReducedMotion();
  const correct = result?.wasCorrect ?? true;
  return (
    <section role="status" aria-live="polite" className={`character-reaction ${result ? 'result-banner' : 'sidekick-bubble'} ${correct ? 'result-banner-correct' : 'result-banner-incorrect'} rounded-2xl border p-3 mb-3 relative`}>
      <div className="flex items-center justify-center gap-3">
        <motion.div animate={reduced ? undefined : CHARACTER_ENTRANCES[category]} transition={{ duration: 0.4 }}>
          <CategoryCharacter category={category} size={result ? 'lg' : 'md'} mood="idle" showCrown={Boolean(result?.awardedCrown || result?.stolenCrown || !result)} />
        </motion.div>
        <div className="min-w-0 flex-1">
          <p className="result-title text-xs font-black uppercase">{result ? (correct ? 'CORRECT ANSWER!' : 'INCORRECT!') : `${CHARACTER_PROFILES[category].name} says`}</p>
          <p className={`result-quote rounded-xl bg-white px-3 py-2 mt-1 text-sm font-bold leading-snug ${correct ? 'text-emerald-800' : 'text-rose-900'}`}>“{quote}”</p>
          {result && <p className="reaction-answer text-sm font-bold mt-2">Answer: {result.correctAnswer}</p>}
          {result?.stolenCrown ? <p className="reaction-answer text-xs font-bold">CROWN STOLEN!</p> : result?.awardedCrown ? <p className="reaction-answer text-xs font-bold">CROWN CLAIMED!</p> : null}
        </div>
      </div>
      {onContinue && <button type="button" onClick={onContinue} className={`result-continue-btn w-full mt-2 min-h-11 rounded-xl font-black text-sm text-white ${correct ? 'bg-emerald-600' : 'bg-rose-600'}`}>Continue &rarr;</button>}
      {onClose && <button type="button" aria-label="Dismiss character banter" onClick={onClose} className="reaction-answer absolute top-0 right-0 min-h-11 min-w-11 text-xl">×</button>}
    </section>
  );
}
