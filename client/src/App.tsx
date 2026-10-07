import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import type {
  ActiveQuestionSync,
  QuestionResult,
  WheelSlice,
} from '../../shared/src/index';
import { SPIN_RESULT_HOLD_MS } from '../../shared/src/index';

import { SIDEKICK_MS, createDialogueSelector, crownReaction } from './components/characters/reactions';
import CharacterReaction from './components/characters/CharacterReaction';
import { createReviewTimer } from './utils/reviewTimer';
import CrownBar from './components/CrownBar';
import CrownModal from './components/CrownModal';
import Lobby from './components/Lobby';
import TurnNotification from './components/TurnNotification';
import PackCreator from './components/PackCreator';
import QuestionView from './components/QuestionView';
import Wheel from './components/Wheel';
import SpinArena from './components/SpinArena';
import { useGameSync } from './hooks/useGameSync';
import type { AccountSession } from './components/Lobby';
import type { LobbyTab } from './components/navigation/BottomNav';
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
import InstallNotificationModal from './components/ui/InstallNotificationModal';
import { ToastProvider, useToast } from './components/ui/Toast';
import { usePWA, setAppBadge } from './hooks/usePWA';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useAppUpdate } from './hooks/useAppUpdate';
import { detachPush, serializePush } from './utils/push';
import { resetMatchAcceptedTracking } from './utils/matchAccepted';

type AppView = 'LOBBY' | 'PACK_CREATOR' | 'GAME';

// Spins already animated on this device; persisted so returning to a match doesn't replay them.
const SEEN_SPINS_KEY = 'trivia-seen-spins';
const SEEN_SPINS_MAX = 200;
const seenSpins: string[] = (() => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_SPINS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
})();
const hasSeenSpin = (id: string) => seenSpins.includes(id);
const markSpinSeen = (id: string) => {
  if (seenSpins.includes(id)) return;
  seenSpins.push(id);
  if (seenSpins.length > SEEN_SPINS_MAX) seenSpins.splice(0, seenSpins.length - SEEN_SPINS_MAX);
  try {
    localStorage.setItem(SEEN_SPINS_KEY, JSON.stringify(seenSpins));
  } catch { /* storage unavailable */ }
};

function AppContent() {
  const { showToast } = useToast();
  const reducedMotion = useReducedMotion();
  const pwa = usePWA();

  const [view, setView] = useState<AppView>(() => window.location.pathname.startsWith('/game/') ? 'GAME' : 'LOBBY');
  const [activeGameId, setActiveGameId] = useState<string | null>(() => window.location.pathname.startsWith('/game/') ? decodeURIComponent(window.location.pathname.slice(6)) || null : null);
  const [lobbyTab, setLobbyTab] = useState<LobbyTab>('matches');
  const [highlightedInviteId, setHighlightedInviteId] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const push = usePushNotifications(account);
  const appUpdate = useAppUpdate();
  const [muted, setMuted] = useState<boolean>(isAudioMuted());
  const [showIOSSheet, setShowIOSSheet] = useState<boolean>(false);

  const applyRoute = useCallback((pathname: string, search: string = '') => {
    if (pathname.startsWith('/game/')) {
      const gameId = decodeURIComponent(pathname.slice('/game/'.length));
      if (gameId) {
        setActiveGameId(gameId);
        setView('GAME');
        setIsWheelSpinning(false);
        reviewTimer.cancel();
        lastReviewedResultKeyRef.current = null;
        setActiveReviewResult(null);
        return;
      }
    }
    if (pathname === '/packs') {
      setActiveGameId(null);
      setView('PACK_CREATOR');
      return;
    }
    if (pathname === '/invites' || pathname === '/invitations') {
      const params = new URLSearchParams(search);
      const inviteId = params.get('id') || params.get('invite');
      setActiveGameId(null);
      setView('LOBBY');
      setLobbyTab('players');
      setHighlightedInviteId(inviteId || null);
      return;
    }
    const params = new URLSearchParams(search);
    const tabParam = params.get('tab');
    if (tabParam === 'players' || tabParam === 'matches' || tabParam === 'champions' || tabParam === 'packs') {
      setActiveGameId(null);
      setView('LOBBY');
      setLobbyTab(tabParam as LobbyTab);
      const inviteId = params.get('id') || params.get('invite');
      setHighlightedInviteId(inviteId || null);
      return;
    }
    setActiveGameId(null);
    setView('LOBBY');
  }, []);

  // Wheel animation control state to prevent skipping the spinner
  const [isWheelSpinning, setIsWheelSpinning] = useState<boolean>(false);
  const [wheelTargetDegrees, setWheelTargetDegrees] = useState<number | undefined>(undefined);
  const spinPendingRef = useRef(false);
  const [spinPending, setSpinPending] = useState(false);
  const spinHoldTimerRef = useRef<number | undefined>(undefined);

  // Result review stays visible for six seconds, with immediate dismissal.
  const [activeReviewResult, setActiveReviewResult] = useState<{
    question: ActiveQuestionSync;
    result: QuestionResult;
    quote: string;
  } | null>(null);
  const [reviewTimer] = useState(createReviewTimer);
  const lastReviewedResultKeyRef = useRef<string | null>(null);
  const presentationBaselineRef = useRef<string | null>(null);
  const [selectDialogue] = useState(createDialogueSelector);
  const [sidekick, setSidekick] = useState<(NonNullable<ReturnType<typeof crownReaction>> & { quote: string }) | null>(null);
  const sidekickTimerRef = useRef<number | undefined>(undefined);
  const previousReviewRef = useRef<typeof activeReviewResult>(null);
  const reviewGenerationRef = useRef(0);


  // Restore credentials only after the server confirms the account session
  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      let authenticated = false;
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
                authenticated = true;
                applyRoute(window.location.pathname, window.location.search);
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
        if (mounted) {
          if (!authenticated) setView('LOBBY');
          setAuthLoading(false);
        }
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
    applyRoute(window.location.pathname, window.location.search);
  };

  const handleLogout = useCallback(async () => {
    stopAllAudio();
    await serializePush(() => detachPush(account?.token)).catch(() => {});
    void setAppBadge(0);
    resetMatchAcceptedTracking();
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
    resetMatchAcceptedTracking();
    setAccount(null);
    setActiveGameId(null);
    setView('LOBBY');
    localStorage.removeItem('trivia_clash_account');
    window.history.replaceState(null, '', '/');
    showToast('Session expired. Please sign in again.', 'error');
  }, [showToast]);

  useEffect(() => {
    const handlePopState = () => {
      applyRoute(window.location.pathname, window.location.search);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [applyRoute]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE' && typeof event.data.url === 'string') {
        try {
          const parsed = new URL(event.data.url, window.location.origin);
          window.history.pushState(null, '', parsed.pathname + parsed.search);
          applyRoute(parsed.pathname, parsed.search);
        } catch {
          applyRoute(window.location.pathname, window.location.search);
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [applyRoute]);

  const {
    gameState,
    isConnected,
    presence,
    loading: gameLoading,
    error: gameError,
    targetDegrees,
    spin,
    answer,
    chooseCrown,
  } = useGameSync({
    gameId: activeGameId,
    accountId: account?.id ?? null,
    sessionToken: account?.token ?? null,
    onUnauthorized: handleUnauthorized,
  });

  useEffect(() => {
    reviewGenerationRef.current++;
    lastReviewedResultKeyRef.current = null;
    presentationBaselineRef.current = null;
    previousReviewRef.current = null;
    setSidekick(null);
    clearTimeout(sidekickTimerRef.current);
    setIsWheelSpinning(false);
    setWheelTargetDegrees(undefined);
    setActiveReviewResult(null);
    return () => {
      reviewTimer.cancel();
      clearTimeout(spinHoldTimerRef.current);
      clearTimeout(sidekickTimerRef.current);
    };
  }, [activeGameId, account?.id, view]);

  // Restoration establishes a baseline; persisted events are not new animations.
  useEffect(() => {
    if (view !== 'GAME' || !gameState || gameState.id !== activeGameId) return;
    if (presentationBaselineRef.current !== gameState.id) {
      presentationBaselineRef.current = gameState.id;
      if (gameState.lastSpin) markSpinSeen(gameState.lastSpin.id);
      const result = gameState.lastResult;
      if (result?.question) lastReviewedResultKeyRef.current = `${result.question.id}_${result.nextPlayerId}_${result.wasCorrect}_${result.correctIndex}`;
      return;
    }
    if (gameState.lastSpin && gameState.currentTurnPlayerId !== account?.id && !hasSeenSpin(gameState.lastSpin.id)) {
      markSpinSeen(gameState.lastSpin.id);
      setWheelTargetDegrees(gameState.lastSpin.targetDegrees);
      setIsWheelSpinning(true);
    }
  }, [gameState, activeGameId, account?.id, view]);

  useEffect(() => {
    if (gameState?.mode === 'QUESTION') {
      if (activeReviewResult && activeReviewResult.question.id !== gameState.activeQuestion?.id) {
        reviewTimer.cancel();
        setActiveReviewResult(null);
      }
    }
  }, [gameState?.mode, gameState?.activeQuestion?.id, activeReviewResult, reviewTimer]);

  // Both players review each unique result once, including SSE/polling observations.
  useEffect(() => {
    // Only show completed answer review when not in the middle of a question
    if (view !== 'GAME' || gameState?.id !== activeGameId || !gameState?.lastResult || gameState.mode === 'QUESTION') return;

    const result = gameState.lastResult;
    const reviewQuestion = result.question;
    if (!reviewQuestion) return;

    const resultKey = `${reviewQuestion.id}_${result.nextPlayerId}_${result.wasCorrect}_${result.correctIndex}`;
    if (lastReviewedResultKeyRef.current === resultKey) return;

    lastReviewedResultKeyRef.current = resultKey;
    setActiveReviewResult({
      question: reviewQuestion,
      result: result,
      quote: selectDialogue(reviewQuestion.id, reviewQuestion.category, result.wasCorrect ? 'correct' : 'incorrect'),
    });
    reviewTimer.start(() => setActiveReviewResult(null));
  }, [gameState?.lastResult, gameState?.mode, activeGameId, view, selectDialogue, reviewTimer]);
  useEffect(() => {
    return () => {
      reviewTimer.cancel();
    };
  }, []);


  useEffect(() => {
    const previous = previousReviewRef.current;
    previousReviewRef.current = activeReviewResult;
    clearTimeout(sidekickTimerRef.current);
    setSidekick(null);
    if (view !== 'GAME' || gameState?.mode === 'QUESTION' || activeReviewResult || !previous) return;
    const milestone = crownReaction(previous.result);
    if (!milestone) return;
    setSidekick({ ...milestone, quote: selectDialogue(previous.question.id, milestone.category, milestone.event) });
    sidekickTimerRef.current = window.setTimeout(() => setSidekick(null), SIDEKICK_MS);
    return () => clearTimeout(sidekickTimerRef.current);
  }, [activeReviewResult, gameState?.mode, activeGameId, view, selectDialogue]);

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
        if (!reducedMotion) confetti({ particleCount: 140, spread: 85, origin: { y: .45 } });
      }
    }
  }, [gameState, activeGameId, account, view, reducedMotion]);

  const handleOpenGame = (gameId: string) => {
    setActiveGameId(gameId);
    setView('GAME');
    setIsWheelSpinning(false);
    reviewTimer.cancel();
    lastReviewedResultKeyRef.current = null;
    setActiveReviewResult(null);
    window.history.pushState(null, '', `/game/${encodeURIComponent(gameId)}`);
  };

  const handleNavigateToPacks = () => {
    setView('PACK_CREATOR');
    window.history.pushState(null, '', '/packs');
  };

  const handleNavigateToLobby = () => {
    setActiveGameId(null);
    setIsWheelSpinning(false);
    reviewTimer.cancel();
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
    reviewTimer.cancel();
    setActiveReviewResult(null);
    try {
      const res = await spin();
      if (res) {
        if (res.state.lastSpin?.id) markSpinSeen(res.state.lastSpin.id);
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
    playAudioCue(landedSlice === 'CROWN' ? 'crownLanding' : 'landing');

    spinHoldTimerRef.current = window.setTimeout(() => {
      setIsWheelSpinning(false);
    }, SPIN_RESULT_HOLD_MS);
  }, []);

  const answerContextRef = useRef({ gameId: activeGameId, accountId: account?.id, view, questionId: gameState?.activeQuestion?.id });
  answerContextRef.current = { gameId: activeGameId, accountId: account?.id, view, questionId: gameState?.activeQuestion?.id };

  const handleAnswerQuestion = async (
    targetQuestion: ActiveQuestionSync,
    ansIdx: number,
    timeMs: number
  ) => {
    const context = answerContextRef.current;
    const generation = reviewGenerationRef.current;
    const res = await answer(targetQuestion.id, ansIdx, timeMs);
    const current = answerContextRef.current;
    if (generation !== reviewGenerationRef.current || context.gameId !== current.gameId || context.accountId !== current.accountId || current.view !== 'GAME' || (current.questionId && current.questionId !== targetQuestion.id)) return false;
    if (res) {
      const resultKey = `${targetQuestion.id}_${res.nextPlayerId}_${res.wasCorrect}_${res.correctIndex}`;
      if (lastReviewedResultKeyRef.current === resultKey) return true;
      lastReviewedResultKeyRef.current = resultKey;
      setActiveReviewResult({
        question: targetQuestion,
        result: res,
        quote: selectDialogue(targetQuestion.id, targetQuestion.category, res.wasCorrect ? 'correct' : 'incorrect'),
      });
      reviewTimer.start(() => setActiveReviewResult(null));
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
    <div className={`trivia-app ${view === 'GAME' ? 'mobile-match' : ''} h-[100dvh] max-h-[100dvh] w-full text-slate-100 flex flex-col justify-between overflow-hidden relative select-none`}>
      {/* Dynamic Cosmic Animated Background with Reactive Category Lighting */}
      {view !== 'GAME' && <AnimatedBackground activeCategory={activeCategory} scene="lobby" />}

      {account && !authLoading && view !== 'GAME' && (
        <TurnNotification key={account.token} account={account} onOpenGame={handleOpenGame} onUnauthorized={handleUnauthorized} />
      )}

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
      <InstallNotificationModal installed={pwa.isInstalled} signedIn={!!account} push={push} />
      <IOSInstallSheet
        isOpen={showIOSSheet}
        onClose={() => setShowIOSSheet(false)}
      />

      {/* Main Viewport Router with Fluid Directional Transitions */}
      <div className="flex-1 flex flex-col w-full h-full overflow-hidden relative">
        {view === 'GAME' && <AnimatedBackground activeCategory={activeCategory} scene="match" />}
        <AnimatePresence key={view} initial={false} mode="wait">
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
                  activeTab={lobbyTab}
                  onChangeTab={setLobbyTab}
                  highlightedInviteId={highlightedInviteId}
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
              className={`match-page ${shouldShowWheel ? 'match-page-spin' : ''} flex-1 flex flex-col mx-auto w-full h-full overflow-y-auto z-20 px-3 py-1`}
            >
              {gameError && (
                <div
                  role="alert"
                  className="p-2.5 bg-red-950/70 border border-red-800 rounded-2xl text-xs text-red-200 text-center font-bold"
                >
                  {gameError}
                </div>
              )}

              {/* Players Crown Status Bar */}
              <CrownBar state={gameState} myPlayerId={account.id} isConnected={isConnected && pwa.isOnline} presence={presence} />

              {/* Center Stage Area */}
              <div className={`${shouldShowWheel ? 'match-spin-content flex-1 min-h-0 overflow-hidden' : 'flex-1 min-h-0 overflow-y-auto'} flex flex-col items-center py-1 w-full`}>
                {/* STAGE: WHEEL */}
                {shouldShowWheel && (
                  <SpinArena state={gameState} playerId={account.id} spinning={isWheelSpinning}>
                    <Wheel
                      canSpin={isMyTurn && !isWheelSpinning && !spinPending}
                      isSpinning={isWheelSpinning}
                      pending={spinPending}
                      targetDegrees={wheelTargetDegrees || targetDegrees}
                      onSpinStart={handleSpinStart}
                      onSpinComplete={handleSpinComplete}
                    />

                  </SpinArena>
                )}

                {/* STAGE: QUESTION */}
                {shouldShowQuestion &&
                  (activeReviewResult || gameState.activeQuestion) && (
                    <div className="w-full flex-1 min-h-0 flex flex-col">
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
                        reactionQuote={activeReviewResult?.quote}
                        onDismissResult={() => {
                          reviewTimer.dismiss();
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
              {sidekick && !activeReviewResult && gameState.mode !== 'QUESTION' && (
                <div className="match-sidekick-overlay" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
                  <CharacterReaction category={sidekick.category} quote={sidekick.quote} onClose={() => { clearTimeout(sidekickTimerRef.current); setSidekick(null); }} />
                </div>
              )}
            </motion.main>
          )}

          {view === 'GAME' && (!account || !gameState) && (
            <motion.main
              key="game_loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center text-sm text-slate-400 z-20"
            >
              {authLoading ? 'Restoring your profile…' : gameError || (gameLoading ? 'Loading match…' : 'Match unavailable')}
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
