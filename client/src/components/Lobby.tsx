import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import type {
  AccountSummary,
  AuthResponse,
  DirectoryPlayer,
  GameListResponse,
  InvitationSummary,
  PlayerSummary,
  QuestionPackMeta
} from '../../../shared/src/index';
import { isAudioMuted, playButtonPop, setAudioMuted } from '../utils/audio';
import { apiUrl } from '../utils/api';
import Card from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
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
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
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

type LobbyTab = 'matches' | 'players' | 'champions' | 'packs';

export default function Lobby({
  account,
  onAuth,
  onLogout,
  onOpenGame,
  onOpenPackCreator
}: LobbyProps) {
  const [packs, setPacks] = useState<QuestionPackMeta[]>([]);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>(['default']);
  const [players, setPlayers] = useState<Player[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [directory, setDirectory] = useState<DirectoryPlayer[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [selectedPinPlayer, setSelectedPinPlayer] = useState<DirectoryPlayer | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [showNewPlayer, setShowNewPlayer] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPin, setNewPin] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(isAudioMuted());
  const [activeTab, setActiveTab] = useState<LobbyTab>('matches');

  const authFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (account) headers.set('Authorization', `Bearer ${account.token}`);
    const response = await fetch(apiUrl(path), { ...init, headers });
    if (response.status === 401) {
      onLogout();
      throw new Error('Your session has expired. Please log in again.');
    }
    return response;
  }, [account, onLogout]);

  const refreshDashboard = useCallback(async () => {
    if (!account) return;
    setErrorMessage(null);
    try {
      const [playerData, inviteData, matchData] = await Promise.all([
        authFetch('/api/players').then((res) => readResponse<{ players: Player[] }>(res)),
        authFetch('/api/invitations').then((res) => readResponse<{ invitations: Invitation[] }>(res)),
        authFetch('/api/games').then((res) => readResponse<GameListResponse>(res))
      ]);
      setPlayers(playerData.players);
      setInvitations(inviteData.invitations);
      setMatches(matchData.matches);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load your dashboard');
    }
  }, [account, authFetch]);

  useEffect(() => {
    fetch(apiUrl('/api/packs'))
      .then((res) => readResponse<QuestionPackMeta[]>(res))
      .then(setPacks)
      .catch((error: unknown) =>
        setErrorMessage(error instanceof Error ? error.message : 'Could not load question packs')
      );
  }, []);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  useEffect(() => {
    if (!account) return;
    const interval = window.setInterval(() => void refreshDashboard(), 10_000);
    return () => window.clearInterval(interval);
  }, [account, refreshDashboard]);

  const fetchDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/directory'));
      const data = await readResponse<{ players: DirectoryPlayer[] }>(res);
      setDirectory(data.players || []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load player directory');
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!account) {
      void fetchDirectory();
    }
  }, [account, fetchDirectory]);

  const handleSelectPlayer = async (player: DirectoryPlayer) => {
    playButtonPop();
    setErrorMessage(null);
    if (player.hasPin) {
      setSelectedPinPlayer(player);
      setPinInput('');
      return;
    }

    setLoadingAction(`login:${player.id}`);
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: player.username })
      });
      const data = await readResponse<AuthResponse>(res);
      onAuth({ ...data.account, token: data.token });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not sign in');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUnlockPin = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPinPlayer || pinInput.length !== 4) return;
    setLoadingAction('pin');
    setErrorMessage(null);
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: selectedPinPlayer.username, pin: pinInput })
      });
      const data = await readResponse<AuthResponse>(res);
      onAuth({ ...data.account, token: data.token });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Incorrect PIN');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCreatePlayer = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = newUsername.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a username');
      return;
    }
    if (trimmed.length > 24) {
      setErrorMessage('Username must be 1–24 characters');
      return;
    }
    if (newPin && !/^\d{4}$/.test(newPin)) {
      setErrorMessage('PIN must be exactly 4 digits');
      return;
    }
    setLoadingAction('create');
    setErrorMessage(null);
    try {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmed,
          pin: newPin || undefined
        })
      });
      const data = await readResponse<AuthResponse>(res);
      onAuth({ ...data.account, token: data.token });
      setNewUsername('');
      setNewPin('');
      setShowNewPlayer(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not create player');
    } finally {
      setLoadingAction(null);
    }
  };

  const perform = async (key: string, action: () => Promise<void>) => {
    setLoadingAction(key);
    setErrorMessage(null);
    try {
      await action();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setLoadingAction(null);
    }
  };

  const sendInvitation = (recipientId: string) =>
    perform(`invite:${recipientId}`, async () => {
      await readResponse(
        await authFetch('/api/invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientId, packIds: selectedPackIds })
        })
      );
      await refreshDashboard();
    });

  const respondToInvitation = (id: string, decision: 'accept' | 'decline') =>
    perform(`respond:${id}`, async () => {
      const data = await readResponse<{ gameId?: string | null }>(
        await authFetch(`/api/invitations/${encodeURIComponent(id)}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision })
        })
      );
      let acceptedGameId = decision === 'accept' ? data.gameId ?? null : null;
      if (decision === 'accept' && !acceptedGameId) {
        const previousGameIds = new Set(matches.map((match: Match) => match.gameId));
        const updatedMatches = await authFetch('/api/games').then((res) =>
          readResponse<GameListResponse>(res)
        );
        setMatches(updatedMatches.matches);
        acceptedGameId =
          updatedMatches.matches.find((match: Match) => !previousGameIds.has(match.gameId))?.gameId ?? null;
      }
      await refreshDashboard();
      if (acceptedGameId) onOpenGame(acceptedGameId);
    });

  const togglePack = (packId: string) =>
    setSelectedPackIds((selected) =>
      selected.includes(packId)
        ? selected.length > 1
          ? selected.filter((id) => id !== packId)
          : selected
        : [...selected, packId]
    );

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
    playButtonPop();
  };

  return (
    <Card
      variant="glass"
      className="w-full max-w-lg mx-auto p-4 sm:p-6 flex flex-col gap-4 max-h-[92dvh] overflow-y-auto relative z-10 border border-slate-700/80 shadow-2xl"
    >
      {/* Top Branding Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.08, rotate: -5 }}
            whileTap={{ scale: 0.95 }}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-400 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/25 border border-yellow-200 shrink-0"
          >
            👑
          </motion.div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none flex items-center gap-1.5">
              <span>TRIVIA</span>
              <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                CLASH
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5">
              Turn-Based Crown Duels
            </p>
          </div>
        </div>

        {/* Audio Mute & Logout Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="w-9 h-9 rounded-2xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 flex items-center justify-center text-sm transition-colors shadow"
            title={muted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          {account && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onLogout}
              disabled={loadingAction !== null}
              className="text-xs"
            >
              Switch Player
            </Button>
          )}
        </div>
      </div>

      {/* Error Alert Box */}
      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="p-3 bg-red-950/60 border border-red-700/60 rounded-2xl text-xs text-red-200 text-center font-bold shadow-md shadow-red-950/50"
        >
          {errorMessage}
        </motion.div>
      )}

      {/* Unauthenticated Mode: Who's Playing? Directory */}
      {!account ? (
        selectedPinPlayer ? (
          /* PIN Prompt View */
          <div className="flex flex-col gap-4">
            <Card variant="glow" className="p-6 flex flex-col items-center text-center">
              <div
                className={`w-20 h-20 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                  selectedPinPlayer.username
                )} flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-black/50 mb-3`}
              >
                {selectedPinPlayer.username.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-xl font-black text-white">{selectedPinPlayer.username}</h2>
              <p className="text-xs text-slate-400 mt-1 mb-5">Enter your 4-digit PIN to play</p>

              <form onSubmit={handleUnlockPin} className="w-full max-w-xs flex flex-col gap-4 items-center">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={4}
                  autoFocus
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-44 text-center tracking-[0.6em] text-2xl font-mono font-black bg-slate-950/90 border border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 rounded-2xl py-3 px-4 text-white placeholder-slate-600 focus:outline-none transition-all shadow-inner"
                />

                <div className="flex flex-col w-full gap-2 mt-2">
                  <Button
                    variant="primary"
                    size="lg"
                    glow
                    type="submit"
                    disabled={pinInput.length !== 4 || loadingAction !== null}
                    loading={loadingAction === 'pin'}
                    className="w-full"
                  >
                    Unlock & Play
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setSelectedPinPlayer(null);
                      setPinInput('');
                      setErrorMessage(null);
                      playButtonPop();
                    }}
                    disabled={loadingAction !== null}
                    className="w-full"
                  >
                    Back to Players
                  </Button>
                </div>
              </form>
            </Card>
            <div className="pt-2">
              <CharacterShowcase initialCategory="SCIENCE" />
            </div>
          </div>
        ) : showNewPlayer ? (
          /* Inline New Player Form */
          <div className="flex flex-col gap-4">
            <Card variant="glow" className="p-5">
              <div className="text-center mb-4">
                <h2 className="text-xl font-black text-white">Create New Player</h2>
                <p className="text-xs text-slate-400 mt-1">Choose a name to join the game</p>
              </div>

              <form onSubmit={handleCreatePlayer} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Username
                  </label>
                  <input
                    required
                    maxLength={24}
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    autoComplete="username"
                    autoFocus
                    placeholder="Enter your name e.g. Alex"
                    className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-300">
                      4-Digit PIN (Optional)
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">Optional</span>
                  </div>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="4 digits (e.g. 1234)"
                    className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                    Leave blank for 1-tap login, or set 4 digits to lock your turns.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="lg"
                    glow
                    type="submit"
                    loading={loadingAction === 'create'}
                    className="w-full"
                  >
                    Create Player & Play
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setShowNewPlayer(false);
                      setNewUsername('');
                      setNewPin('');
                      setErrorMessage(null);
                      playButtonPop();
                    }}
                    disabled={loadingAction !== null}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
            <div className="pt-2">
              <CharacterShowcase initialCategory="SCIENCE" />
            </div>
          </div>
        ) : (
          /* Who's Playing? Directory Grid */
          <div className="flex flex-col gap-4">
            <div className="text-center pt-1">
              <h2 className="text-2xl font-black tracking-tight text-white">Who's Playing?</h2>
              <p className="text-xs text-slate-400 mt-1">Select your profile or create a new player</p>
            </div>

            {directoryLoading && directory.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400">Loading players...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {directory.map((player) => (
                  <motion.button
                    key={player.id}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSelectPlayer(player)}
                    disabled={loadingAction !== null}
                    className="relative flex flex-col items-center justify-center p-4 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/60 rounded-2xl transition-all shadow-lg group text-center cursor-pointer disabled:opacity-60"
                  >
                    {player.hasPin && (
                      <span
                        className="absolute top-2.5 right-2.5 text-xs bg-slate-950/80 px-1.5 py-0.5 rounded-md border border-slate-700/80 text-amber-300"
                        title="PIN Protected"
                      >
                        🔒
                      </span>
                    )}

                    <div
                      className={`w-16 h-16 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                        player.username
                      )} flex items-center justify-center text-2xl font-black text-white shadow-md shadow-black/50 group-hover:scale-105 transition-transform`}
                    >
                      {player.username.charAt(0).toUpperCase()}
                    </div>

                    <span className="mt-3 text-sm font-bold text-white group-hover:text-amber-300 transition-colors truncate max-w-full px-1">
                      {player.username}
                    </span>

                    <span className="mt-0.5 text-[10px] font-medium text-slate-400">
                      {loadingAction === `login:${player.id}` ? (
                        <span className="text-amber-400 animate-pulse">Entering...</span>
                      ) : player.hasPin ? (
                        'PIN Required'
                      ) : (
                        '1-Tap Play'
                      )}
                    </span>
                  </motion.button>
                ))}

                {/* + New Player Card in grid */}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setShowNewPlayer(true);
                    setErrorMessage(null);
                    playButtonPop();
                  }}
                  disabled={loadingAction !== null}
                  className="flex flex-col items-center justify-center p-4 bg-slate-950/50 hover:bg-slate-900/70 border-2 border-dashed border-slate-800 hover:border-amber-400/70 rounded-2xl transition-all group text-center cursor-pointer min-h-[140px]"
                >
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-700 group-hover:border-amber-400 flex items-center justify-center text-3xl text-slate-400 group-hover:text-amber-400 transition-colors">
                    +
                  </div>
                  <span className="mt-3 text-sm font-bold text-slate-300 group-hover:text-amber-300 transition-colors">
                    New Player
                  </span>
                  <span className="mt-0.5 text-[10px] text-slate-500">Create profile</span>
                </motion.button>
              </div>
            )}

            <div className="pt-2">
              <CharacterShowcase initialCategory="SCIENCE" />
            </div>
          </div>
        )
      ) : (
        /* Authenticated Dashboard */
        <div className="flex flex-col gap-4">
          {/* User Profile Card */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800/90 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center font-black text-white text-base shadow-md">
                {account.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Player Account
                </div>
                <div className="text-sm font-black text-white">{account.username}</div>
              </div>
            </div>

            <Badge variant="turn" size="sm" pulse>
              Online
            </Badge>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-slate-950/80 p-1 rounded-2xl border border-slate-800/80 text-xs">
            <button
              onClick={() => {
                setActiveTab('matches');
                playButtonPop();
              }}
              className={`flex-1 py-2 font-black rounded-xl transition-all relative ${
                activeTab === 'matches'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>⚔️ Duels</span>
              {matches.filter((m: Match) => m.status === 'IN_PROGRESS' && m.currentTurn.id === account.id).length > 0 && (
                <span className="ml-1 w-2 h-2 inline-block rounded-full bg-amber-400 animate-ping" />
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('players');
                playButtonPop();
              }}
              className={`flex-1 py-2 font-black rounded-xl transition-all relative ${
                activeTab === 'players'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>👥 Players</span>
              {invitations.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-[9px] text-white font-black">
                  {invitations.length}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('champions');
                playButtonPop();
              }}
              className={`flex-1 py-2 font-black rounded-xl transition-all ${
                activeTab === 'champions'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>👑 Heroes</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('packs');
                playButtonPop();
              }}
              className={`flex-1 py-2 font-black rounded-xl transition-all ${
                activeTab === 'packs'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>📚 Packs</span>
            </button>
          </div>

          {/* TAB 1: MATCHES */}
          {activeTab === 'matches' && (
            <section className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs uppercase font-black text-slate-400 tracking-wider">
                  Active & Past Duels ({matches.length})
                </h2>
              </div>

              {matches.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-center">
                  <span className="text-3xl block mb-2">⚔️</span>
                  <p className="text-xs font-bold text-slate-300">No matches started yet.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Switch to the "Players" tab and challenge an opponent!
                  </p>
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => setActiveTab('players')}
                    className="mt-3"
                  >
                    Challenge a Player ➔
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {matches.map((match) => {
                    const isMyTurn = match.status === 'IN_PROGRESS' && match.currentTurn.id === account.id;
                    const isCompleted = match.status === 'COMPLETED';

                    return (
                      <motion.div
                        key={match.gameId}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => onOpenGame(match.gameId)}
                        className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all duration-150 flex items-center justify-between gap-3 ${
                          isMyTurn
                            ? 'bg-indigo-950/60 border-indigo-400 shadow-lg shadow-indigo-600/15'
                            : isCompleted
                            ? 'bg-slate-950/40 border-slate-800/60 opacity-80'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-800 border border-slate-600 flex items-center justify-center font-bold text-white text-sm shrink-0 shadow">
                            {match.opponent.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-sm text-white truncate">
                                vs. {match.opponent.username}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {isCompleted ? (
                                <span className="text-slate-400 font-bold">Match Finished</span>
                              ) : isMyTurn ? (
                                <span className="text-amber-300 font-black animate-pulse flex items-center gap-1">
                                  <span>⚡</span> YOUR TURN TO MOVE!
                                </span>
                              ) : (
                                <span>Waiting for {match.currentTurn.username}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {isMyTurn ? (
                            <Button variant="primary" size="sm" glow>
                              PLAY ➔
                            </Button>
                          ) : (
                            <Badge variant={isCompleted ? 'default' : 'gold'} size="sm">
                              {isCompleted ? 'View' : 'Waiting'}
                            </Badge>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* TAB 2: PLAYERS & INVITATIONS */}
          {activeTab === 'players' && (
            <section className="flex flex-col gap-3">
              {/* Incoming Invitations */}
              {invitations.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs uppercase font-black text-amber-400 tracking-wider flex items-center gap-1">
                    <span>📬</span>
                    <span>Incoming Challenges ({invitations.length})</span>
                  </h3>
                  {invitations.map((invite) => (
                    <div
                      key={invite.id}
                      className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-between gap-3 shadow-lg"
                    >
                      <div>
                        <span className="text-xs text-white">
                          <b className="font-black text-amber-300">{invite.sender.username}</b> has challenged you!
                        </span>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          variant="success"
                          size="sm"
                          disabled={loadingAction !== null}
                          onClick={() => void respondToInvitation(invite.id, 'accept')}
                        >
                          Accept
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={loadingAction !== null}
                          onClick={() => void respondToInvitation(invite.id, 'decline')}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Player Directory */}
              <div className="flex flex-col gap-2">
                <h3 className="text-xs uppercase font-black text-slate-400 tracking-wider">
                  Available Opponents ({players.length})
                </h3>
                {players.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">No other players found yet.</p>
                ) : (
                  players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 border border-slate-800"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                          {player.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-white">{player.username}</span>
                      </div>
                      <Button
                        variant="accent"
                        size="sm"
                        disabled={loadingAction !== null}
                        loading={loadingAction === `invite:${player.id}`}
                        onClick={() => void sendInvitation(player.id)}
                      >
                        Challenge ⚔️
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {/* TAB 3: CHAMPIONS & CHARACTERS */}
          {activeTab === 'champions' && (
            <section className="flex flex-col gap-2">
              <CharacterShowcase initialCategory="ART" />
            </section>
          )}

          {/* TAB 4: PACKS */}
          {activeTab === 'packs' && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase font-black text-slate-400 tracking-wider">
                  Active Trivia Packs ({selectedPackIds.length})
                </h3>
                <button
                  onClick={onOpenPackCreator}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
                >
                  Manage / Create →
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {packs.map((pack) => {
                  const isSelected = selectedPackIds.includes(pack.id);
                  return (
                    <button
                      key={pack.id}
                      onClick={() => togglePack(pack.id)}
                      className={`px-3 py-2 rounded-2xl text-xs font-bold border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                          : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {pack.title} ({pack.questionCount} Qs)
                    </button>
                  );
                })}
              </div>

              <Button
                variant="secondary"
                size="md"
                onClick={onOpenPackCreator}
                className="w-full mt-2"
              >
                📚 Open Custom Pack Studio & JSON Importer
              </Button>
            </section>
          )}
        </div>
      )}
    </Card>
  );
}
