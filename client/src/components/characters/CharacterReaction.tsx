import { motion, useReducedMotion } from 'motion/react';
import type { Category, QuestionResult } from '../../../../shared/src/index';
import CategoryCharacter from './CategoryCharacter';
import { CHARACTER_ENTRANCES } from './reactions';
import { CHARACTER_PROFILES } from './characterData';
import { ArrowRight, Check, Crown, Sparkles, X } from 'lucide-react';

export default function CharacterReaction({ category, quote, result, onContinue, onClose }: {
  category: Category;
  quote: string;
  result?: QuestionResult;
  onContinue?: () => void;
  onClose?: () => void;
}) {
  const reduced = useReducedMotion();
  const correct = result?.wasCorrect ?? true;
  const profile = CHARACTER_PROFILES[category];
  return (
    <section role="status" aria-live="polite" className={`character-reaction cartoon-pop-in ${result ? 'result-banner' : 'sidekick-bubble'} ${correct ? 'reaction-correct' : 'reaction-incorrect'}`}>
      <motion.div className="cartoon-mascot" initial={reduced ? false : { x: '-100vw', opacity: 0 }} animate={reduced ? { opacity: 1 } : { ...CHARACTER_ENTRANCES[category], opacity: [0, 1, 1, 1] }} transition={{ duration: 0.65, times: [0, 0.55, 0.8, 1] }}>
        <span aria-hidden="true" className="cartoon-impact"><Sparkles size={22} /></span>
        <CategoryCharacter category={category} size="xl" mood="idle" showCrown={Boolean(result?.awardedCrown || result?.stolenCrown || !result)} />
      </motion.div>
      <motion.div className="cartoon-speech" initial={reduced ? false : { opacity: 0, scale: 0.9, y: 22 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 390, damping: 27, delay: 0.16 }}>
        <div className="speech-heading">
          <span className="speech-status-icon" aria-hidden="true">{result ? correct ? <Check size={16} /> : <X size={16} /> : <Sparkles size={16} />}</span>
          <div>
            <p className="speech-speaker">{profile.name}</p>
            <p className="result-title">{result ? (correct ? 'CORRECT ANSWER!' : 'INCORRECT!') : profile.title}</p>
          </div>
        </div>
        <div className="speech-body">
          <p className="result-quote">{quote}</p>
          {result && <div className="speech-answer"><span>Correct answer</span><p className="reaction-answer">{result.correctAnswer}</p></div>}
          {(result?.stolenCrown || result?.awardedCrown) && <p className="speech-crown"><Crown size={15} aria-hidden="true" />{result.stolenCrown ? 'CROWN STOLEN!' : 'CROWN CLAIMED!'}</p>}
        </div>
        {onContinue && <motion.button type="button" onClick={onContinue} whileTap={reduced ? undefined : { scale: 0.97 }} className="result-continue-btn cartoon-continue">Continue <ArrowRight size={17} aria-hidden="true" /></motion.button>}
        {onClose && <button type="button" aria-label="Dismiss character banter" onClick={onClose} className="cartoon-dismiss"><X size={18} aria-hidden="true" /></button>}
      </motion.div>
    </section>
  );
}
