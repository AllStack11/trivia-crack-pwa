import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type {
  ActiveQuestionSync,
  QuestionResult,
  WheelSlice,
} from '../../shared/src/index';
import { CATEGORIES, SPIN_RESULT_HOLD_MS } from '../../shared/src/index';
import CrownBar from './components/CrownBar';
import CrownModal from './components/CrownModal';
import Lobby from './components/Lobby';
import PackCreator from './components/PackCreator';
import QuestionView from './components/QuestionView';
import Wheel from './components/Wheel';
import { useGameSync } from './hooks/useGameSync';
import type { AccountSession } from './components/Lobby';
import { apiUrl } from './utils/api';
import {
  playAudioCue,
  installAudioLifecycle,
  stopAllAudio,
  triggerHaptic,
  isAudioMuted,
  setAudioMuted,
  playButtonPop,
} from './utils/audio';
import confetti from 'canvas-confetti';
import { GameAudioTracker } from './utils/gameAudio';
import AnimatedBackground from './components/ui/AnimatedBackground';
import Button from './components/ui/Button';
import Card from './components/ui/Card';
import AppHeader from './components/navigation/AppHeader';
import OfflineBanner from './components/ui/OfflineBanner';
import PWAInstallBanner from './components/ui/PWAInstallBanner';
import IOSInstallSheet from './components/ui/IOSInstallSheet';
import { ToastProvider, useToast } from './components/ui/Toast';
import { usePWA, setAppBadge } from './hooks/usePWA';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useAppUpdate } from './hooks/useAppUpdate';
import { detachPush, serializePush } from './utils/push';

type AppView = 'LOBBY' | 'PACK_CREATOR' | 'GAME';

function AppContent() {
  const { showToast, showConfirm } = useToast();
  const pwa = usePWA();

  const [view, setView] = useState<AppView>('LOBBY');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const push = usePushNotifications(account);
  const appUpdate = useAppUpdate();
  const [muted, setMuted] = useState<boolean>(isAudioMuted());
  const [showIOSSheet, setShowIOSSheet] = useState<boolean>(false);

  // Wheel animation control state to prevent skipping the spinner
  const [isWheelSpinning, setIsWheelSpinning] = useState<boolean>(false);
  const [wheelTargetDegrees, setWheelTargetDegrees] = useState<number | undefined>(undefined);
  const [landedCategoryName, setLandedCategoryName] = useState<string | null>(null);
  const lastAnimatedSpinRef = useRef<string | null>(null);
  const spinPendingRef = useRef(false);
  const [spinPending, setSpinPending] = useState(false);
  const spinHoldTimerRef = useRef<number | undefined>(undefined);

  // Result review state: keeps question on screen for 3s to show green/red indicator
  const [activeReviewResult, setActiveReviewResult] = useState<{
    question: ActiveQuestionSync;
    result: QuestionResult;
  } | null>(null);
  const resultReviewTimerRef = useRef<number | undefined>(undefined);
  const lastReviewedResultKeyRef = useRef<string | null>(null);

  // Restore credentials only after the server confirms the account session
  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      setRestoreError(null);
      try {
        const raw = localStorage.getItem('trivia_clash_account');
        if (raw) {
          let saved: AccountSession;
          try { saved = JSON.parse(raw) as AccountSession; }
          catch { localStorage.removeItem('trivia_clash_account'); return; }
          if (saved.id && saved.username && saved.token) {
            const response = await fetch(apiUrl('/api/me'), {
              signal: AbortSignal.timeout(10000),
              headers: { Authorization: `Bearer ${saved.token}` },
            });
            if (response.ok) {
              const data = (await response.json()) as {
                account: { id: string; username: string };
              };
              if (mounted) {
                setAccount({ ...data.account, token: saved.token });
                if (window.location.pathname.startsWith('/game/')) {
                  setActiveGameId(
                    decodeURIComponent(window.location.pathname.slice('/game/'.length))
                  );
                  setView('GAME');
                } else if (window.location.pathname === '/packs') setView('PACK_CREATOR');
              }
            } else if (response.status === 401) {
              localStorage.removeItem('trivia_clash_account');
              void serializePush(() => detachPush()).catch(() => {});
              void setAppBadge(0);
            } else if (mounted) setRestoreError('Could not restore your profile. Your sign-in is saved; reconnect to retry.');
          } else localStorage.removeItem('trivia_clash_account');
        }
      } catch {
        if (mounted) setRestoreError('Could not restore your profile. Your sign-in is saved; reconnect to retry.');
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };
    void restore();
    return () => {
      mounted = false;
    };
  }, [restoreAttempt]);

  useEffect(() => {
    const resume = () => {
      if (!account && localStorage.getItem('trivia_clash_account')) {
        setAuthLoading(true); setRestoreAttempt(attempt => attempt + 1);
      }
    };
    window.addEventListener('online', resume);
    return () => window.removeEventListener('online', resume);
  }, [account]);

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
    stopAllAudio();
    await serializePush(() => detachPush(account?.token)).catch(() => {});
    void setAppBadge(0);
    if (account) {
      try {
        await fetch(apiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${account.token}` },
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
    showToast('Signed out', 'info');
  }, [account, showToast]);

  const handleUnauthorized = useCallback(() => {
    void serializePush(() => detachPush()).catch(() => {});
    void setAppBadge(0);
    setAccount(null);
    setActiveGameId(null);
    setView('LOBBY');
    localStorage.removeItem('trivia_clash_account');
    window.history.replaceState(null, '', '/');
    showToast('Session expired. Please sign in again.', 'error');
  }, [showToast]);

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
    spin,
    answer,
    chooseCrown,
    resign,
  } = useGameSync({
    gameId: activeGameId,
    accountId: account?.id ?? null,
    sessionToken: account?.token ?? null,
    onUnauthorized: handleUnauthorized,
  });

  // When spectator (Player 2) receives opponent's spin via SSE, trigger wheel animation
  useEffect(() => {
    if (!gameState) return;

    if (
      gameState.lastSpin &&
      gameState.currentTurnPlayerId !== account?.id &&
      lastAnimatedSpinRef.current !== gameState.lastSpin.id
    ) {
      lastAnimatedSpinRef.current = gameState.lastSpin.id;
      setWheelTargetDegrees(gameState.lastSpin.targetDegrees);
      setIsWheelSpinning(true);
      setLandedCategoryName(null);
    }
  }, [gameState, account?.id]);

  useEffect(() => {
    lastAnimatedSpinRef.current = null;
    lastReviewedResultKeyRef.current = null;
    setIsWheelSpinning(false);
    setWheelTargetDegrees(undefined);
    setLandedCategoryName(null);
    setActiveReviewResult(null);
    return () => {
      clearTimeout(resultReviewTimerRef.current);
      clearTimeout(spinHoldTimerRef.current);
    };
  }, [activeGameId]);

  useEffect(() => {
    if (gameState?.mode === 'QUESTION') {
      setActiveReviewResult((review) => review?.question.id === gameState.activeQuestion?.id ? review : null);
    }
  }, [gameState?.mode, gameState?.activeQuestion?.id]);

  // When spectator receives opponent's answer result (via SSE or polling), display result review for 3s
  useEffect(() => {
    // Only show completed answer review when not in the middle of a question
    if (!gameState?.lastResult || gameState.mode === 'QUESTION') return;

    const result = gameState.lastResult;
    const reviewQuestion = result.question;
    if (!reviewQuestion) return;

    const resultKey = `${reviewQuestion.id}_${result.nextPlayerId}_${result.wasCorrect}_${result.correctIndex}`;
    if (lastReviewedResultKeyRef.current === resultKey) return;

    lastReviewedResultKeyRef.current = resultKey;
    setActiveReviewResult({
      question: reviewQuestion,
      result: result,
    });
    clearTimeout(resultReviewTimerRef.current);
    resultReviewTimerRef.current = window.setTimeout(() => {
      setActiveReviewResult(null);
    }, 3000);
  }, [gameState?.lastResult, gameState?.mode]);
  useEffect(() => {
    return () => {
      clearTimeout(resultReviewTimerRef.current);
    };
  }, []);


  const audioTrackerRef = useRef(new GameAudioTracker());
  useEffect(() => installAudioLifecycle(), []);
  useEffect(() => {
    audioTrackerRef.current.reset();
    stopAllAudio();
    return stopAllAudio;
  }, [activeGameId, account?.id, view]);
  useEffect(() => {
    if (view !== 'GAME' || !gameState || gameState.id !== activeGameId || !account) return;
    const cues = audioTrackerRef.current.observe(gameState, account.id);
    for (const cue of cues) {
      if (cue === 'victory' || cue === 'defeat') stopAllAudio();
      playAudioCue(cue, 0, cue === 'turn' && cues.length > 1 ? .65 : 0);
      if (cue === 'correct' || cue === 'crown' || cue === 'steal') triggerHaptic('success');
      if (cue === 'incorrect' || cue === 'timeout' || cue === 'defeat') triggerHaptic('error');
      if (cue === 'victory') {
        triggerHaptic('heavy');
        confetti({ particleCount: 140, spread: 85, origin: { y: .45 } });
      }
    }
  }, [gameState, activeGameId, account, view]);

  const handleOpenGame = (gameId: string) => {
    setActiveGameId(gameId);
    setView('GAME');
    setIsWheelSpinning(false);
    setLandedCategoryName(null);
    clearTimeout(resultReviewTimerRef.current);
    lastReviewedResultKeyRef.current = null;
    setActiveReviewResult(null);
    window.history.pushState(null, '', `/game/${encodeURIComponent(gameId)}`);
  };

  const handleNavigateToPacks = () => {
    setView('PACK_CREATOR');
    window.history.pushState(null, '', '/packs');
  };

  const handleNavigateToLobby = () => {
    if (gameState?.status === 'IN_PROGRESS') {
      showConfirm({
        title: 'Leave Match?',
        message: 'You can resume this duel anytime from your duels dashboard.',
        confirmText: 'Leave',
        onConfirm: () => {
          setActiveGameId(null);
          setIsWheelSpinning(false);
          setLandedCategoryName(null);
          clearTimeout(resultReviewTimerRef.current);
          lastReviewedResultKeyRef.current = null;
          setActiveReviewResult(null);
          setView('LOBBY');
          window.history.pushState(null, '', '/');
        },
      });
      return;
    }

    setActiveGameId(null);
    setIsWheelSpinning(false);
    setLandedCategoryName(null);
    clearTimeout(resultReviewTimerRef.current);
    lastReviewedResultKeyRef.current = null;
    setActiveReviewResult(null);
    setView('LOBBY');
    window.history.pushState(null, '', '/');
  };

  // Lock immediately while the request is pending, before the wheel animation starts.
  const handleSpinStart = async () => {
    if (isWheelSpinning || spinPendingRef.current) return;
    spinPendingRef.current = true;
    setSpinPending(true);
    setLandedCategoryName(null);
    clearTimeout(resultReviewTimerRef.current);
    setActiveReviewResult(null);
    try {
      const res = await spin();
      if (res) {
        lastAnimatedSpinRef.current = res.state.lastSpin?.id ?? null;
        setWheelTargetDegrees(res.targetDegrees);
        setIsWheelSpinning(true);
      }
    } finally {
      spinPendingRef.current = false;
      setSpinPending(false);
    }
  };

  // Wheel animation completes
  const handleSpinComplete = useCallback((landedSlice: WheelSlice) => {
    const info = landedSlice === 'CROWN' ? null : CATEGORIES[landedSlice];
    const catName = info ? `${info.characterName} (${info.name})` : 'Golden Crown Battle!';
    setLandedCategoryName(catName);
    playAudioCue(landedSlice === 'CROWN' ? 'crownLanding' : 'landing');

    spinHoldTimerRef.current = window.setTimeout(() => {
      setIsWheelSpinning(false);
      setLandedCategoryName(null);
    }, SPIN_RESULT_HOLD_MS);
  }, []);

  const handleAnswerQuestion = async (
    targetQuestion: ActiveQuestionSync,
    ansIdx: number,
    timeMs: number
  ) => {
    const res = await answer(targetQuestion.id, ansIdx, timeMs);
    if (res) {
      const resultKey = `${targetQuestion.id}_${res.nextPlayerId}_${res.wasCorrect}_${res.correctIndex}`;
      lastReviewedResultKeyRef.current = resultKey;
      setActiveReviewResult({
        question: targetQuestion,
        result: res,
      });
      clearTimeout(resultReviewTimerRef.current);
      resultReviewTimerRef.current = window.setTimeout(() => {
        setActiveReviewResult(null);
      }, 3000);
      return true;
    }
    return false;
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
    playButtonPop();
  };

  const handleShareApp = async () => {
    const shared = await pwa.shareApp({
      title: 'Trivia Clash',
      text: 'Challenge me to a real-time crown trivia duel on Trivia Clash!',
    });
    if (shared) {
      showToast('Duel invite link copied to clipboard!', 'success');
    }
  };

  const handleForfeit = () => {
    showConfirm({
      title: 'Forfeit Match?',
      message:
        'Are you sure you want to forfeit this duel? Your opponent will be awarded victory.',
      confirmText: 'Forfeit',
      isDestructive: true,
      onConfirm: () => {
        void resign();
        showToast('You forfeited the match', 'info');
      },
    });
  };

  const isMyTurn = Boolean(
    gameState && account && gameState.currentTurnPlayerId === account.id
  );

  const shouldShowWheel =
    !activeReviewResult &&
    gameState?.status === 'IN_PROGRESS' &&
    (isWheelSpinning || gameState.mode === 'SPIN' || gameState.mode === 'SPINNING');

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

  const opponentName = gameState
    ? gameState.players.p1.id === account?.id
      ? gameState.players.p2?.username ?? 'Opponent'
      : gameState.players.p1.username
    : '';

  return (
    <div className="trivia-app h-[100dvh] max-h-[100dvh] w-full text-slate-100 flex flex-col justify-between overflow-hidden relative select-none">
      {/* Dynamic Cosmic Animated Background with Reactive Category Lighting */}
      <AnimatedBackground activeCategory={activeCategory} />

      {/* Top App Header */}
      <AppHeader
        account={account}
        onLogout={handleLogout}
        isOnline={pwa.isOnline}
        isInstallable={pwa.isInstallable}
        onInstallApp={pwa.installApp}
        onShareApp={handleShareApp}
        muted={muted}
        onToggleMute={toggleMute}
        currentView={view}
        onBackToLobby={handleNavigateToLobby}
        title={
          view === 'GAME'
            ? gameState
              ? `vs. ${opponentName}`
              : 'Match'
            : view === 'PACK_CREATOR'
            ? 'Pack Studio'
            : undefined
        }
      />

      {appUpdate.available && view === 'LOBBY' && <div className="relative z-30 bg-indigo-100 p-3 flex items-center justify-between gap-3 text-sm" role="status">
        <span>A new version is ready.</span>
        <button type="button" onClick={appUpdate.update} className="rounded-xl bg-indigo-600 text-white px-4 py-2 font-bold">Update app</button>
      </div>}

      {/* Floating Offline Notification Banner */}
      <OfflineBanner isOnline={pwa.isOnline} />

      {/* PWA Install Banner */}
      {view === 'LOBBY' && <PWAInstallBanner
        isInstallable={pwa.isInstallable}
        isInstalled={pwa.isInstalled}
        isIOS={pwa.isIOS}
        onInstall={pwa.installApp}
        onShowIOSGuide={() => setShowIOSSheet(true)}
      />}

      {/* iOS Safari Home-Screen Guide Sheet */}
      <IOSInstallSheet
        isOpen={showIOSSheet}
        onClose={() => setShowIOSSheet(false)}
      />

      {/* Main Viewport Router with Fluid Directional Transitions */}
      <div className="flex-1 flex flex-col w-full h-full overflow-hidden relative">
        <AnimatePresence mode="wait">
          {view === 'PACK_CREATOR' && (
            <motion.main
              key="pack_creator"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="flex-1 flex flex-col h-full overflow-hidden z-20"
            >
              <PackCreator onBack={handleNavigateToLobby} />
            </motion.main>
          )}

          {view === 'LOBBY' && (
            <motion.main
              key="lobby"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="flex-1 flex flex-col h-full overflow-hidden z-20"
            >
              {authLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-3xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-2xl animate-spin">
                    👑
                  </div>
                  <div className="text-sm font-bold text-slate-300">
                    Restoring your account…
                  </div>
                </div>
              ) : (
                <>
                {restoreError && <div className="relative z-30 bg-amber-100 p-3 text-sm" role="status">
                  <p>{restoreError}</p>
                  <button type="button" className="font-bold mt-2" onClick={() => { setAuthLoading(true); setRestoreAttempt(attempt => attempt + 1); }}>Reconnect to your profile</button>
                </div>}
                <Lobby
                  push={push}
                  onInstallGuide={() => setShowIOSSheet(true)}
                  account={account}
                  onAuth={handleAuth}
                  onLogout={handleLogout}
                  onOpenGame={handleOpenGame}
                  onOpenPackCreator={handleNavigateToPacks}
                />
                </>
              )}
            </motion.main>
          )}

          {view === 'GAME' && account && gameState && (
            <motion.main
              key="game"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="flex-1 flex flex-col max-w-md mx-auto w-full h-full overflow-hidden justify-between z-20 px-3 py-1"
            >
              {/* Connection Status indicator */}
              <div className="flex items-center justify-between px-2 py-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      gameState.status === 'COMPLETED' ? 'bg-slate-400' : isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span className="text-[11px] font-bold">
                    {gameState.status === 'COMPLETED' ? 'Match complete' : isConnected ? 'Realtime Match' : 'Reconnecting...'}
                  </span>
                </div>
                {gameState.status === 'IN_PROGRESS' && (
                  <button
                    type="button"
                    onClick={handleForfeit}
                    className="text-[11px] font-bold text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    Forfeit Match 🏳️
                  </button>
                )}
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
              <div className="flex-1 min-h-0 flex flex-col justify-center items-center py-1 overflow-y-auto w-full">
                {/* STAGE: WHEEL */}
                {shouldShowWheel && (
                  <div className="w-full flex flex-col items-center justify-center relative">
                    <Wheel
                      canSpin={isMyTurn && !isWheelSpinning && !spinPending}
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
                {shouldShowQuestion &&
                  (activeReviewResult || gameState.activeQuestion) && (
                    <div className="w-full h-full flex flex-col justify-center">
                      <QuestionView
                        key={activeReviewResult?.question.id ?? gameState.activeQuestion?.id}
                        question={
                          activeReviewResult
                            ? activeReviewResult.question
                            : gameState.activeQuestion!
                        }
                        isMyTurn={isMyTurn && !activeReviewResult}
                        onAnswer={(ansIdx, timeMs) => {
                          if (gameState.activeQuestion) {
                            return handleAnswerQuestion(
                              gameState.activeQuestion,
                              ansIdx,
                              timeMs
                            );
                          }
                          return false;
                        }}
                        lastResult={
                          activeReviewResult ? activeReviewResult.result : undefined
                        }
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
                      animate={{
                        rotate: [0, -10, 10, -5, 0],
                        scale: [1, 1.15, 1],
                      }}
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
            </motion.main>
          )}

          {view === 'GAME' && account && !gameState && (
            <motion.main
              key="game_loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center text-sm text-slate-400 z-20"
            >
              {gameError || (gameLoading ? 'Loading match…' : 'Match unavailable')}
            </motion.main>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
