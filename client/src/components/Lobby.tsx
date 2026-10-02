import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'motion/react';
import {
  Swords,
  Users,
  Trophy,
  BookOpen,
  UserPlus,
  RefreshCw,
  Lock,
  ChevronRight,
  Clock,
  Sparkles,
  Zap,
  Play,
  Check,
  Plus,
  Globe,
  Loader2
} from 'lucide-react';
import type {
  AccountSummary,
  AuthResponse,
  DirectoryPlayer,
  ExpandPackResponse,
  GameListResponse,
  InvitationSummary,
  PlayerSummary,
  QuestionPackMeta
} from '../../../shared/src/index';
import { playButtonPop, triggerHaptic } from '../utils/audio';
import { apiUrl } from '../utils/api';
import { setAppBadge } from '../hooks/usePWA';
import { useToast } from './ui/Toast';
import BottomSheet from './ui/BottomSheet';
import Keypad from './ui/Keypad';
import BottomNav, { type LobbyTab } from './navigation/BottomNav';
import CharacterShowcase from './characters/CharacterShowcase';


export type AccountSession = AccountSummary & { token: string };

type Player = PlayerSummary;
type Invitation = InvitationSummary;
type Match = GameListResponse['matches'][number];

interface LobbyProps {
  account: AccountSession | null;
  onAuth: (account: AccountSession) => void;
  onLogout: () => void;
  onOpenGame: (gameId: string) => void;
  onOpenPackCreator: () => void;
}

async function readResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

const AVATAR_GRADIENTS = [
  'from-pink-500 to-rose-600',
  'from-purple-500 to-indigo-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-violet-500 to-purple-600',
  'from-fuchsia-500 to-pink-600',
  'from-cyan-500 to-blue-600',
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index]!;
}

const TABS: LobbyTab[] = ['matches', 'players', 'champions', 'packs'];

export default function Lobby({
  account,
  onAuth,
  onLogout,
  onOpenGame,
  onOpenPackCreator,
}: LobbyProps) {
  const { showToast } = useToast();

  const [packs, setPacks] = useState<QuestionPackMeta[]>([]);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>(['default']);
  const [players, setPlayers] = useState<Player[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [expandingPackId, setExpandingPackId] = useState<string | null>(null);

  const handleExpandPack = async (packId: string, packTitle: string) => {
    setExpandingPackId(packId);
    playButtonPop();
    triggerHaptic('medium');
    try {
      const res = await fetch(apiUrl(`/api/packs/${packId}/expand`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countPerCategory: 5 })
      });
      if (res.ok) {
        const data = (await res.json()) as ExpandPackResponse;
        showToast(`Added ${data.added} questions to "${packTitle}"! (Total: ${data.totalInPack})`, 'success');
        triggerHaptic('success');
        const packsRes = await fetch(apiUrl('/api/packs'));
        if (packsRes.ok) {
          setPacks((await packsRes.json()) as QuestionPackMeta[]);
        }
      } else {
        showToast('Could not expand pack', 'error');
      }
    } catch {
      showToast('Network error expanding pack', 'error');
    } finally {
      setExpandingPackId(null);
    }
  };
  const [matches, setMatches] = useState<Match[]>([]);
  const [directory, setDirectory] = useState<DirectoryPlayer[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);

  // BottomSheet states
  const [selectedPinPlayer, setSelectedPinPlayer] = useState<DirectoryPlayer | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const [showNewPlayerSheet, setShowNewPlayerSheet] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPin, setNewPin] = useState('');
  const [selectedAvatarColorIndex, setSelectedAvatarColorIndex] = useState(0);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<LobbyTab>('matches');

  const authFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (account) headers.set('Authorization', `Bearer ${account.token}`);
      const response = await fetch(apiUrl(path), { ...init, headers });
      if (response.status === 401) {
        onLogout();
        throw new Error('Your session has expired. Please log in again.');
      }
      return response;
    },
    [account, onLogout]
  );

  const refreshDashboard = useCallback(async () => {
    if (!account) return;
    setIsRefreshing(true);
    try {
      const [playerData, inviteData, matchData] = await Promise.all([
        authFetch('/api/players').then((res) => readResponse<{ players: Player[] }>(res)),
        authFetch('/api/invitations').then((res) => readResponse<{ invitations: Invitation[] }>(res)),
        authFetch('/api/games').then((res) => readResponse<GameListResponse>(res)),
      ]);
      setPlayers(playerData.players);
      setInvitations(inviteData.invitations);
      setMatches(matchData.matches);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not refresh matches', 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [account, authFetch, showToast]);

  useEffect(() => {
    fetch(apiUrl('/api/packs'))
      .then((res) => readResponse<QuestionPackMeta[]>(res))
      .then(setPacks)
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : 'Could not load question packs', 'error');
      });
  }, [showToast]);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  // Periodic match polling
  useEffect(() => {
    if (!account) return;
    const interval = window.setInterval(() => void refreshDashboard(), 10_000);
    return () => window.clearInterval(interval);
  }, [account, refreshDashboard]);

  // App Badge synchronization
  useEffect(() => {
    if (!account) return;
    const myTurnCount = matches.filter(
      (m) => m.status === 'IN_PROGRESS' && m.currentTurn.id === account.id
    ).length;
    void setAppBadge(myTurnCount);
  }, [account, matches]);

  const fetchDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/directory'));
      const data = await readResponse<{ players: DirectoryPlayer[] }>(res);
      setDirectory(data.players || []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not load player directory', 'error');
    } finally {
      setDirectoryLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!account) {
      void fetchDirectory();
    }
  }, [account, fetchDirectory]);

  const handleSelectPlayer = async (player: DirectoryPlayer) => {
    playButtonPop();
    triggerHaptic('selection');
    if (player.hasPin) {
      setSelectedPinPlayer(player);
      setPinInput('');
      setPinError(false);
      return;
    }

    setLoadingAction(`login:${player.id}`);
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: player.username }),
      });
      const data = await readResponse<AuthResponse>(res);
      showToast(`Welcome back, ${data.account.username}!`, 'success');
      onAuth({ ...data.account, token: data.token });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not sign in', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUnlockPinSubmit = async (enteredPin?: string) => {
    const pin = enteredPin || pinInput;
    if (!selectedPinPlayer || pin.length !== 4) return;
    setLoadingAction('pin');
    setPinError(false);
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: selectedPinPlayer.username, pin }),
      });
      const data = await readResponse<AuthResponse>(res);
      showToast(`Unlocked! Welcome, ${data.account.username}`, 'success');
      setSelectedPinPlayer(null);
      setPinInput('');
      onAuth({ ...data.account, token: data.token });
    } catch {
      setPinError(true);
      showToast('Incorrect PIN. Please try again.', 'error');
      setTimeout(() => {
        setPinInput('');
        setPinError(false);
      }, 700);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCreatePlayer = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = newUsername.trim();
    if (!trimmed) {
      showToast('Please enter a username', 'error');
      return;
    }
    if (trimmed.length > 24) {
      showToast('Username must be 1–24 characters', 'error');
      return;
    }
    if (newPin && !/^\d{4}$/.test(newPin)) {
      showToast('PIN must be exactly 4 digits', 'error');
      return;
    }

    setLoadingAction('create');
    try {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmed,
          pin: newPin || undefined,
        }),
      });
      const data = await readResponse<AuthResponse>(res);
      showToast(`Profile created! Welcome to Trivia Clash, ${data.account.username}!`, 'success');
      onAuth({ ...data.account, token: data.token });
      setNewUsername('');
      setNewPin('');
      setShowNewPlayerSheet(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create player', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const sendInvitation = async (recipientId: string) => {
    setLoadingAction(`invite:${recipientId}`);
    try {
      await readResponse(
        await authFetch('/api/invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientId, packIds: selectedPackIds }),
        })
      );
      showToast('Challenge sent! Opponent notified.', 'success');
      await refreshDashboard();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not send challenge', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const respondToInvitation = async (id: string, decision: 'accept' | 'decline') => {
    setLoadingAction(`respond:${id}`);
    try {
      const data = await readResponse<{ gameId?: string | null }>(
        await authFetch(`/api/invitations/${encodeURIComponent(id)}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision }),
        })
      );
      let acceptedGameId = decision === 'accept' ? data.gameId ?? null : null;
      if (decision === 'accept' && !acceptedGameId) {
        const previousGameIds = new Set(matches.map((m) => m.gameId));
        const updatedMatches = await authFetch('/api/games').then((res) =>
          readResponse<GameListResponse>(res)
        );
        setMatches(updatedMatches.matches);
        acceptedGameId =
          updatedMatches.matches.find((m) => !previousGameIds.has(m.gameId))?.gameId ?? null;
      }
      await refreshDashboard();
      if (acceptedGameId) {
        showToast('Challenge accepted! Entering duel...', 'success');
        onOpenGame(acceptedGameId);
      } else if (decision === 'decline') {
        showToast('Challenge declined', 'info');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Response failed', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const togglePack = (packId: string) => {
    playButtonPop();
    triggerHaptic('light');
    setSelectedPackIds((selected) =>
      selected.includes(packId)
        ? selected.length > 1
          ? selected.filter((id) => id !== packId)
          : selected
        : [...selected, packId]
    );
  };

  // Horizontal Swipe Gestures between tabs
  const handleTabSwipe = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 60;
    const velocityThreshold = 250;
    const currentIdx = TABS.indexOf(activeTab);

    if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      // Swiped Left -> Next Tab
      if (currentIdx < TABS.length - 1) {
        playButtonPop();
        triggerHaptic('selection');
        setActiveTab(TABS[currentIdx + 1]);
      }
    } else if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      // Swiped Right -> Prev Tab
      if (currentIdx > 0) {
        playButtonPop();
        triggerHaptic('selection');
        setActiveTab(TABS[currentIdx - 1]);
      }
    }
  };

  const myTurnCount = matches.filter(
    (m) => m.status === 'IN_PROGRESS' && m.currentTurn.id === account?.id
  ).length;

  return (
    <div className="flex-1 flex flex-col w-full h-full max-w-lg mx-auto relative overflow-hidden select-none">
      {/* Pull-to-refresh Indicator */}
      <AnimatePresence>
        {isRefreshing && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="absolute top-2 inset-x-0 z-30 flex justify-center pointer-events-none"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-900/90 border border-indigo-500/50 shadow-lg text-xs font-semibold text-indigo-200 backdrop-blur-md">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Updating matches...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      {!account ? (
        /* ================= UNAUTHENTICATED HERO SELECTOR ================= */
        <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)]">
          <div className="text-center pt-2">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="inline-flex p-3 rounded-3xl bg-gradient-to-tr from-amber-400/20 via-indigo-500/20 to-purple-500/20 border border-amber-400/30 mb-3 shadow-lg"
            >
              <Sparkles className="w-8 h-8 text-amber-400" />
            </motion.div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Who's Playing?
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
              Select your character to duel friends or create a new profile in seconds.
            </p>
          </div>

          {/* Player Grid */}
          {directoryLoading && directory.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400">Loading players...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                playButtonPop();
                triggerHaptic('selection');
                setShowNewPlayerSheet(true);
              }}
              className="flex flex-col items-center justify-center p-5 rounded-3xl bg-slate-900/70 hover:bg-slate-800/80 border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 transition-all shadow-xl group text-center cursor-pointer min-h-[140px]"
            >
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-md mb-2.5">
                <Plus className="w-7 h-7 stroke-[2.5]" />
              </div>
              <span className="text-xs font-bold text-indigo-300 group-hover:text-white transition-colors">
                New Player
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">Create Profile</span>
            </motion.button>

            {/* Existing Players */}
            {directory.map((player) => (
              <motion.button
                key={player.id}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleSelectPlayer(player)}
                disabled={loadingAction !== null}
                className="relative flex flex-col items-center justify-center p-5 rounded-3xl bg-slate-900/85 hover:bg-slate-800/90 border border-slate-700/80 hover:border-amber-400/60 transition-all shadow-xl group text-center cursor-pointer disabled:opacity-50 min-h-[140px]"
              >
                {player.hasPin && (
                  <div
                    className="absolute top-3 right-3 p-1 rounded-lg bg-slate-950/80 border border-slate-700 text-amber-400 shadow-sm"
                    title="PIN Protected"
                  >
                    <Lock className="w-3 h-3" />
                  </div>
                )}

                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(
                    player.username
                  )} flex items-center justify-center text-xl font-black text-white shadow-lg ring-2 ring-slate-800 group-hover:scale-105 transition-transform mb-2.5`}
                >
                  {player.username.slice(0, 2).toUpperCase()}
                </div>

                <span className="text-xs font-extrabold text-white group-hover:text-amber-300 transition-colors truncate max-w-full px-1">
                  {player.username}
                </span>

                <span className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                  {loadingAction === `login:${player.id}` ? (
                    <span className="text-amber-400 animate-pulse font-semibold">Logging in...</span>
                  ) : player.hasPin ? (
                    'PIN Protected'
                  ) : (
                    '1-Tap Play'
                  )}
                </span>
              </motion.button>
            ))}
            </div>
          )}

          {/* Mascot character showcase banner */}
          <div className="mt-2 pt-4 border-t border-slate-800/60">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center mb-3">
              Explore Trivia Champions
            </h3>
            <CharacterShowcase initialCategory="SCIENCE" />
          </div>
        </div>
      ) : (
        /* ================= AUTHENTICATED MOBILE DASHBOARD ================= */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Swipeable Tab Container */}
          <motion.div
            className="flex-1 overflow-y-auto px-4 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] overscroll-contain touch-pan-y"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={handleTabSwipe}
          >
            {/* TAB 1: DUELS */}
            {activeTab === 'matches' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between pt-1">
                  <h3 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Swords className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Your Duels ({matches.length})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => void refreshDashboard()}
                    className="p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="Refresh matches"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {matches.length === 0 ? (
                  <div className="py-12 px-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 text-center flex flex-col items-center">
                    <div className="w-16 h-16 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3">
                      <Swords className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-extrabold text-white">No duels in progress</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                      Swipe to "Opponents" to challenge someone and spin the wheel for crowns!
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        playButtonPop();
                        triggerHaptic('selection');
                        setActiveTab('players');
                      }}
                      className="mt-4 py-2.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-950/50 active:scale-95 transition-all flex items-center gap-2"
                    >
                      <span>Challenge an Opponent</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {matches.map((match) => {
                      const isMyTurn =
                        match.status === 'IN_PROGRESS' && match.currentTurn.id === account.id;
                      const isCompleted = match.status === 'COMPLETED';

                      return (
                        <motion.div
                          key={match.gameId}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            playButtonPop();
                            triggerHaptic(isMyTurn ? 'heavy' : 'light');
                            onOpenGame(match.gameId);
                          }}
                          className={`
                            relative overflow-hidden rounded-3xl p-4 border cursor-pointer transition-all shadow-xl
                            ${
                              isMyTurn
                                ? 'bg-gradient-to-r from-indigo-950/90 via-slate-900/95 to-slate-900/95 border-amber-400/80 shadow-indigo-950/40 ring-1 ring-amber-400/30'
                                : isCompleted
                                ? 'bg-slate-900/50 border-slate-800/80 opacity-75'
                                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                            }
                          `}
                        >
                          {/* Pulsing Turn Banner for active player */}
                          {isMyTurn && (
                            <div className="absolute top-0 right-0 py-0.5 px-3 rounded-bl-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[10px] tracking-wider uppercase flex items-center gap-1 shadow-sm">
                              <Zap className="w-3 h-3 fill-slate-950" />
                              <span>YOUR MOVE</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div
                                className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(
                                  match.opponent.username
                                )} flex items-center justify-center font-black text-white text-base shadow-md ring-2 ring-slate-800 flex-shrink-0`}
                              >
                                {match.opponent.username.slice(0, 2).toUpperCase()}
                              </div>

                              <div className="min-w-0">
                                <h4 className="font-extrabold text-sm text-white truncate flex items-center gap-1.5">
                                  <span>vs. {match.opponent.username}</span>
                                </h4>

                                <div className="text-xs mt-1 flex items-center gap-1.5">
                                  {isCompleted ? (
                                    <span className="text-slate-400 font-semibold flex items-center gap-1">
                                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                      <span>Finished</span>
                                    </span>
                                  ) : isMyTurn ? (
                                    <span className="text-amber-300 font-black flex items-center gap-1 animate-pulse">
                                      <span>🎲</span> Spin the wheel now!
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-medium flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-slate-500" />
                                      <span>Waiting for {match.currentTurn.username}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex-shrink-0">
                              {isMyTurn ? (
                                <div className="py-2 px-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5">
                                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                                  <span>PLAY</span>
                                </div>
                              ) : (
                                <div className="p-2 rounded-xl bg-slate-800/60 text-slate-400 border border-slate-700/60">
                                  <ChevronRight className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: OPPONENTS & INVITATIONS */}
            {activeTab === 'players' && (
              <div className="flex flex-col gap-4">
                {/* Incoming Challenges */}
                {invitations.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <h3 className="text-xs uppercase font-extrabold text-amber-400 tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Incoming Challenges ({invitations.length})</span>
                    </h3>

                    {invitations.map((invite) => (
                      <div
                        key={invite.id}
                        className="p-4 rounded-3xl bg-amber-950/30 border border-amber-500/40 shadow-xl flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-white leading-snug">
                            <span className="font-extrabold text-amber-300">
                              {invite.sender.username}
                            </span>{' '}
                            challenged you to a trivia duel!
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            disabled={loadingAction !== null}
                            onClick={() => void respondToInvitation(invite.id, 'accept')}
                            className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            disabled={loadingAction !== null}
                            onClick={() => void respondToInvitation(invite.id, 'decline')}
                            className="py-1.5 px-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs active:scale-95 transition-all"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Directory of Opponents */}
                <div className="flex flex-col gap-2.5">
                  <h3 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Available Opponents ({players.length})</span>
                  </h3>

                  {players.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      No other players found yet. Share the app to invite friends!
                    </div>
                  ) : (
                    players.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between p-3.5 rounded-3xl bg-slate-900/80 border border-slate-800/90 shadow-md"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(
                              player.username
                            )} flex items-center justify-center font-bold text-white text-xs shadow-md ring-1 ring-slate-700 flex-shrink-0`}
                          >
                            {player.username.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-xs font-bold text-white truncate">
                            {player.username}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={loadingAction !== null}
                          onClick={() => void sendInvitation(player.id)}
                          className="py-2 px-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-900/30 active:scale-95 transition-all flex items-center gap-1.5 flex-shrink-0"
                        >
                          <Swords className="w-3.5 h-3.5" />
                          <span>Challenge</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: HEROES & CHAMPIONS */}
            {activeTab === 'champions' && (
              <div className="flex flex-col gap-3">
                <div className="text-center pt-1 mb-2">
                  <h3 className="text-lg font-black text-white">Trivia Champions</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Each category hero guards a crown. Land on their slice to win!
                  </p>
                </div>
                <CharacterShowcase initialCategory="ART" />
              </div>
            )}

            {/* TAB 4: PACKS */}
            {activeTab === 'packs' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Active Question Packs</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Selected packs are used when creating new matches.
                    </p>
                  </div>
                  {selectedPackIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetPackId = selectedPackIds[0] || 'default';
                        const targetPack = packs.find((p) => p.id === targetPackId);
                        void handleExpandPack(targetPackId, targetPack?.title || 'Selected Pack');
                      }}
                      disabled={expandingPackId !== null}
                      title="Fetch 30 new questions from free trivia APIs"
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white text-xs font-bold shadow flex items-center gap-1.5 active:scale-95 disabled:opacity-50 transition-all flex-shrink-0"
                    >
                      {expandingPackId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Globe className="w-3.5 h-3.5" />
                      )}
                      <span>+30 Qs</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {packs.map((pack) => {
                    const isSelected = selectedPackIds.includes(pack.id);
                    return (
                      <div
                        key={pack.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => togglePack(pack.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            togglePack(pack.id);
                          }
                        }}
                        className={`
                          p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer
                          ${
                            isSelected
                              ? 'bg-indigo-950/80 border-indigo-400 text-white shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-400/40'
                              : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                          }
                        `}
                      >
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold truncate">{pack.title}</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {pack.questionCount} Questions
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleExpandPack(pack.id, pack.title);
                            }}
                            disabled={expandingPackId === pack.id}
                            title="Fetch 30 fresh questions from free trivia APIs"
                            className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-emerald-400 border border-slate-700/60 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {expandingPackId === pack.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                            ) : (
                              <Globe className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-indigo-500 text-white'
                                : 'bg-slate-800 border border-slate-700 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    playButtonPop();
                    triggerHaptic('selection');
                    onOpenPackCreator();
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 text-white font-bold text-xs shadow-xl shadow-indigo-950/50 active:scale-98 transition-all flex items-center justify-center gap-2 mt-2"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Open Custom Pack Studio & JSON Importer</span>
                </button>
              </div>
            )}
          </motion.div>

          {/* Persistent Bottom Navigation Dock */}
          <BottomNav
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            myTurnCount={myTurnCount}
            invitationCount={invitations.length}
          />
        </div>
      )}

      {/* ================= PIN UNLOCK BOTTOM SHEET ================= */}
      <BottomSheet
        isOpen={selectedPinPlayer !== null}
        onClose={() => {
          setSelectedPinPlayer(null);
          setPinInput('');
          setPinError(false);
        }}
        title="Enter Security PIN"
        subtitle={selectedPinPlayer ? `Unlock account for ${selectedPinPlayer.username}` : ''}
        icon={<Lock className="w-5 h-5 text-amber-400" />}
      >
        {selectedPinPlayer && (
          <div className="flex flex-col items-center py-2">
            <div
              className={`w-16 h-16 rounded-3xl bg-gradient-to-tr ${getAvatarGradient(
                selectedPinPlayer.username
              )} flex items-center justify-center text-2xl font-black text-white shadow-xl ring-2 ring-slate-800 mb-3`}
            >
              {selectedPinPlayer.username.slice(0, 2).toUpperCase()}
            </div>
            <h4 className="text-base font-extrabold text-white mb-2">
              {selectedPinPlayer.username}
            </h4>

            <Keypad
              value={pinInput}
              onChange={setPinInput}
              onSubmit={handleUnlockPinSubmit}
              maxLength={4}
              error={pinError}
              disabled={loadingAction === 'pin'}
              title="4-Digit PIN"
              subtitle="Enter your secret digits to unlock"
            />
          </div>
        )}
      </BottomSheet>

      {/* ================= CREATE PLAYER BOTTOM SHEET ================= */}
      <BottomSheet
        isOpen={showNewPlayerSheet}
        onClose={() => {
          setShowNewPlayerSheet(false);
          setNewUsername('');
          setNewPin('');
        }}
        title="Create Player Profile"
        subtitle="Choose a moniker and customize your avatar"
        icon={<UserPlus className="w-5 h-5 text-indigo-400" />}
      >
        <form onSubmit={handleCreatePlayer} className="flex flex-col gap-4 py-2">
          {/* Avatar Color Selector Carousel */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-2">
              Choose Avatar Color
            </label>
            <div className="flex items-center justify-center gap-2.5 py-1">
              {AVATAR_GRADIENTS.slice(0, 6).map((grad, idx) => (
                <button
                  key={grad}
                  type="button"
                  onClick={() => {
                    playButtonPop();
                    setSelectedAvatarColorIndex(idx);
                  }}
                  className={`
                    w-11 h-11 rounded-2xl bg-gradient-to-tr ${grad} flex items-center justify-center text-white font-bold text-sm shadow-md transition-transform
                    ${selectedAvatarColorIndex === idx ? 'scale-110 ring-4 ring-white/60' : 'opacity-70 hover:opacity-100'}
                  `}
                >
                  {selectedAvatarColorIndex === idx && <Check className="w-5 h-5 stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Username Input */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">
              Player Moniker / Username
            </label>
            <input
              required
              maxLength={24}
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              placeholder="e.g. Maverick"
              className="w-full bg-slate-950/90 border border-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner"
            />
          </div>

          {/* Optional PIN Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">
                Security PIN (Optional)
              </label>
              <span className="text-[10px] text-slate-500">4 digits</span>
            </div>
            <input
              type="password"
              inputMode="numeric"
              pattern="\d*"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Leave blank for 1-tap play"
              className="w-full bg-slate-950/90 border border-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-all font-mono tracking-widest shadow-inner"
            />
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Set 4 digits to lock your account on shared devices.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={loadingAction === 'create' || !newUsername.trim()}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-950/50 active:scale-98 transition-all disabled:opacity-50"
            >
              {loadingAction === 'create' ? 'Creating...' : 'Create & Play'}
            </button>
            <button
              type="button"
              onClick={() => {
                playButtonPop();
                setShowNewPlayerSheet(false);
              }}
              className="w-full py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}
