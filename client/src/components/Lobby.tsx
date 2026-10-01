import { apiUrl } from '../utils/api';
import { useState, useEffect } from 'react';
import type { CreateGameResponse, JoinGameResponse, QuestionPackMeta } from '../../../shared/src/index';
import { isAudioMuted, playButtonPop, setAudioMuted } from '../utils/audio';

interface LobbyProps {
  onGameJoined: (gameId: string, playerId: string, playerToken: string, isHost: boolean) => void;
  onOpenPackCreator: () => void;
}

interface RecentGameEntry {
  gameId: string;
  inviteCode: string;
  playerId: string;
  playerToken: string;
  opponentName?: string;
  date: number;
}

export default function Lobby({ onGameJoined, onOpenPackCreator }: LobbyProps) {
  const [nickname, setNickname] = useState<string>('Player');
  const [joinCode, setJoinCode] = useState<string>('');
  const [packs, setPacks] = useState<QuestionPackMeta[]>([]);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>(['default']);
  const [recentGames, setRecentGames] = useState<RecentGameEntry[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(isAudioMuted());

  // Load saved nickname and recent games
  useEffect(() => {
    try {
      const savedName = localStorage.getItem('trivia_clash_nickname');
      if (savedName) setNickname(savedName);

      const savedGames = localStorage.getItem('trivia_clash_recent_games');
      if (savedGames) {
        setRecentGames(JSON.parse(savedGames) as RecentGameEntry[]);
      }
    } catch {
      // Ignore storage errors
    }

    // Check URL parameters for join code
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const codeParam = params.get('join');
      if (codeParam) {
        setJoinCode(codeParam.toUpperCase());
      }
    }

    // Fetch packs
    fetch(apiUrl('/api/packs'))
      .then((res) => res.json())
      .then((data) => setPacks(data as QuestionPackMeta[]))
      .catch(() => {});
  }, []);

  const handleNameChange = (val: string) => {
    setNickname(val);
    try {
      localStorage.setItem('trivia_clash_nickname', val);
    } catch {
      // Ignore
    }
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
    playButtonPop();
  };

  const saveRecentGame = (entry: RecentGameEntry) => {
    try {
      const updated = [entry, ...recentGames.filter((g) => g.gameId !== entry.gameId)].slice(0, 5);
      setRecentGames(updated);
      localStorage.setItem('trivia_clash_recent_games', JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const handleCreateGame = async () => {
    if (!nickname.trim()) {
      setErrorMessage('Please choose a nickname first');
      return;
    }

    setLoadingAction('create');
    setErrorMessage(null);
    playButtonPop();

    try {
      const res = await fetch(apiUrl('/api/games'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: nickname.trim(),
          packIds: selectedPackIds
        })
      });

      if (res.ok) {
        const data = (await res.json()) as CreateGameResponse;
        saveRecentGame({
          gameId: data.gameId,
          inviteCode: data.inviteCode,
          playerId: data.playerId,
          playerToken: data.playerToken,
          date: Date.now()
        });
        onGameJoined(data.gameId, data.playerId, data.playerToken, true);
      } else {
        const err = (await res.json()) as { error?: string };
        setErrorMessage(err.error || 'Failed to create game');
      }
    } catch {
      setErrorMessage('Network connection error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleJoinGame = async (codeToJoin?: string) => {
    const targetCode = (codeToJoin || joinCode).trim();
    if (!targetCode) {
      setErrorMessage('Please enter a room code');
      return;
    }
    if (!nickname.trim()) {
      setErrorMessage('Please choose a nickname first');
      return;
    }

    setLoadingAction('join');
    setErrorMessage(null);
    playButtonPop();

    try {
      const res = await fetch(apiUrl(`/api/games/${encodeURIComponent(targetCode)}/join`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: nickname.trim() })
      });

      if (res.ok) {
        const data = (await res.json()) as JoinGameResponse;
        saveRecentGame({
          gameId: data.gameId,
          inviteCode: targetCode.toUpperCase(),
          playerId: data.playerId,
          playerToken: data.playerToken,
          date: Date.now()
        });
        onGameJoined(data.gameId, data.playerId, data.playerToken, false);
      } else {
        const err = (await res.json()) as { error?: string };
        setErrorMessage(err.error || 'Could not join match (invalid code or match full)');
      }
    } catch {
      setErrorMessage('Network connection error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleTogglePackSelection = (packId: string) => {
    if (selectedPackIds.includes(packId)) {
      if (selectedPackIds.length > 1) {
        setSelectedPackIds(selectedPackIds.filter((id) => id !== packId));
      }
    } else {
      setSelectedPackIds([...selectedPackIds, packId]);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
      {/* Top Banner / Logo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 flex items-center justify-center text-xl shadow-lg border border-yellow-300">
            👑
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight leading-tight">
              TRIVIA <span className="text-yellow-400">CLASH</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Turn-Based Crown Duels
            </p>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleToggleMute}
            className="w-9 h-9 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700/60 flex items-center justify-center text-sm transition"
            title={muted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {/* Nickname Input Card */}
      <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center font-black text-white text-base shadow shrink-0">
          {nickname.trim() ? nickname.trim().charAt(0).toUpperCase() : '?'}
        </div>
        <div className="flex-1">
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
            Your Nickname
          </label>
          <input
            type="text"
            maxLength={18}
            value={nickname}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Enter nickname..."
            className="w-full bg-transparent text-sm font-bold text-white placeholder-slate-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 bg-red-950/40 border border-red-800/40 rounded-2xl text-xs text-red-300 text-center animate-shake">
          {errorMessage}
        </div>
      )}

      {/* Create Game Section */}
      <div className="flex flex-col gap-2.5">
        <button
          onClick={handleCreateGame}
          disabled={loadingAction !== null}
          className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-yellow-500/15 transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <span>🎲</span>
          <span>{loadingAction === 'create' ? 'Creating Duel...' : 'Create New Match'}</span>
        </button>

        {/* Active Packs Selector */}
        {packs.length > 0 && (
          <div className="p-2.5 bg-slate-950/40 rounded-2xl border border-slate-800/60">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Question Packs ({selectedPackIds.length} active)</span>
              <button
                onClick={onOpenPackCreator}
                className="text-indigo-400 hover:text-indigo-300 capitalize text-[10px]"
              >
                Manage Packs →
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {packs.map((pack) => {
                const isSelected = selectedPackIds.includes(pack.id);
                return (
                  <button
                    key={pack.id}
                    onClick={() => handleTogglePackSelection(pack.id)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                        : 'bg-slate-850 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {pack.title} ({pack.questionCount})
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Join Game Section */}
      <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
        <label className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
          Or Join Friend's Room
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Room Code (TRIV-XXXX)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-sm font-mono font-bold text-white placeholder-slate-600 uppercase focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => handleJoinGame()}
            disabled={loadingAction !== null || !joinCode.trim()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-2xl shadow transition disabled:opacity-40"
          >
            {loadingAction === 'join' ? 'Joining...' : 'Join Duel'}
          </button>
        </div>
      </div>

      {/* Recent Games */}
      {recentGames.length > 0 && (
        <div className="pt-2 border-t border-slate-800 flex flex-col gap-1.5">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            Resume Match
          </span>
          <div className="flex flex-col gap-1.5">
            {recentGames.map((game) => (
              <div
                key={game.gameId}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-yellow-400">{game.inviteCode}</span>
                  <span className="text-[10px] text-slate-500 ml-2">
                    {new Date(game.date).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => onGameJoined(game.gameId, game.playerId, game.playerToken, false)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition"
                >
                  Resume ▶
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Pack Creator link */}
      <button
        onClick={onOpenPackCreator}
        className="w-full py-2 text-center text-xs font-bold text-slate-400 hover:text-indigo-400 transition"
      >
        📚 Custom Question Pack Creator & JSON Import →
      </button>
    </div>
  );
}
