import { useState, useEffect, useRef, useCallback } from 'react';
import type { ActiveQuestionSync, QuestionResult } from '../../../shared/src/index';
import { CATEGORIES } from '../../../shared/src/index';
import { playCorrectChime, playIncorrectBuzzer, playButtonPop } from '../utils/audio';
import confetti from 'canvas-confetti';

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

  // Trigger celebration sounds / confetti / haptics when result arrives
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

  // Determine timer bar color
  let timerBarColor = 'bg-emerald-500';
  if (secondsRemaining <= 5) {
    timerBarColor = 'bg-red-500 animate-pulse';
  } else if (secondsRemaining <= 10) {
    timerBarColor = 'bg-amber-400';
  }

  const optionLetters = ['A', 'B', 'C', 'D'];

  return (
    <div className="flex flex-col w-full max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-scale-up">
      {/* Top Category Banner */}
      <div
        className="relative px-3.5 py-2.5 sm:px-4 sm:py-3 text-white flex items-center justify-between shadow-md"
        style={{ backgroundColor: categoryInfo.color }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-lg sm:text-xl font-bold shadow-inner shrink-0">
            {question.category === 'ART' && '🎨'}
            {question.category === 'SCIENCE' && '🔬'}
            {question.category === 'SPORTS' && '🏆'}
            {question.category === 'ENTERTAINMENT' && '🎬'}
            {question.category === 'GEOGRAPHY' && '🌍'}
            {question.category === 'HISTORY' && '⏳'}
          </div>
          <div>
            <div className="text-[10px] sm:text-xs uppercase font-black tracking-wider text-white/80">
              {categoryInfo.name}
            </div>
            <div className="text-xs sm:text-sm font-bold text-white leading-tight">
              {categoryInfo.characterName} — {categoryInfo.characterTitle}
            </div>
          </div>
        </div>

        {/* Crown Badge if this is a Crown Match */}
        {question.isCrown && (
          <div className="flex items-center gap-1 bg-yellow-400 text-slate-950 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black tracking-wide shadow-md animate-bounce-short">
            <span>👑</span>
            <span>{question.isSteal ? 'STEAL' : 'CROWN'}</span>
          </div>
        )}
      </div>

      {/* Countdown Timer Bar */}
      <div className="w-full bg-slate-800 h-1.5 sm:h-2 relative overflow-hidden">
        <div
          className={`h-full transition-all duration-100 ease-linear ${timerBarColor}`}
          style={{ width: `${lastResult ? 0 : timerPercentage}%` }}
        />
      </div>

      {/* Timer Digits and Turn Indicator */}
      <div className="flex items-center justify-between px-3.5 pt-2 text-[11px] sm:text-xs font-medium text-slate-400">
        <div>
          {lastResult ? (
            <span className="text-slate-300 font-bold">Answer Evaluated</span>
          ) : isMyTurn ? (
            <span className="text-indigo-400 font-bold">Your turn to answer!</span>
          ) : (
            <span className="text-slate-400">Opponent is answering...</span>
          )}
        </div>
        {!lastResult && (
          <div className="flex items-center gap-1">
            <span
              className={`font-mono font-bold text-xs sm:text-sm ${
                secondsRemaining <= 5 ? 'text-red-400 animate-pulse' : 'text-slate-300'
              }`}
            >
              {secondsRemaining}s
            </span>
          </div>
        )}
      </div>

      {/* Question Card Content */}
      <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 flex-1 flex flex-col justify-center">
        {/* Optional Visual Image Container */}
        {question.imageUrl && !imageError && (
          <div className="relative mb-2.5 flex flex-col items-center">
            <div
              onClick={() => setIsImageLightboxOpen(true)}
              className="relative w-full max-h-32 sm:max-h-40 rounded-2xl overflow-hidden bg-slate-800/80 border border-slate-700/60 flex items-center justify-center cursor-pointer group hover:border-indigo-400 transition-all shadow-inner"
            >
              {!imageLoaded && (
                <div className="absolute inset-0 bg-slate-800 animate-pulse flex items-center justify-center text-xs text-slate-500">
                  Loading visual clue...
                </div>
              )}
              <img
                src={question.imageUrl}
                alt="Trivia Clue"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                className={`max-h-32 sm:max-h-40 w-auto object-contain transition-transform duration-200 group-hover:scale-105 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <div className="absolute bottom-1.5 right-1.5 bg-slate-950/70 backdrop-blur-md px-1.5 py-0.5 rounded-md text-[9px] font-semibold text-slate-300 flex items-center gap-1 shadow">
                <span>🔍</span>
                <span>Zoom</span>
              </div>
            </div>
          </div>
        )}

        {/* Question Text Prompt */}
        <h2 className="text-sm sm:text-base font-bold text-center text-white leading-snug px-1 mb-3">
          {question.question}
        </h2>

        {/* 4 Answer Choice Buttons */}
        <div className="grid grid-cols-1 gap-2 w-full">
          {question.options.map((option, idx) => {
            const letter = optionLetters[idx];
            const isSelected = selectedIndex === idx;

            let buttonStyle = 'bg-slate-800/90 text-slate-200 border-slate-700/80';
            let badgeStyle = 'bg-slate-700 text-slate-300';

            // Post-answer results highlighting: VERY PROMINENT
            if (lastResult) {
              const isCorrectOption = idx === lastResult.correctIndex;
              if (isCorrectOption) {
                // Correct answer is always glowing green!
                buttonStyle =
                  'bg-emerald-600 text-white border-emerald-300 shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-400 transform scale-[1.01]';
                badgeStyle = 'bg-emerald-300 text-slate-950 font-black';
              } else if (isSelected && !lastResult.wasCorrect) {
                // Picked wrong option is glowing red!
                buttonStyle =
                  'bg-rose-700/90 text-white border-rose-400 shadow-lg shadow-rose-900/50 ring-2 ring-rose-400';
                badgeStyle = 'bg-rose-300 text-slate-950 font-black';
              } else {
                buttonStyle = 'bg-slate-900/50 text-slate-500 border-slate-800/60 opacity-50';
                badgeStyle = 'bg-slate-850 text-slate-600';
              }
            } else if (isSelected) {
              buttonStyle = 'bg-indigo-600 text-white border-indigo-400 shadow-md ring-2 ring-indigo-400';
              badgeStyle = 'bg-indigo-300 text-slate-950 font-black';
            } else if (isMyTurn && !hasAnsweredRef.current) {
              buttonStyle = 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700/80 active:scale-[0.98]';
            }

            return (
              <button
                key={idx}
                disabled={!isMyTurn || hasAnsweredRef.current || lastResult !== undefined}
                onClick={() => handleSelectOption(idx)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left font-medium text-xs sm:text-sm transition-all duration-200 ${buttonStyle}`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${badgeStyle}`}
                >
                  {letter}
                </div>
                <span className="flex-1 leading-snug">{option}</span>
                {lastResult && idx === lastResult.correctIndex && (
                  <span className="text-white font-extrabold text-sm sm:text-base animate-bounce">✓</span>
                )}
                {lastResult && isSelected && !lastResult.wasCorrect && (
                  <span className="text-white font-extrabold text-sm sm:text-base">✗</span>
                )}
              </button>
            );
          })}
        </div>

        {/* HIGH-IMPACT RESULT FEEDBACK OVERLAY BANNER */}
        {lastResult && (
          <div
            className={`mt-3 p-3 rounded-2xl border text-center transition-all animate-scale-up ${
              lastResult.wasCorrect
                ? 'bg-emerald-950/95 border-emerald-500 shadow-xl shadow-emerald-950/50 text-emerald-200'
                : 'bg-rose-950/95 border-rose-500 shadow-xl shadow-rose-950/50 text-rose-200'
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-xl sm:text-2xl leading-none">
                {lastResult.wasCorrect ? '🎉' : '❌'}
              </span>
              <span className="text-base sm:text-lg font-black uppercase tracking-wide">
                {lastResult.wasCorrect ? 'CORRECT!' : 'INCORRECT!'}
              </span>
            </div>

            {lastResult.wasCorrect ? (
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-extrabold text-emerald-300">
                  {lastResult.awardedCrown
                    ? `👑 Crown Awarded! You unlocked ${lastResult.awardedCrown}!`
                    : lastResult.stolenCrown
                    ? `⚔️ Crown Captured! You stole ${lastResult.stolenCrown}!`
                    : '⚡ +1 Point to Crown Gauge!'}
                </p>
                <p className="text-[10px] sm:text-xs text-emerald-400/90 font-medium">
                  {lastResult.turnContinued ? 'You retain your turn — prepare to spin again!' : 'Great job!'}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-semibold text-rose-300">
                  Correct answer was:{' '}
                  <span className="text-white font-black underline decoration-emerald-400">
                    {lastResult.correctAnswer}
                  </span>
                </p>
                <p className="text-[10px] sm:text-xs text-rose-400 font-medium">
                  {lastResult.lostCrown
                    ? `💔 Steal failed! You forfeited your ${lastResult.lostCrown} crown!`
                    : 'Turn passes to opponent...'}
                </p>
              </div>
            )}

            {/* Quick Continue Button */}
            {onDismissResult && (
              <button
                onClick={onDismissResult}
                className="mt-2.5 px-4 py-1.5 bg-white text-slate-950 font-black text-xs rounded-full shadow hover:bg-slate-200 transition transform active:scale-95"
              >
                Continue ➔
              </button>
            )}
          </div>
        )}
      </div>

      {/* Full Resolution Image Lightbox Modal */}
      {isImageLightboxOpen && question.imageUrl && (
        <div
          onClick={() => setIsImageLightboxOpen(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fade-in"
        >
          <div className="relative max-w-lg w-full flex flex-col items-center">
            <button
              onClick={() => setIsImageLightboxOpen(false)}
              className="absolute -top-12 right-0 bg-slate-800 text-white rounded-full p-2 hover:bg-slate-700 text-xs font-bold shadow"
            >
              ✕ Close
            </button>
            <img
              src={question.imageUrl}
              alt="Clue Enlarged"
              className="max-h-[75vh] w-auto object-contain rounded-2xl border border-slate-700 shadow-2xl"
            />
            <p className="mt-3 text-[10px] text-slate-400 text-center">
              Tap anywhere outside to close • Timer continues
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
