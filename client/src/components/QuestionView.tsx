import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { ActiveQuestionSync, Category, QuestionResult } from '../../../shared/src/index';
import { CATEGORIES } from '../../../shared/src/index';
import { playCorrectChime, playIncorrectBuzzer, playButtonPop } from '../utils/audio';
import confetti from 'canvas-confetti';
import CategoryCharacter, { type CharacterMood } from './characters/CategoryCharacter';
import { CHARACTER_PROFILES } from './characters/characterData';
import Card from './ui/Card';
import Button from './ui/Button';

interface QuestionViewProps {
  question: ActiveQuestionSync;
  isMyTurn: boolean;
  onAnswer: (answerIndex: number, timeSpentMs: number) => void;
  lastResult?: QuestionResult;
  onDismissResult?: () => void;
}

export default function QuestionView({
  question,
  isMyTurn,
  onAnswer,
  lastResult,
  onDismissResult
}: QuestionViewProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(question.durationMs);
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const hasAnsweredRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(question.startedAt || Date.now());

  const categoryInfo = CATEGORIES[question.category] || CATEGORIES.ART;
  const characterProfile = CHARACTER_PROFILES[question.category as Category] || CHARACTER_PROFILES.ART;
  const totalDuration = question.durationMs || 20000;

  // Handle timer countdown
  useEffect(() => {
    startTimeRef.current = question.startedAt || Date.now();
    hasAnsweredRef.current = Boolean(lastResult);
    if (!lastResult) {
      setSelectedIndex(null);
    }
    setImageLoaded(false);
    setImageError(false);

    const interval = setInterval(() => {
      if (hasAnsweredRef.current || lastResult) {
        clearInterval(interval);
        return;
      }

      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, totalDuration - elapsed);
      setTimeLeftMs(remaining);

      if (remaining <= 0 && !hasAnsweredRef.current) {
        hasAnsweredRef.current = true;
        clearInterval(interval);
        if (isMyTurn) {
          playIncorrectBuzzer();
          onAnswer(-1, totalDuration + 500); // Timeout answer
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [question, isMyTurn, onAnswer, totalDuration, lastResult]);

  // Audio / confetti effects on answer result
  useEffect(() => {
    if (lastResult) {
      if (lastResult.wasCorrect) {
        playCorrectChime();
        if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
          navigator.vibrate(50);
        }
        if (lastResult.awardedCrown || lastResult.stolenCrown) {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      } else {
        playIncorrectBuzzer();
        if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
          navigator.vibrate([100, 50, 100]);
        }
      }
    }
  }, [lastResult]);

  const handleSelectOption = useCallback((index: number) => {
    if (!isMyTurn || hasAnsweredRef.current || lastResult) return;

    hasAnsweredRef.current = true;
    setSelectedIndex(index);
    playButtonPop();

    const timeSpent = Math.max(100, Date.now() - startTimeRef.current);
    onAnswer(index, timeSpent);
  }, [isMyTurn, lastResult, onAnswer]);

  const secondsRemaining = Math.ceil(timeLeftMs / 1000);
  const timerPercentage = Math.max(0, Math.min(100, (timeLeftMs / totalDuration) * 100));

  // Determine Character Host Mood dynamically
  let hostMood: CharacterMood = 'thinking';
  if (lastResult) {
    hostMood = lastResult.wasCorrect ? 'celebrating' : 'defeated';
  } else if (secondsRemaining <= 5) {
    hostMood = 'worried';
  } else if (secondsRemaining <= 12) {
    hostMood = 'thinking';
  } else {
    hostMood = 'idle';
  }

  // Determine timer bar color
  let timerBarColor = 'bg-gradient-to-r from-emerald-400 to-teal-500';
  if (secondsRemaining <= 5) {
    timerBarColor = 'bg-gradient-to-r from-rose-500 to-red-600 animate-pulse';
  } else if (secondsRemaining <= 10) {
    timerBarColor = 'bg-gradient-to-r from-amber-400 to-yellow-500';
  }

  const optionLetters = ['A', 'B', 'C', 'D'];

  return (
    <Card
      variant="glass"
      className="flex flex-col w-full max-w-md mx-auto p-0 overflow-hidden shadow-2xl relative z-20 border border-slate-700/80"
    >
      {/* Top Category Character Host Banner */}
      <div
        className="relative px-3.5 py-3 sm:px-4 sm:py-3.5 text-white flex items-center justify-between shadow-md"
        style={{
          background: `linear-gradient(135deg, ${categoryInfo.color}EE, ${categoryInfo.accentColor}EE)`
        }}
      >
        <div className="flex items-center gap-3">
          {/* Animated Category Host Avatar */}
          <CategoryCharacter
            category={question.category}
            size="sm"
            mood={hostMood}
            showCrown={Boolean(question.isCrown)}
            className="shrink-0 drop-shadow-md"
          />
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
              {characterProfile.name} · {characterProfile.title}
            </div>
          </div>
        </div>

        {/* Live Timer Clock Badge */}
        {!lastResult && (
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20">
            <span className="text-xs animate-spin-slow">⏱️</span>
            <span
              className={`font-mono font-black text-xs sm:text-sm ${
                secondsRemaining <= 5 ? 'text-red-300 animate-pulse' : 'text-white'
              }`}
            >
              {secondsRemaining}s
            </span>
          </div>
        )}
      </div>

      {/* Countdown Progress Line */}
      <div className="w-full bg-slate-950 h-2 relative overflow-hidden">
        <motion.div
          className={`h-full ${timerBarColor} shadow-sm`}
          style={{ width: `${lastResult ? 0 : timerPercentage}%` }}
          transition={{ duration: 0.1, ease: 'linear' }}
        />
      </div>

      {/* Question Body */}
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
        <h2 className="text-sm sm:text-base font-black text-center text-white leading-relaxed mb-4 px-1">
          {question.question}
        </h2>

        {/* 4 Interactive Option Cards */}
        <div className="grid grid-cols-1 gap-2.5 w-full">
          {question.options.map((option: string, idx: number) => {
            const letter = optionLetters[idx];
            const isSelected = selectedIndex === idx;

            let cardStyles = 'bg-slate-800/80 text-slate-200 border-slate-700/70 hover:border-slate-500';
            let badgeStyles = 'bg-slate-700 text-slate-200';

            if (lastResult) {
              const isCorrectOption = idx === lastResult.correctIndex;
              if (isCorrectOption) {
                cardStyles = 'bg-emerald-600 text-white border-emerald-300 ring-2 ring-emerald-400 shadow-xl shadow-emerald-500/30 scale-[1.01]';
                badgeStyles = 'bg-emerald-300 text-slate-950 font-black';
              } else if (isSelected && !lastResult.wasCorrect) {
                cardStyles = 'bg-rose-700/90 text-white border-rose-400 ring-2 ring-rose-400 shadow-xl shadow-rose-900/40';
                badgeStyles = 'bg-rose-300 text-slate-950 font-black';
              } else {
                cardStyles = 'bg-slate-950/40 text-slate-500 border-slate-800/60 opacity-40';
                badgeStyles = 'bg-slate-850 text-slate-600';
              }
            } else if (isSelected) {
              cardStyles = 'bg-indigo-600 text-white border-indigo-300 ring-2 ring-indigo-400 shadow-lg shadow-indigo-600/30';
              badgeStyles = 'bg-indigo-200 text-slate-950 font-black';
            }

            return (
              <motion.button
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.05 }}
                whileHover={!hasAnsweredRef.current && isMyTurn && !lastResult ? { scale: 1.01, x: 2 } : undefined}
                whileTap={!hasAnsweredRef.current && isMyTurn && !lastResult ? { scale: 0.98 } : undefined}
                disabled={!isMyTurn || hasAnsweredRef.current || lastResult !== undefined}
                onClick={() => handleSelectOption(idx)}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl border text-left font-bold text-xs sm:text-sm transition-all duration-150 relative ${cardStyles}`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-inner ${badgeStyles}`}
                >
                  {letter}
                </div>
                <span className="flex-1 leading-snug">{option}</span>
                {lastResult && idx === lastResult.correctIndex && (
                  <span className="text-white font-black text-base animate-bounce">✓</span>
                )}
                {lastResult && isSelected && !lastResult.wasCorrect && (
                  <span className="text-white font-black text-base">✗</span>
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
              className={`mt-4 p-4 rounded-3xl border text-center shadow-2xl backdrop-blur-xl relative overflow-hidden ${
                lastResult.wasCorrect
                  ? 'bg-emerald-950/95 border-emerald-400/80 shadow-emerald-500/20 text-emerald-100'
                  : 'bg-rose-950/95 border-rose-400/80 shadow-rose-500/20 text-rose-100'
              }`}
            >
              {/* Host Reaction Quote */}
              <div className="flex items-center justify-center gap-2 mb-2">
                <CategoryCharacter
                  category={question.category}
                  size="sm"
                  mood={lastResult.wasCorrect ? 'celebrating' : 'defeated'}
                />
                <div className="text-left min-w-0">
                  <div className="text-xs font-black uppercase tracking-wider">
                    {lastResult.wasCorrect ? '🎉 Correct!' : '❌ Incorrect!'}
                  </div>
                  <div className="text-[11px] italic font-medium opacity-90 truncate max-w-[220px]">
                    "{lastResult.wasCorrect ? characterProfile.quotes.correct : characterProfile.quotes.incorrect}"
                  </div>
                </div>
              </div>

              {/* Status Outcome */}
              {lastResult.wasCorrect ? (
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-black text-emerald-300">
                    {lastResult.awardedCrown
                      ? `👑 Crown Awarded! You unlocked ${lastResult.awardedCrown}!`
                      : lastResult.stolenCrown
                      ? `⚔️ Crown Captured! You seized ${lastResult.stolenCrown}!`
                      : '⚡ +1 Point added to Crown Gauge!'}
                  </p>
                  <p className="text-[11px] text-emerald-400/90 font-medium">
                    {lastResult.turnContinued ? 'Turn retained — spin again!' : 'Outstanding knowledge!'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-rose-200">
                    Correct answer was:{' '}
                    <span className="text-white font-black underline decoration-emerald-400">
                      {lastResult.correctAnswer}
                    </span>
                  </p>
                  <p className="text-[11px] text-rose-300/90 font-medium">
                    {lastResult.lostCrown
                      ? `💔 Steal failed! Forfeited your ${lastResult.lostCrown} crown!`
                      : 'Turn passes to opponent…'}
                  </p>
                </div>
              )}

              {/* Continue button */}
              {onDismissResult && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onDismissResult}
                  className="mt-3 px-5 py-2 font-black text-xs"
                >
                  Continue ➔
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Full Image Lightbox Modal */}
      {isImageLightboxOpen && question.imageUrl && (
        <div
          onClick={() => setIsImageLightboxOpen(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-lg w-full flex flex-col items-center">
            <button
              onClick={() => setIsImageLightboxOpen(false)}
              className="absolute -top-12 right-0 bg-slate-800 text-white rounded-full px-3 py-1 text-xs font-bold shadow"
            >
              ✕ Close
            </button>
            <img
              src={question.imageUrl}
              alt="Clue Enlarged"
              className="max-h-[75vh] w-auto object-contain rounded-2xl border border-slate-700 shadow-2xl"
            />
            <p className="mt-3 text-xs text-slate-400 text-center">
              Tap anywhere to return • Timer continues
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
