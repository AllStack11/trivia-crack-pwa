import { useState, useEffect, useCallback, useRef } from 'react';
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

import { playFanfare, playCorrectChime } from './utils/audio';
import confetti from 'canvas-confetti';
import { Ssgoi, type SsgoiConfig } from '@ssgoi/react';
import { drill, sheet, fade } from '@ssgoi/react/view-transitions';

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
              const data = await response.json() as { account: { id: string; username: string } };
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
    return () => { mounted = false; };
  }, []);

  const handleAuth = (authenticated: AccountSession) => {
    setAccount(authenticated);
    try { localStorage.setItem('trivia_clash_account', JSON.stringify(authenticated)); } catch { /* Storage may be unavailable. */ }
    if (window.location.pathname.startsWith('/game/')) {
      const gameId = decodeURIComponent(window.location.pathname.slice('/game/'.length));
      setActiveGameId(gameId);
      setView('GAME');
    } else if (window.location.pathname === '/packs') setView('PACK_CREATOR');
  };

  const handleLogout = useCallback(async () => {
    if (account) {
      try {
        await fetch(apiUrl('/api/auth/logout'), { method: 'POST', headers: { Authorization: `Bearer ${account.token}` } });
      } catch { /* Local credentials are cleared even when the network is unavailable. */ }
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
        if (gameId) { setActiveGameId(decodeURIComponent(gameId)); setView('GAME'); }
      } else { setActiveGameId(null); setView('LOBBY'); }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const {
    gameState, isConnected, loading: gameLoading, error: gameError, targetDegrees, lastResult, spin, answer, chooseCrown, resign
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
          particleCount: 120,
          spread: 80,
          origin: { y: 0.5 }
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
    if (gameState?.status === 'IN_PROGRESS' &&
        !confirm('Leave this game? You can resume it from your matches.')) return;
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

    // Brief celebratory pause so the user clearly sees where the wheel landed
    setTimeout(() => {
      setIsWheelSpinning(false);
      setLandedCategoryName(null);
    }, 850);
  }, []);

  // Answer question and hold result on screen for 3s to show green/red outcome
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

  const isMyTurn = Boolean(
    gameState && account && gameState.currentTurnPlayerId === account.id
  );

  // Determine whether to display Wheel vs Question vs Crown Modal
  // While isWheelSpinning is true, the Wheel remains visible until the spin is complete!
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

  return (
    <Ssgoi config={ssgoiConfig}>
      <div className="h-[100dvh] max-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col justify-between p-2 sm:p-4 overflow-hidden">
        {/* View: Pack Creator */}
        {view === 'PACK_CREATOR' && (
          <main className="flex-1 flex items-center justify-center py-2 animate-scale-up">
            <PackCreator onBack={handleNavigateToLobby} />
          </main>
        )}

        {/* View: Lobby */}
        {view === 'LOBBY' && (
          <main className="flex-1 flex items-center justify-center py-2 animate-fade-in">
            {authLoading ? <div className="text-sm text-slate-400">Restoring your account…</div> : (
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
          <div className="flex-1 flex flex-col max-w-md mx-auto w-full gap-1.5 sm:gap-2.5 h-full overflow-hidden justify-between animate-fade-in">
            {/* Room Header Bar */}
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleNavigateToLobby}
                  className="text-slate-400 hover:text-white font-bold transition"
                >
                  ← Lobby
                </button>
                <span className="text-slate-700">|</span>
                <span className="font-bold text-yellow-400">
                  vs. {gameState.players.p1.id === account.id ? gameState.players.p2?.username : gameState.players.p1.username}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Connection Indicator */}
                <div
                  className="flex items-center gap-1"
                  title={isConnected ? 'Realtime Connected' : 'Reconnecting...'}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span className="text-[10px] text-slate-400">
                    {isConnected ? 'LIVE' : 'SYNCING'}
                  </span>
                </div>

              </div>
            </div>
            {gameError && <div role="alert" className="p-2 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-300">{gameError}</div>}

            {/* Players Crown Status Bar */}
            <CrownBar state={gameState} myPlayerId={account.id} />

            {/* Center Stage: Wheel vs Question vs Crown Modal */}
            <div className="flex-1 min-h-0 flex flex-col justify-center items-center py-0.5 overflow-y-auto w-full">
              {/* Mode: WHEEL SPINNING */}
              {shouldShowWheel && (
                <div className="w-full flex flex-col items-center justify-center animate-fade-in relative">
                  <Wheel
                    canSpin={isMyTurn && !isWheelSpinning}
                    isSpinning={isWheelSpinning}
                    targetDegrees={wheelTargetDegrees || targetDegrees}
                    onSpinStart={handleSpinStart}
                    onSpinComplete={handleSpinComplete}
                  />

                  {/* Landed category celebratory toast */}
                  {landedCategoryName && (
                    <div className="absolute bottom-1 bg-yellow-400 text-slate-950 px-4 py-1.5 rounded-full font-black text-xs shadow-xl animate-bounce">
                      🎯 {landedCategoryName}
                    </div>
                  )}
                </div>
              )}

              {/* Mode: QUESTION ACTIVE OR RESULT REVIEW */}
              {shouldShowQuestion && (activeReviewResult || gameState.activeQuestion) && (
                <div className="w-full animate-scale-up">
                  <QuestionView
                    question={activeReviewResult ? activeReviewResult.question : gameState.activeQuestion!}
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

              {/* Mode: CROWN CHOICE MODAL */}
              {shouldShowCrownModal && (
                <CrownModal
                  state={gameState}
                  myPlayerId={account.id}
                  onChooseCrown={(action, category, wagerCategory) => {
                    chooseCrown(action, category, wagerCategory);
                  }}
                />
              )}

              {/* Mode: GAME OVER */}
              {gameState.status === 'COMPLETED' && (
                <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-2xl flex flex-col items-center gap-4 animate-scale-up">
                  <div className="text-5xl animate-bounce">🏆</div>
                  <div>
                    <h2 className="text-2xl font-black text-white">
                      {gameState.winnerId === account.id
                        ? 'Victory is Yours!'
                        : `${
                            gameState.winnerId === gameState.players.p1.id
                              ? gameState.players.p1.username
                              : gameState.players.p2?.username
                          } Won the Match!`}
                    </h2>
                    <p className="text-xs text-yellow-400 font-bold mt-1">
                      {gameState.winReason || 'Game Concluded'}
                    </p>
                  </div>

                  <div className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-around items-center text-xs">
                    <div>
                      <div className="text-slate-400 font-medium">
                        {gameState.players.p1.username}
                      </div>
                      <div className="text-lg font-black text-yellow-400">
                        👑 {gameState.players.p1.crowns.length}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        ⭐ {gameState.players.p1.score} correct
                      </div>
                    </div>

                    <div className="text-slate-600 font-bold">VS</div>

                    <div>
                      <div className="text-slate-400 font-medium">
                        {gameState.players.p2?.username || 'P2'}
                      </div>
                      <div className="text-lg font-black text-yellow-400">
                        👑 {gameState.players.p2?.crowns.length || 0}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        ⭐ {gameState.players.p2?.score || 0} correct
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleNavigateToLobby}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm rounded-2xl shadow-lg transition transform active:scale-95"
                  >
                    Return to Match Lobby
                  </button>
                </div>
              )}
            </div>

            {/* Resign / Surrender Button in footer when match is active */}
            {gameState.status === 'IN_PROGRESS' && (
              <div className="flex justify-center shrink-0 py-0.5">
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
          <main className="flex-1 flex items-center justify-center text-sm text-slate-400">
            {gameError || (gameLoading ? 'Loading match…' : 'Match unavailable')}
          </main>
        )}

        {/* Footer */}
        <footer className="text-center py-1 text-[10px] text-slate-600 shrink-0">
          Trivia Clash • Free Turn-Based Multiplayer PWA
        </footer>
      </div>
    </Ssgoi>
  );
}
