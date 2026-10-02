import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import type {
  ActiveQuestionSync,
  QuestionResult,
  WheelSlice
} from '../../shared/src/index';
import { CATEGORIES } from '../../shared/src/index';
import CrownBar from './components/CrownBar';
import CrownModal from './components/CrownModal';
import Lobby from './components/Lobby';
import PackCreator from './components/PackCreator';
import QuestionView from './components/QuestionView';
import Wheel from './components/Wheel';
import { useGameSync } from './hooks/useGameSync';
import type { AccountSession } from './components/Lobby';
import { apiUrl } from './utils/api';
import { playFanfare, playCorrectChime, isAudioMuted, setAudioMuted, playButtonPop } from './utils/audio';
import confetti from 'canvas-confetti';
import { Ssgoi, type SsgoiConfig } from '@ssgoi/react';
import { drill, sheet, fade } from '@ssgoi/react/view-transitions';
import AnimatedBackground from './components/ui/AnimatedBackground';
import Button from './components/ui/Button';
import Card from './components/ui/Card';

type AppView = 'LOBBY' | 'PACK_CREATOR' | 'GAME';

const ssgoiConfig: SsgoiConfig = {
  transitions: [
    { from: '/', to: '/packs', transition: sheet({ type: 'blur' }) },
    { from: '/packs', to: '/', transition: sheet({ type: 'blur' }) },
    { from: '/', to: '/game/*', transition: drill({ type: 'parallax' }) },
    { from: '/game/*', to: '/', transition: drill({ type: 'parallax' }) },
    { on: '/**', transition: fade() }
  ]
};

export default function App() {
  const [view, setView] = useState<AppView>('LOBBY');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [muted, setMuted] = useState<boolean>(isAudioMuted());

  // Wheel animation control state to prevent skipping the spinner
  const [isWheelSpinning, setIsWheelSpinning] = useState<boolean>(false);
  const [wheelTargetDegrees, setWheelTargetDegrees] = useState<number | undefined>(undefined);
  const [landedCategoryName, setLandedCategoryName] = useState<string | null>(null);
  const lastAnimatedSpinRef = useRef<number | null>(null);

  // Result review state: keeps question on screen for 3s to show green/red indicator
  const [activeReviewResult, setActiveReviewResult] = useState<{
    question: ActiveQuestionSync;
    result: QuestionResult;
  } | null>(null);
  const resultReviewTimerRef = useRef<number | undefined>(undefined);

  // Restore credentials only after the server confirms the account session.
  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      try {
        const raw = localStorage.getItem('trivia_clash_account');
        if (raw) {
          const saved = JSON.parse(raw) as AccountSession;
          if (saved.id && saved.username && saved.token) {
            const response = await fetch(apiUrl('/api/me'), {
              headers: { Authorization: `Bearer ${saved.token}` }
            });
            if (response.ok) {
              const data = (await response.json()) as { account: { id: string; username: string } };
              if (mounted) {
                setAccount({ ...data.account, token: saved.token });
                if (window.location.pathname.startsWith('/game/')) {
                  setActiveGameId(decodeURIComponent(window.location.pathname.slice('/game/'.length)));
                  setView('GAME');
                } else if (window.location.pathname === '/packs') setView('PACK_CREATOR');
              }
            } else localStorage.removeItem('trivia_clash_account');
          } else localStorage.removeItem('trivia_clash_account');
        }
      } catch {
        localStorage.removeItem('trivia_clash_account');
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };
    void restore();
    return () => {
      mounted = false;
    };
  }, []);

  const handleAuth = (authenticated: AccountSession) => {
    setAccount(authenticated);
    try {
      localStorage.setItem('trivia_clash_account', JSON.stringify(authenticated));
    } catch {
      /* Storage may be unavailable. */
    }
    if (window.location.pathname.startsWith('/game/')) {
      const gameId = decodeURIComponent(window.location.pathname.slice('/game/'.length));
      setActiveGameId(gameId);
      setView('GAME');
    } else if (window.location.pathname === '/packs') setView('PACK_CREATOR');
  };

  const handleLogout = useCallback(async () => {
    if (account) {
      try {
        await fetch(apiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${account.token}` }
        });
      } catch {
        /* Local credentials are cleared even when network is unavailable. */
      }
    }
    setAccount(null);
    setActiveGameId(null);
    setView('LOBBY');
    localStorage.removeItem('trivia_clash_account');
    window.history.pushState(null, '', '/');
  }, [account]);

  const handleUnauthorized = useCallback(() => {
    setAccount(null);
    setActiveGameId(null);
    setView('LOBBY');
    localStorage.removeItem('trivia_clash_account');
    window.history.replaceState(null, '', '/');
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/packs') setView('PACK_CREATOR');
      else if (path.startsWith('/game/')) {
        const gameId = path.slice('/game/'.length);
        if (gameId) {
          setActiveGameId(decodeURIComponent(gameId));
          setView('GAME');
        }
      } else {
        setActiveGameId(null);
        setView('LOBBY');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const {
    gameState,
    isConnected,
    loading: gameLoading,
    error: gameError,
    targetDegrees,
    lastResult,
    spin,
    answer,
    chooseCrown,
    resign
  } = useGameSync({
    gameId: activeGameId,
    accountId: account?.id ?? null,
    sessionToken: account?.token ?? null,
    onUnauthorized: handleUnauthorized
  });

  // When spectator (Player 2) receives opponent's spin via SSE, trigger wheel animation
  useEffect(() => {
    if (!gameState) return;

    if (
      gameState.lastSpin &&
      gameState.currentTurnPlayerId !== account?.id &&
      lastAnimatedSpinRef.current !== gameState.lastSpin.targetDegrees
    ) {
      lastAnimatedSpinRef.current = gameState.lastSpin.targetDegrees;
      setWheelTargetDegrees(gameState.lastSpin.targetDegrees);
      setIsWheelSpinning(true);
      setLandedCategoryName(null);
    }
  }, [gameState, account?.id]);

  // When spectator receives opponent's answer result via SSE, display result review for 3s
  useEffect(() => {
    if (
      gameState?.lastResult &&
      gameState.currentTurnPlayerId !== account?.id &&
      gameState.activeQuestion
    ) {
      setActiveReviewResult({
        question: gameState.activeQuestion,
        result: gameState.lastResult
      });
      clearTimeout(resultReviewTimerRef.current);
      resultReviewTimerRef.current = window.setTimeout(() => {
        setActiveReviewResult(null);
      }, 3000);
    }
  }, [gameState?.lastResult, gameState?.currentTurnPlayerId, gameState?.activeQuestion, account?.id]);

  // Handle Game Over victory sound & confetti
  useEffect(() => {
    if (gameState?.status === 'COMPLETED' && gameState.winnerId) {
      if (gameState.winnerId === account?.id) {
        playFanfare();
        confetti({
          particleCount: 140,
          spread: 85,
          origin: { y: 0.45 }
        });
      }
    }
  }, [gameState?.status, gameState?.winnerId, account?.id]);

  const handleOpenGame = (gameId: string) => {
    setActiveGameId(gameId);
    setView('GAME');
    setIsWheelSpinning(false);
    setLandedCategoryName(null);
    clearTimeout(resultReviewTimerRef.current);
    setActiveReviewResult(null);
    window.history.pushState(null, '', `/game/${encodeURIComponent(gameId)}`);
  };

  const handleNavigateToPacks = () => {
    setView('PACK_CREATOR');
    window.history.pushState(null, '', '/packs');
  };

  const handleNavigateToLobby = () => {
    if (
      gameState?.status === 'IN_PROGRESS' &&
      !confirm('Leave this game? You can resume it from your matches dashboard.')
    )
      return;
    setActiveGameId(null);
    setIsWheelSpinning(false);
    setLandedCategoryName(null);
    clearTimeout(resultReviewTimerRef.current);
    setActiveReviewResult(null);
    setView('LOBBY');
    window.history.pushState(null, '', '/');
  };

  // User initiates wheel spin
  const handleSpinStart = async () => {
    if (isWheelSpinning) return;
    setLandedCategoryName(null);

    const res = await spin();
    if (res) {
      lastAnimatedSpinRef.current = res.targetDegrees;
      setWheelTargetDegrees(res.targetDegrees);
      setIsWheelSpinning(true);
    }
  };

  // Wheel animation completes
  const handleSpinComplete = useCallback((landedSlice: WheelSlice) => {
    const info = landedSlice === 'CROWN' ? null : CATEGORIES[landedSlice];
    const catName = info ? `${info.characterName} (${info.name})` : 'Golden Crown Battle!';
    setLandedCategoryName(catName);
    playCorrectChime();

    // Celebratory pause before transitioning to Question
    setTimeout(() => {
      setIsWheelSpinning(false);
      setLandedCategoryName(null);
    }, 900);
  }, []);

  // Answer question and hold result on screen for 3s to show outcome
  const handleAnswerQuestion = async (
    targetQuestion: ActiveQuestionSync,
    ansIdx: number,
    timeMs: number
  ) => {
    const res = await answer(targetQuestion.id, ansIdx, timeMs);
    if (res) {
      setActiveReviewResult({
        question: targetQuestion,
        result: res
      });
      clearTimeout(resultReviewTimerRef.current);
      resultReviewTimerRef.current = window.setTimeout(() => {
        setActiveReviewResult(null);
      }, 3000);
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
    playButtonPop();
  };

  const isMyTurn = Boolean(
    gameState && account && gameState.currentTurnPlayerId === account.id
  );

  const shouldShowWheel =
    !activeReviewResult &&
    gameState?.status === 'IN_PROGRESS' &&
    (isWheelSpinning ||
      gameState.mode === 'SPIN' ||
      gameState.mode === 'SPINNING');

  const shouldShowQuestion =
    Boolean(activeReviewResult) ||
    (!isWheelSpinning &&
      gameState?.status === 'IN_PROGRESS' &&
      gameState.mode === 'QUESTION' &&
      Boolean(gameState.activeQuestion));

  const shouldShowCrownModal =
    !activeReviewResult &&
    !isWheelSpinning &&
    gameState?.status === 'IN_PROGRESS' &&
    gameState.mode === 'CROWN_CHOICE';

  const activeCategory = shouldShowQuestion
    ? activeReviewResult?.question.category ?? gameState?.activeQuestion?.category ?? null
    : null;

  return (
    <Ssgoi config={ssgoiConfig}>
      {/* Dynamic Cosmic Animated Background with Reactive Category Lighting */}
      <AnimatedBackground activeCategory={activeCategory} />

      <div className="h-[100dvh] max-h-[100dvh] text-slate-100 flex flex-col justify-between p-2 sm:p-4 overflow-hidden relative z-10">
        {/* View: Pack Creator */}
        {view === 'PACK_CREATOR' && (
          <main className="flex-1 flex items-center justify-center py-2 animate-scale-up z-20">
            <PackCreator onBack={handleNavigateToLobby} />
          </main>
        )}

        {/* View: Lobby */}
        {view === 'LOBBY' && (
          <main className="flex-1 flex items-center justify-center py-2 z-20">
            {authLoading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-xl animate-spin">
                  👑
                </div>
                <div className="text-sm font-bold text-slate-300">Restoring your account…</div>
              </div>
            ) : (
              <Lobby
                account={account}
                onAuth={handleAuth}
                onLogout={handleLogout}
                onOpenGame={handleOpenGame}
                onOpenPackCreator={handleNavigateToPacks}
              />
            )}
          </main>
        )}

        {/* View: Active Game */}
        {view === 'GAME' && account && gameState && (
          <div className="flex-1 flex flex-col max-w-md mx-auto w-full gap-2 sm:gap-3 h-full overflow-hidden justify-between z-20">
            {/* Top Navigation & Status Bar */}
            <div className="flex items-center justify-between bg-slate-900/80 backdrop-blur-xl border border-slate-700/80 rounded-2xl px-3.5 py-2 text-xs shrink-0 shadow-lg">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleNavigateToLobby}
                  className="text-slate-300 hover:text-white font-extrabold flex items-center gap-1 transition"
                >
                  <span>←</span>
                  <span>Lobby</span>
                </button>
                <span className="text-slate-700">|</span>
                <span className="font-extrabold text-amber-300 truncate max-w-[160px]">
                  vs.{' '}
                  {gameState.players.p1.id === account.id
                    ? gameState.players.p2?.username ?? 'Waiting…'
                    : gameState.players.p1.username}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Audio quick toggle */}
                <button
                  onClick={toggleMute}
                  className="text-xs p-1 rounded-lg hover:bg-slate-800 transition"
                  title={muted ? 'Unmute Audio' : 'Mute Audio'}
                >
                  {muted ? '🔇' : '🔊'}
                </button>

                {/* Connection Status */}
                <div
                  className="flex items-center gap-1.5 bg-slate-950/60 px-2 py-0.5 rounded-full border border-slate-800"
                  title={isConnected ? 'Realtime Match Active' : 'Connecting to match…'}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider">
                    {isConnected ? 'LIVE' : 'SYNC'}
                  </span>
                </div>
              </div>
            </div>

            {gameError && (
              <div
                role="alert"
                className="p-2.5 bg-red-950/70 border border-red-800 rounded-2xl text-xs text-red-200 text-center font-bold"
              >
                {gameError}
              </div>
            )}

            {/* Players Crown Status Bar */}
            <CrownBar state={gameState} myPlayerId={account.id} />

            {/* Center Stage Area */}
            <div className="flex-1 min-h-0 flex flex-col justify-center items-center py-0.5 overflow-y-auto w-full">
              {/* STAGE: WHEEL */}
              {shouldShowWheel && (
                <div className="w-full flex flex-col items-center justify-center relative">
                  <Wheel
                    canSpin={isMyTurn && !isWheelSpinning}
                    isSpinning={isWheelSpinning}
                    targetDegrees={wheelTargetDegrees || targetDegrees}
                    onSpinStart={handleSpinStart}
                    onSpinComplete={handleSpinComplete}
                  />

                  {landedCategoryName && (
                    <motion.div
                      initial={{ scale: 0, y: 10 }}
                      animate={{ scale: 1, y: 0 }}
                      className="absolute bottom-2 bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 px-4 py-1.5 rounded-full font-black text-xs shadow-2xl border border-yellow-200"
                    >
                      🎯 {landedCategoryName}
                    </motion.div>
                  )}
                </div>
              )}

              {/* STAGE: QUESTION */}
              {shouldShowQuestion && (activeReviewResult || gameState.activeQuestion) && (
                <div className="w-full">
                  <QuestionView
                    question={
                      activeReviewResult
                        ? activeReviewResult.question
                        : gameState.activeQuestion!
                    }
                    isMyTurn={isMyTurn && !activeReviewResult}
                    onAnswer={(ansIdx, timeMs) => {
                      if (gameState.activeQuestion) {
                        handleAnswerQuestion(gameState.activeQuestion, ansIdx, timeMs);
                      }
                    }}
                    lastResult={activeReviewResult ? activeReviewResult.result : lastResult}
                    onDismissResult={() => {
                      clearTimeout(resultReviewTimerRef.current);
                      setActiveReviewResult(null);
                    }}
                  />
                </div>
              )}

              {/* STAGE: CROWN CHOICE MODAL */}
              {shouldShowCrownModal && (
                <CrownModal
                  state={gameState}
                  myPlayerId={account.id}
                  onChooseCrown={(action, category, wagerCategory) => {
                    chooseCrown(action, category, wagerCategory);
                  }}
                />
              )}

              {/* STAGE: GAME OVER CELEBRATION */}
              {gameState.status === 'COMPLETED' && (
                <Card
                  variant="glow"
                  className="w-full p-6 text-center shadow-2xl flex flex-col items-center gap-4 border border-amber-400/40 relative z-30"
                >
                  <motion.div
                    animate={{ rotate: [0, -10, 10, -5, 0], scale: [1, 1.15, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center text-4xl shadow-xl shadow-amber-500/30 border-2 border-yellow-200"
                  >
                    👑
                  </motion.div>

                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">
                      {gameState.winnerId === account.id
                        ? '🎉 Victory is Yours!'
                        : `${
                            gameState.winnerId === gameState.players.p1.id
                              ? gameState.players.p1.username
                              : gameState.players.p2?.username ?? 'Opponent'
                          } Won the Match!`}
                    </h2>
                    <p className="text-xs text-amber-300 font-extrabold mt-1 uppercase tracking-wider">
                      {gameState.winReason || 'Crown Duel Concluded'}
                    </p>
                  </div>

                  {/* Player Summary Stats Grid */}
                  <div className="w-full bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex justify-around items-center text-xs">
                    <div>
                      <div className="text-slate-400 font-bold">
                        {gameState.players.p1.username}
                      </div>
                      <div className="text-lg font-black text-amber-400">
                        👑 {gameState.players.p1.crowns.length}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        ⭐ {gameState.players.p1.score} correct
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-black text-slate-400 text-xs">
                      VS
                    </div>

                    <div>
                      <div className="text-slate-400 font-bold">
                        {gameState.players.p2?.username || 'Opponent'}
                      </div>
                      <div className="text-lg font-black text-amber-400">
                        👑 {gameState.players.p2?.crowns.length || 0}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        ⭐ {gameState.players.p2?.score || 0} correct
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    glow
                    onClick={handleNavigateToLobby}
                    className="w-full"
                  >
                    Return to Lobby ➔
                  </Button>
                </Card>
              )}
            </div>

            {/* Match In-Progress Footer: Forfeit option */}
            {gameState.status === 'IN_PROGRESS' && (
              <div className="flex justify-center shrink-0 py-1">
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to forfeit this match?')) {
                      resign();
                    }
                  }}
                  className="text-[11px] font-bold text-slate-500 hover:text-rose-400 transition"
                >
                  Forfeit Match 🏳️
                </button>
              </div>
            )}
          </div>
        )}

        {view === 'GAME' && account && !gameState && (
          <main className="flex-1 flex items-center justify-center text-sm text-slate-400 z-20">
            {gameError || (gameLoading ? 'Loading match…' : 'Match unavailable')}
          </main>
        )}

        {/* Global Footer */}
        <footer className="text-center py-1 text-[10px] text-slate-500 font-medium shrink-0 z-20">
          Trivia Clash • Turn-Based Crown Duels
        </footer>
      </div>
    </Ssgoi>
  );
}
