import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type {
  AccountSummary,
  AuthResponse,
  GameListResponse,
  InvitationSummary,
  PlayerSummary,
  QuestionPackMeta
} from '../../../shared/src/index';
import { isAudioMuted, playButtonPop, setAudioMuted } from '../utils/audio';
import { apiUrl } from '../utils/api';

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

export default function Lobby({ account, onAuth, onLogout, onOpenGame, onOpenPackCreator }: LobbyProps) {
  const [packs, setPacks] = useState<QuestionPackMeta[]>([]);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>(['default']);
  const [players, setPlayers] = useState<Player[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(isAudioMuted());

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
      .catch((error: unknown) => setErrorMessage(error instanceof Error ? error.message : 'Could not load question packs'));
  }, []);
  useEffect(() => { void refreshDashboard(); }, [refreshDashboard]);
  useEffect(() => {
    if (!account) return;
    const interval = window.setInterval(() => void refreshDashboard(), 10_000);
    return () => window.clearInterval(interval);
  }, [account, refreshDashboard]);

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    setLoadingAction('auth');
    setErrorMessage(null);
    try {
      const payload = registering ? { username, email, password } : { email, password };
      const data = await readResponse<AuthResponse>(await fetch(apiUrl(`/api/auth/${registering ? 'register' : 'login'}`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      }));
      onAuth({ ...data.account, token: data.token });
      setPassword('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Authentication failed');
    } finally { setLoadingAction(null); }
  };

  const perform = async (key: string, action: () => Promise<void>) => {
    setLoadingAction(key);
    setErrorMessage(null);
    try { await action(); } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Request failed');
    } finally { setLoadingAction(null); }
  };

  const sendInvitation = (recipientId: string) => perform(`invite:${recipientId}`, async () => {
    await readResponse(await authFetch('/api/invitations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId, packIds: selectedPackIds })
    }));
    await refreshDashboard();
  });

  const respondToInvitation = (id: string, decision: 'accept' | 'decline') => perform(`respond:${id}`, async () => {
    const data = await readResponse<{ gameId?: string | null }>(await authFetch(`/api/invitations/${encodeURIComponent(id)}/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision })
    }));
    let acceptedGameId = decision === 'accept' ? data.gameId ?? null : null;
    if (decision === 'accept' && !acceptedGameId) {
      const previousGameIds = new Set(matches.map((match) => match.gameId));
      const updatedMatches = await authFetch('/api/games').then((res) => readResponse<GameListResponse>(res));
      setMatches(updatedMatches.matches);
      acceptedGameId = updatedMatches.matches.find((match) => !previousGameIds.has(match.gameId))?.gameId ?? null;
    }
    await refreshDashboard();
    if (acceptedGameId) onOpenGame(acceptedGameId);
  });

  const togglePack = (packId: string) => setSelectedPackIds((selected) =>
    selected.includes(packId) ? (selected.length > 1 ? selected.filter((id) => id !== packId) : selected) : [...selected, packId]
  );
  const toggleMute = () => {
    const next = !muted;
    setMuted(next); setAudioMuted(next); playButtonPop();
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 max-h-[90dvh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 flex items-center justify-center text-xl shadow-lg border border-yellow-300">👑</div>
          <div><h1 className="text-xl font-black text-white tracking-tight">TRIVIA <span className="text-yellow-400">CLASH</span></h1><p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Turn-Based Crown Duels</p></div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={toggleMute} className="w-9 h-9 rounded-2xl bg-slate-800 border border-slate-700/60 text-sm" title={muted ? 'Unmute Audio' : 'Mute Audio'}>{muted ? '🔇' : '🔊'}</button>
          {account && <button onClick={onLogout} disabled={loadingAction !== null} className="px-3 rounded-xl bg-slate-800 text-xs font-bold text-slate-200">Log out</button>}
        </div>
      </div>

      {errorMessage && <div role="alert" className="p-3 bg-red-950/40 border border-red-800/40 rounded-2xl text-xs text-red-300 text-center animate-shake">{errorMessage}</div>}

      {!account ? <form onSubmit={handleAuth} className="flex flex-col gap-3">
        <h2 className="text-lg font-black text-white">{registering ? 'Create account' : 'Welcome back'}</h2>
        {registering && <label className="text-xs text-slate-300">Username<input required value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white" /></label>}
        <label className="text-xs text-slate-300">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white" /></label>
        <label className="text-xs text-slate-300">Password<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={registering ? 'new-password' : 'current-password'} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white" /></label>
        <button disabled={loadingAction !== null} className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-sm rounded-2xl disabled:opacity-50">{loadingAction === 'auth' ? 'Please wait…' : registering ? 'Create Account' : 'Log In'}</button>
        <button type="button" onClick={() => { setRegistering(!registering); setErrorMessage(null); }} className="text-xs text-indigo-300">{registering ? 'Already have an account? Log in' : 'New here? Create an account'}</button>
      </form> : <>
        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center font-black text-white">{account.username.charAt(0).toUpperCase()}</div>
          <div><div className="text-[10px] uppercase font-bold text-slate-400">Signed in as</div><div className="text-sm font-bold text-white">{account.username}</div></div>
        </div>
        <section className="p-2.5 bg-slate-950/40 rounded-2xl border border-slate-800/60">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex justify-between"><span>Question Packs ({selectedPackIds.length} active)</span><button onClick={onOpenPackCreator} className="text-indigo-400">Manage Packs →</button></div>
          <div className="flex flex-wrap gap-1.5">{packs.map((pack) => <button key={pack.id} onClick={() => togglePack(pack.id)} className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${selectedPackIds.includes(pack.id) ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-850 text-slate-400 border-slate-800'}`}>{selectedPackIds.includes(pack.id) ? '✓ ' : '+ '}{pack.title} ({pack.questionCount})</button>)}</div>
        </section>
        <section className="flex flex-col gap-2"><h2 className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Players</h2>
          {players.length === 0 ? <p className="text-xs text-slate-500">No other players yet.</p> : players.map((player) => <div key={player.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800"><span className="text-sm font-bold text-white">{player.username}</span><button onClick={() => void sendInvitation(player.id)} disabled={loadingAction !== null} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg disabled:opacity-40">{loadingAction === `invite:${player.id}` ? 'Sending…' : 'Invite'}</button></div>)}
        </section>
        <section className="flex flex-col gap-2"><h2 className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Incoming Invitations</h2>
          {invitations.length === 0 ? <p className="text-xs text-slate-500">No pending invitations.</p> : invitations.map((invite) => <div key={invite.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"><span className="text-sm text-white"><b>{invite.sender.username}</b> invited you</span><div className="flex gap-1.5"><button onClick={() => void respondToInvitation(invite.id, 'accept')} disabled={loadingAction !== null} className="px-2.5 py-1.5 bg-emerald-700 text-white text-xs font-bold rounded-lg">Accept</button><button onClick={() => void respondToInvitation(invite.id, 'decline')} disabled={loadingAction !== null} className="px-2.5 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg">Decline</button></div></div>)}
        </section>
        <section className="flex flex-col gap-2"><h2 className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Matches</h2>
          {matches.length === 0 ? <p className="text-xs text-slate-500">Your accepted matches will appear here.</p> : matches.map((match) => <button key={match.gameId} onClick={() => onOpenGame(match.gameId)} className="w-full text-left p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500"><div className="flex justify-between text-sm font-bold text-white"><span>vs. {match.opponent.username}</span><span className="text-[10px] uppercase text-yellow-400">{match.status.replace('_', ' ')}</span></div><div className="mt-1 text-[11px] text-slate-400">{match.status === 'COMPLETED' ? 'Completed' : match.currentTurn.id === account.id ? 'Your turn' : `${match.currentTurn.username}'s turn`}</div></button>)}
        </section>
      </>}
      <button onClick={onOpenPackCreator} className="w-full py-2 text-center text-xs font-bold text-slate-400 hover:text-indigo-400">📚 Custom Question Pack Creator & JSON Import →</button>
    </div>
  );
}
