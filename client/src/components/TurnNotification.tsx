import { useEffect, useState } from 'react';
import type { GameListResponse, MatchSummary } from '../../../shared/src/index';
import type { AccountSession } from './Lobby';
import BottomSheet from './ui/BottomSheet';
import { apiUrl } from '../utils/api';

/** Mounted only outside games; dismissal lasts until the observed turn changes. */
export default function TurnNotification({ account, onOpenGame, onUnauthorized }: {
  account: AccountSession;
  onOpenGame: (gameId: string) => void;
  onUnauthorized: () => void;
}) {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;
    const refresh = async () => {
      if (disposed || controller || !navigator.onLine || document.visibilityState !== 'visible') return;
      controller = new AbortController();
      const request = controller;
      try {
        const response = await fetch(apiUrl('/api/games'), {
          headers: { Authorization: `Bearer ${account.token}` },
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
        });
        if (disposed) return;
        if (response.status === 401) { onUnauthorized(); return; }
        if (!response.ok) return;
        const data = await response.json() as GameListResponse;
        if (disposed || request.signal.aborted) return;
        const turns = data.matches.filter(match => match.status === 'IN_PROGRESS' && match.currentTurn.id === account.id);
        setMatches(turns);
        setDismissed(previous => new Set([...previous].filter(id => turns.some(match => match.gameId === id))));
      } catch { /* Retry on the next poll or reconnection. */ }
      finally { if (controller === request) controller = null; }
    };
    const resume = () => { void refresh(); };
    void refresh();
    const interval = window.setInterval(resume, 10_000);
    window.addEventListener('online', resume);
    window.addEventListener('pageshow', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener('online', resume);
      window.removeEventListener('pageshow', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [account.id, account.token, onUnauthorized]);

  const pending = matches.filter(match => !dismissed.has(match.gameId));
  const dismiss = () => setDismissed(previous => new Set([...previous, ...pending.map(match => match.gameId)]));
  return (
    <BottomSheet isOpen={pending.length > 0} onClose={dismiss} title="It's your turn!" subtitle="Your next trivia challenge is ready">
      <div className="flex flex-col gap-3 py-2">
        {pending.map(match => (
          <button key={match.gameId} type="button" onClick={() => onOpenGame(match.gameId)}
            className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm">
            Play against {match.opponent.username}
          </button>
        ))}
        <button type="button" onClick={dismiss} className="w-full py-2.5 text-sm font-semibold text-slate-400 hover:text-white">Later</button>
      </div>
    </BottomSheet>
  );
}
