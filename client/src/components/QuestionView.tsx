import { questionTimeRemaining } from '../utils/gameState';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { ActiveQuestionSync, Category, QuestionResult } from '../../../shared/src/index';
import { CATEGORIES } from '../../../shared/src/index';
import { playAudioCue, playButtonPop } from '../utils/audio';
import { CountdownAudioTracker } from '../utils/gameAudio';
import { requestWakeLock, releaseWakeLock } from '../hooks/usePWA';
import confetti from 'canvas-confetti';
import CategoryCharacter, { type CharacterMood } from './characters/CategoryCharacter';
import { CHARACTER_PROFILES } from './characters/characterData';
import { Sparkles, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface QuestionViewProps {
  question: ActiveQuestionSync;
  isMyTurn: boolean;
  onAnswer: (answerIndex: number, timeSpentMs: number) => void | boolean | Promise<void | boolean>;
  lastResult?: QuestionResult;
  onDismissResult?: () => void;
}

export default function QuestionView({
  question,
  isMyTurn,
  onAnswer,
  lastResult,
  onDismissResult,
}: QuestionViewProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(questionTimeRemaining(question));
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const hasAnsweredRef = useRef<boolean>(false);
  const retryAfterRef = useRef(0);
  const [submitting, setSubmitting] = useState(false);
  const onAnswerRef = useRef(onAnswer);
  onAnswerRef.current = onAnswer;
  const startTimeRef = useRef<number>(question.startedAt || Date.now());

  const categoryInfo = CATEGORIES[question.category] || CATEGORIES.ART;
  const characterProfile =
    CHARACTER_PROFILES[question.category as Category] || CHARACTER_PROFILES.ART;
  const totalDuration = question.durationMs || 20000;

  const countdownAudio = useRef(new CountdownAudioTracker());
  const revealedQuestion = useRef<string | null>(null);
  useEffect(() => {
    countdownAudio.current = new CountdownAudioTracker();
    if (!lastResult && revealedQuestion.current !== question.id) {
      revealedQuestion.current = question.id;
      playAudioCue('reveal');
    }
  }, [question.id]);

  // Wake lock management during question
  useEffect(() => {
    void requestWakeLock();
    return () => {
      void releaseWakeLock();
    };
  }, []);

  // Reset state when a new question ID is displayed
  useEffect(() => {
    startTimeRef.current = question.startedAt;
    setTimeLeftMs(questionTimeRemaining(question));
    retryAfterRef.current = 0;
    setSubmitting(false);
    hasAnsweredRef.current = Boolean(lastResult);
    if (!lastResult) {
      setSelectedIndex(null);
    }
    setImageLoaded(false);
    setImageError(false);
  }, [question.id, question.startedAt, totalDuration]);

  const submitAnswer = useCallback(async (index: number, elapsed: number) => {
    if (hasAnsweredRef.current) return;
    hasAnsweredRef.current = true;
    setSubmitting(true);
    try {
      const success = await onAnswerRef.current(index, elapsed);
      if (success === false) {
        hasAnsweredRef.current = false;
        setSelectedIndex(null);
        retryAfterRef.current = Date.now() + 1000;
      }
    } catch {
      hasAnsweredRef.current = false;
      setSelectedIndex(null);
      retryAfterRef.current = Date.now() + 1000;
    } finally {
      setSubmitting(false);
    }
  }, []);

  // Handle timer countdown
  useEffect(() => {
    // If already answered or displaying result review, timer should not run
    if (hasAnsweredRef.current || lastResult) return;

    const interval = setInterval(() => {
      if (hasAnsweredRef.current || lastResult) {
        clearInterval(interval);
        return;
      }

      const elapsed = Date.now() - startTimeRef.current;
      const remaining = questionTimeRemaining({ startedAt: startTimeRef.current, durationMs: totalDuration });
      setTimeLeftMs(remaining);
      const pulse = countdownAudio.current.pulse(remaining, isMyTurn && !hasAnsweredRef.current);
      if (pulse !== null) playAudioCue('countdown', pulse);

      if (remaining <= 0 && !hasAnsweredRef.current && Date.now() >= retryAfterRef.current) {
        void releaseWakeLock();
        if (isMyTurn) {
          void submitAnswer(-1, Math.max(0, elapsed));
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [question.id, isMyTurn, totalDuration, lastResult, submitAnswer, submitting]);

  // Audio / confetti effects on answer result
  useEffect(() => {
    if (lastResult) {
      void releaseWakeLock();
      if (lastResult.wasCorrect) {
        if (lastResult.awardedCrown || lastResult.stolenCrown) {
          confetti({
            particleCount: 90,
            spread: 80,
            origin: { y: 0.6 },
          });
        }
      }
    }
  }, [lastResult]);

  const handleSelectOption = useCallback(
    (index: number) => {
      if (!isMyTurn || hasAnsweredRef.current || lastResult) return;

      setSelectedIndex(index);
      playButtonPop();
      void releaseWakeLock();

      const timeSpent = Math.max(100, Date.now() - startTimeRef.current);
      void submitAnswer(index, timeSpent);
    },
    [isMyTurn, lastResult, submitAnswer]
  );

  const secondsRemaining = Math.ceil(timeLeftMs / 1000);
  const timerPercentage = Math.max(0, Math.min(100, (timeLeftMs / totalDuration) * 100));

  // Dynamic host mood
  let hostMood: CharacterMood = 'thinking';
  let emojiBubble = '🤔';
  if (lastResult) {
    if (lastResult.wasCorrect) {
      hostMood = 'celebrating';
      emojiBubble = '🎉';
    } else {
      hostMood = 'defeated';
      emojiBubble = '💥';
    }
  } else if (secondsRemaining <= 5) {
    hostMood = 'worried';
    emojiBubble = '⏳';
  } else if (secondsRemaining <= 10) {
    hostMood = 'thinking';
    emojiBubble = '⚡';
  } else {
    hostMood = 'idle';
    emojiBubble = '✨';
  }

  // Timer color gradient transitions
  let timerBarColor = 'bg-gradient-to-r from-emerald-400 to-teal-500';
  let timerTextColor = 'text-emerald-300';
  if (secondsRemaining <= 5) {
    timerBarColor = 'bg-gradient-to-r from-rose-500 to-red-600 animate-pulse';
    timerTextColor = 'text-rose-400 animate-pulse';
  } else if (secondsRemaining <= 10) {
    timerBarColor = 'bg-gradient-to-r from-amber-400 to-yellow-500';
    timerTextColor = 'text-amber-300';
  }

  const optionLetters = ['A', 'B', 'C', 'D'];

  return (
    <div className="flex flex-col w-full max-w-md mx-auto h-full justify-between relative z-20 select-none pb-4">
      <div className="flex flex-col w-full rounded-3xl bg-slate-900/95 border border-slate-700/80 shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* Category Header Banner with Mascot & Timer */}
        <div
          className="question-host relative px-4 py-3.5 text-white flex items-center justify-between shadow-md"
          style={{
            background: `linear-gradient(135deg, ${categoryInfo.color}EE, ${categoryInfo.accentColor}EE)`,
          }}
        >
          <div className="flex items-center gap-3">
            {/* Mascot Character with Animated Mood Bubble */}
            <div className="relative">
              <CategoryCharacter
                category={question.category}
                size="md"
                mood={hostMood}
                showCrown={Boolean(question.isCrown)}
                className="shrink-0 drop-shadow-lg"
              />
              <motion.div
                key={emojiBubble}
                initial={{ scale: 0, y: 5 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', damping: 15 }}
                className="absolute -top-1.5 -right-2 text-xs bg-slate-950/80 px-1 py-0.5 rounded-full border border-white/30 shadow"
              >
                {emojiBubble}
              </motion.div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-black tracking-widest text-white/90">
                  {categoryInfo.name}
                </span>
                {question.isCrown && (
                  <span className="px-1.5 py-0.2 rounded-full bg-yellow-400 text-slate-950 text-[9px] font-black tracking-wide shadow">
                    👑 {question.isSteal ? 'STEAL DUEL' : 'CROWN MATCH'}
                  </span>
                )}
              </div>
              <div className="text-xs sm:text-sm font-black text-white leading-tight">
                {characterProfile.name} &bull; {characterProfile.title}
              </div>
            </div>
          </div>

          {/* Live Countdown Clock */}
          {!lastResult && (
            <div className="flex items-center gap-1.5 bg-black/45 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-inner">
              <Clock className={`w-3.5 h-3.5 ${timerTextColor}`} />
              <span className={`font-mono font-black text-xs sm:text-sm ${timerTextColor}`}>
                {secondsRemaining}s
              </span>
            </div>
          )}
        </div>

        {/* Dynamic Countdown Bar */}
        <div className="w-full bg-slate-950 h-2 relative overflow-hidden">
          <motion.div
            className={`h-full ${timerBarColor} shadow-md`}
            style={{ width: `${lastResult ? 0 : timerPercentage}%` }}
            transition={{ duration: 0.1, ease: 'linear' }}
          />
        </div>

        {/* Question Content */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-center">
          {/* Optional Question Image */}
          {question.imageUrl && !imageError && (
            <div className="relative mb-3 flex flex-col items-center">
              <div
                onClick={() => setIsImageLightboxOpen(true)}
                className="relative w-full max-h-36 sm:max-h-44 rounded-2xl overflow-hidden bg-slate-950/80 border border-slate-700/60 flex items-center justify-center cursor-pointer group hover:border-indigo-400 transition-all shadow-inner"
              >
                {!imageLoaded && (
                  <div className="absolute inset-0 bg-slate-900 animate-pulse flex items-center justify-center text-xs text-slate-500">
                    Loading clue…
                  </div>
                )}
                <img
                  src={question.imageUrl}
                  alt="Trivia Clue"
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  className={`max-h-36 sm:max-h-44 w-auto object-contain transition-transform duration-300 group-hover:scale-105 ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <div className="absolute bottom-2 right-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-lg text-[9px] font-bold text-slate-200 flex items-center gap-1 shadow">
                  <span>🔍 Zoom</span>
                </div>
              </div>
            </div>
          )}

          {/* Question Text */}
          <h2 className="text-base sm:text-lg font-black text-center text-white leading-snug mb-5 px-1">
            {question.question}
          </h2>

          {/* 4 Interactive Option Cards */}
          <div className="grid grid-cols-1 gap-2.5 w-full">
            {question.options.map((option: string, idx: number) => {
              const letter = optionLetters[idx];
              const isSelected = selectedIndex === idx;

              let cardStyles =
                'bg-slate-800/80 text-slate-200 border-slate-700/70 hover:border-slate-500 shadow-md';
              let badgeStyles =
                'bg-emerald-100 text-slate-800 border border-emerald-200';

              if (lastResult) {
                const isCorrectOption = idx === lastResult.correctIndex;
                if (isCorrectOption) {
                  cardStyles =
                    'bg-emerald-600 text-white border-emerald-300 ring-2 ring-emerald-400 shadow-xl shadow-emerald-500/30 scale-[1.01]';
                  badgeStyles = 'bg-emerald-300 text-slate-950 font-black border border-emerald-200';
                } else if (isSelected && !lastResult.wasCorrect) {
                  cardStyles =
                    'bg-rose-700 text-white border-rose-400 ring-2 ring-rose-400 shadow-xl shadow-rose-900/40';
                  badgeStyles = 'bg-rose-300 text-slate-950 font-black border border-rose-200';
                } else {
                  cardStyles = 'bg-slate-950/40 text-slate-500 border-slate-800/60 opacity-40';
                  badgeStyles = 'bg-slate-900 text-slate-600 border border-slate-800';
                }
              } else if (isSelected) {
                cardStyles =
                  'bg-indigo-600 text-white border-indigo-300 ring-2 ring-indigo-400 shadow-lg shadow-indigo-600/30';
                badgeStyles = 'bg-indigo-200 text-slate-950 font-black border border-indigo-100';
              }

              const isIncorrectSelection = lastResult && isSelected && !lastResult.wasCorrect;

              return (
                <motion.button
                  key={idx}
                  initial={{ opacity: 0, y: 12 }}
                  animate={
                    isIncorrectSelection
                      ? { x: [-8, 8, -6, 6, -3, 3, 0], opacity: 1, y: 0 }
                      : { opacity: 1, y: 0 }
                  }
                  transition={{ duration: isIncorrectSelection ? 0.4 : 0.25, delay: idx * 0.04 }}
                  whileHover={
                    !hasAnsweredRef.current && isMyTurn && !lastResult
                      ? { scale: 1.01, x: 2 }
                      : undefined
                  }
                  whileTap={
                    !hasAnsweredRef.current && isMyTurn && !lastResult ? { scale: 0.96 } : undefined
                  }
                  disabled={!isMyTurn || submitting || hasAnsweredRef.current || lastResult !== undefined}
                  onClick={() => handleSelectOption(idx)}
                  className={`
                    flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border text-left font-bold text-xs sm:text-sm
                    transition-all duration-150 relative cursor-pointer disabled:cursor-default
                    ${cardStyles}
                  `}
                >
                  {/* Metallic letter pill */}
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-inner ${badgeStyles}`}
                  >
                    {letter}
                  </div>

                  <span className="flex-1 leading-snug">{option}</span>

                  {lastResult && idx === lastResult.correctIndex && (
                    <span className="text-white font-black text-base animate-bounce">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </span>
                  )}
                  {lastResult && isSelected && !lastResult.wasCorrect && (
                    <span className="text-white font-black text-base">
                      <AlertCircle className="w-5 h-5 text-white" />
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* High Impact Result Announcement */}
          <AnimatePresence>
            {lastResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`mt-4 p-4 rounded-3xl border text-center shadow-xl backdrop-blur-xl relative overflow-hidden ${
                  lastResult.wasCorrect
                    ? 'result-banner result-banner-correct bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'result-banner result-banner-incorrect bg-rose-50 border-rose-300 text-rose-950'
                }`}
              >
                {/* Host Reaction Quote */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CategoryCharacter
                    category={question.category}
                    size="sm"
                    mood={lastResult.wasCorrect ? 'celebrating' : 'defeated'}
                  />
                  <div
                    className={`result-quote text-xs font-black ${
                      lastResult.wasCorrect ? 'text-emerald-800' : 'text-rose-900'
                    }`}
                  >
                    {lastResult.wasCorrect
                      ? `"${characterProfile.quotes.correct}"`
                      : `"${characterProfile.quotes.incorrect}"`}
                  </div>
                </div>

                <div
                  className={`result-title font-black text-sm sm:text-base tracking-wide ${
                    lastResult.wasCorrect ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {lastResult.wasCorrect ? 'CORRECT ANSWER!' : 'INCORRECT!'}
                </div>

                {lastResult.awardedCrown && (
                  <div className="text-xs font-black text-amber-700 mt-1 flex items-center justify-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>CROWN CLAIMED! You conquered {categoryInfo.name}!</span>
                  </div>
                )}
                {lastResult.stolenCrown && (
                  <div className="text-xs font-black text-amber-700 mt-1 flex items-center justify-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>CROWN STOLEN FROM OPPONENT!</span>
                  </div>
                )}

                {onDismissResult && (
                  <button
                    type="button"
                    onClick={() => {
                      playButtonPop();
                      onDismissResult();
                    }}
                    className={`result-continue-btn mt-3 py-2 px-6 rounded-xl font-black text-xs transition-all shadow-md active:scale-95 text-white ${
                      lastResult.wasCorrect
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                        : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                    }`}
                  >
                    Continue &rarr;
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Image Lightbox Modal */}
      <AnimatePresence>
        {isImageLightboxOpen && question.imageUrl && (
          <div
            onClick={() => setIsImageLightboxOpen(false)}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          >
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              src={question.imageUrl}
              alt="Trivia Clue Full"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/20"
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
