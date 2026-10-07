import { apiUrl } from '../utils/api';
import { foregroundSync } from '../utils/foregroundSync';
import { isNewGameState } from '../utils/gameState';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Category, GameStateSync, MatchPresenceResponse, QuestionResult, SpinResponse } from '../../../shared/src/index';

interface UseGameSyncOptions {
  gameId: string | null;
  accountId: string | null;
  sessionToken: string | null;
  onUnauthorized?: () => void;
  initialState?: GameStateSync | null;
}

export function useGameSync({ gameId, accountId, sessionToken, onUnauthorized, initialState = null }: UseGameSyncOptions) {
  const [gameState, setGameState] = useState<GameStateSync | null>(initialState);
  const [snapshotGeneration, setSnapshotGeneration] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [presence, setPresence] = useState<MatchPresenceResponse | null>(null);
  const [loading, setLoading] = useState(!initialState && Boolean(gameId));
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef<GameStateSync | null>(initialState);
  const lifecycleRef = useRef<ReturnType<typeof foregroundSync> | null>(null);
  const identityRef = useRef({ gameId, sessionToken, generation: 0 });
  if (identityRef.current.gameId !== gameId || identityRef.current.sessionToken !== sessionToken) {
    identityRef.current = { gameId, sessionToken, generation: identityRef.current.generation + 1 };
    stateRef.current = initialState;
  }
  const generation = identityRef.current.generation;
  const current = useCallback(() => identityRef.current.generation === generation, [generation]);

  useEffect(() => {
    stateRef.current = initialState;
    setGameState(initialState);
    setSnapshotGeneration(generation);
    setLoading(!initialState && Boolean(gameId));
    setError(null);
  }, [gameId, sessionToken, initialState]);

  const applyState = useCallback((data: GameStateSync) => {
    if (!current() || !isNewGameState(stateRef.current, data, gameId)) return false;
    stateRef.current = data;
    setGameState(data);
    setSnapshotGeneration(generation);
    setLoading(false);
    setError(null);
    if (data.status === 'COMPLETED') lifecycleRef.current?.pause();
    return true;
  }, [gameId, current]);

  const authFetch = useCallback((path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (sessionToken) headers.set('Authorization', 'Bearer ' + sessionToken);
    return fetch(apiUrl(path), { ...init, headers, cache: 'no-store' });
  }, [sessionToken]);

  const failure = useCallback(async (res: Response) => {
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (!current()) return;
    if (res.status === 401) onUnauthorized?.();
    else setError(data.error || 'The game action failed');
  }, [current, onUnauthorized]);

  const refresh = useCallback(async () => { await lifecycleRef.current?.refresh(); }, []);

  useEffect(() => {
    setPresence(null);
    if (!gameId || !sessionToken || gameState?.status === 'COMPLETED') return;
    const connectionId = crypto.randomUUID();
    const path = '/api/games/' + encodeURIComponent(gameId) + '/presence';
    let stopped = false;
    let pending: AbortController | null = null;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    let terminal = false;
    const release = () => {
      pending?.abort(); pending = null;
      clearTimeout(expiry);
      setPresence(null);
      void authFetch(path, { method:'POST', keepalive:true, headers:{'Content-Type':'application/json'}, body:JSON.stringify({connectionId, active:false}) }).catch(() => {});
    };
    const heartbeat = async () => {
      if (stopped || terminal || !current()) return;
      if (document.visibilityState !== 'visible' || !navigator.onLine) { release(); return; }
      if (pending) return;
      const controller = new AbortController(); pending = controller;
      try {
        const response = await authFetch(path, { method:'POST', signal:AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]), headers:{'Content-Type':'application/json'}, body:JSON.stringify({connectionId, active:true}) });
        if (stopped || !current() || controller.signal.aborted) return;
        if (response.status === 401 || response.status === 404) { terminal = true; setPresence(null); if (response.status === 401) onUnauthorized?.(); return; }
        if (!response.ok) throw new Error('Presence unavailable');
        const data = await response.json() as MatchPresenceResponse;
        if (stopped || !current() || controller.signal.aborted || data.gameId !== gameId) return;
        setPresence(data);
        clearTimeout(expiry);
        expiry = setTimeout(() => { if (!stopped && current()) setPresence(null); }, Math.min(data.expiresInMs, 30_000));
      } catch { if (!stopped && current() && !controller.signal.aborted) setPresence(null); }
      finally { if (pending === controller) pending = null; }
    };
    const reconcile = () => { void heartbeat(); };
    void heartbeat();
    const interval = setInterval(reconcile, 10_000);
    document.addEventListener('visibilitychange', reconcile);
    window.addEventListener('online', reconcile);
    window.addEventListener('offline', reconcile);
    window.addEventListener('pagehide', release);
    window.addEventListener('pageshow', reconcile);
    return () => {
      stopped = true; clearInterval(interval); release();
      document.removeEventListener('visibilitychange', reconcile);
      window.removeEventListener('online', reconcile);
      window.removeEventListener('offline', reconcile);
      window.removeEventListener('pagehide', release);
      window.removeEventListener('pageshow', reconcile);
    };
  }, [gameId, sessionToken, gameState?.status, current, authFetch, onUnauthorized]);

  useEffect(() => {
    setIsConnected(false);
    if (!gameId || !sessionToken) return;
    let stopped = false;
    let terminal = false;
    const valid = () => !stopped && current();
    const lifecycle = foregroundSync({
      eligible: () => valid() && !terminal && document.visibilityState === 'visible' && navigator.onLine && stateRef.current?.status !== 'COMPLETED',
      connected: value => { if (valid()) setIsConnected(value); },
      terminal: res => {
        if (!valid()) return true;
        if (res.status !== 401 && res.status !== 404) return false;
        terminal = true;
        if (res.status === 401) onUnauthorized?.();
        else setError('Game not found');
        setLoading(false);
        return true;
      },
      fetchState: async signal => {
        try {
          const res = await authFetch('/api/games/' + encodeURIComponent(gameId), { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
          if (!valid() || signal.aborted) return;
          if (res.status === 401 || res.status === 404) {
            terminal = true;
            await failure(res);
            lifecycle.pause();
            return;
          }
          if (!res.ok) throw new Error('Refresh failed');
          const data = await res.json() as GameStateSync;
          if (valid() && !signal.aborted) applyState(data);
        } catch {
          if (valid() && !signal.aborted && !stateRef.current) setError('Connection disrupted');
        } finally { if (valid() && !signal.aborted) setLoading(false); }
      },
      fetchEvents: signal => authFetch('/api/games/' + encodeURIComponent(gameId) + '/events', {
        signal, headers: { Accept: 'text/event-stream' }
      }),
      event: (event, data) => {
        if (!valid()) return;
        if (event === 'sync') applyState(JSON.parse(data) as GameStateSync);
        if (event === 'unauthorized' || event === 'not-found') {
          terminal = true;
          if (event === 'unauthorized') onUnauthorized?.();
          else setError('Game not found');
          setLoading(false);
        }
      }
    });
    lifecycleRef.current = lifecycle;
    const reconcile = () => { void lifecycle.resume(); };
    void lifecycle.resume();
    window.addEventListener('online', reconcile);
    window.addEventListener('offline', reconcile);
    window.addEventListener('pageshow', reconcile);
    window.addEventListener('pagehide', lifecycle.pause);
    document.addEventListener('visibilitychange', reconcile);
    return () => {
      stopped = true;
      lifecycle.dispose();
      if (lifecycleRef.current === lifecycle) lifecycleRef.current = null;
      window.removeEventListener('online', reconcile);
      window.removeEventListener('offline', reconcile);
      window.removeEventListener('pageshow', reconcile);
      window.removeEventListener('pagehide', lifecycle.pause);
      document.removeEventListener('visibilitychange', reconcile);
    };
  }, [gameId, sessionToken, current, authFetch, applyState, failure, onUnauthorized]);

  const action = useCallback(async (name: string, body?: unknown) => {
    if (!gameId || !accountId || !sessionToken) return null;
    try {
      const res = await authFetch('/api/games/' + encodeURIComponent(gameId) + '/' + name, {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      });
      if (!current()) return null;
      if (!res.ok) { await failure(res); if (current()) void refresh(); return null; }
      const data = await res.json();
      if (!current()) return null;
      applyState(data.state || data);
      setError(null);
      return data;
    } catch {
      if (current()) { setError('Connection disrupted'); void refresh(); }
      return null;
    }
  }, [gameId, accountId, sessionToken, authFetch, failure, refresh, current, applyState]);

  const spin = useCallback(async (): Promise<SpinResponse | null> => action('spin'), [action]);
  const answer = useCallback(async (questionId: string, answerIndex: number, timeSpentMs: number): Promise<QuestionResult | null> => {
    const data = await action('answer', { questionId, answerIndex, timeSpentMs });
    return data?.result ?? null;
  }, [action]);
  const chooseCrown = useCallback(async (choice: 'claim' | 'steal', category: Category, wagerCategory?: Category) =>
    Boolean(await action('crown', { action: choice, category, wagerCategory })), [action]);
  const resign = useCallback(async () => Boolean(await action('resign')), [action]);

  const visibleState = snapshotGeneration === generation && gameState?.id === gameId ? gameState : null;
  return { gameState: visibleState, isConnected, presence, loading, error, targetDegrees: visibleState?.lastSpin?.targetDegrees,
    lastSpinSlice: visibleState?.lastSpin?.slice, lastResult: visibleState?.lastResult,
    spin, answer, chooseCrown, resign, refresh };
}
