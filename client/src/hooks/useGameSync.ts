import { apiUrl } from '../utils/api';
import { readGameEvents } from '../utils/gameEvents';
import { isNewGameState } from '../utils/gameState';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Category, GameStateSync, QuestionResult, SpinResponse } from '../../../shared/src/index';

interface UseGameSyncOptions {
  gameId: string | null;
  accountId: string | null;
  sessionToken: string | null;
  onUnauthorized?: () => void;
  initialState?: GameStateSync | null;
}

export function useGameSync({ gameId, accountId, sessionToken, onUnauthorized, initialState = null }: UseGameSyncOptions) {
  const [gameState, setGameState] = useState<GameStateSync | null>(initialState);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(!initialState && Boolean(gameId));
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef<GameStateSync | null>(initialState);
  const connectedRef = useRef(false);
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
    setLoading(!initialState && Boolean(gameId));
    setError(null);
  }, [gameId, sessionToken, initialState]);

  const applyState = useCallback((data: GameStateSync) => {
    if (!current() || !isNewGameState(stateRef.current, data, gameId)) return false;
    stateRef.current = data;
    setGameState(data);
    setLoading(false);
    setError(null);
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

  const refresh = useCallback(async () => {
    if (!gameId || !sessionToken) return;
    try {
      const res = await authFetch('/api/games/' + encodeURIComponent(gameId));
      if (!res.ok) { await failure(res); return; }
      applyState(await res.json() as GameStateSync);
    } catch {
      if (current() && !stateRef.current) setError('Connection disrupted');
    } finally {
      if (current()) setLoading(false);
    }
  }, [gameId, sessionToken, authFetch, applyState, failure, current]);

  useEffect(() => {
    connectedRef.current = false;
    setIsConnected(false);
    if (!gameId || !sessionToken) return;
    const matchComplete = () => stateRef.current?.status === 'COMPLETED';
    let stopped = false;
    let controller: AbortController | undefined;
    let retryTimer: number | undefined;
    let backoff = 1000;
    const connect = async () => {
      if (stopped || matchComplete()) return;
      controller = new AbortController();
      try {
        const res = await authFetch('/api/games/' + encodeURIComponent(gameId) + '/events', {
          signal: controller.signal, headers: { Accept: 'text/event-stream' }
        });
        if (stopped || !current()) { await res.body?.cancel(); return; }
        if (!res.ok) {
          if (res.status === 401) { onUnauthorized?.(); return; }
          if (res.status === 404) { setError('Game not found'); setLoading(false); return; }
          throw new Error('Event stream unavailable');
        }
        connectedRef.current = true;
        setIsConnected(true);
        backoff = 1000;
        await readGameEvents(res, (event, data) => {
          if (stopped || !current()) return;
          if (event === 'sync') applyState(JSON.parse(data) as GameStateSync);
          if (event === 'unauthorized') { stopped = true; onUnauthorized?.(); controller?.abort(); }
        });
      } catch {
        // Abort on navigation; transport failures reconnect and fall back to REST.
      } finally {
        if (!stopped && current()) { connectedRef.current = false; setIsConnected(false); }
      }
      if (!stopped && current() && !matchComplete()) {
        void refresh();
        retryTimer = window.setTimeout(() => void connect(), backoff);
        backoff = Math.min(backoff * 1.5, 10000);
      }
    };
    void refresh();
    void connect();
    const pollTimer = window.setInterval(() => {
      if (!connectedRef.current && !matchComplete()) void refresh();
    }, 5000);
    return () => {
      stopped = true;
      controller?.abort();
      window.clearTimeout(retryTimer);
      window.clearInterval(pollTimer);
    };
  }, [gameId, sessionToken, current, authFetch, applyState, refresh, onUnauthorized]);

  const action = useCallback(async (name: string, body?: unknown) => {
    if (!gameId || !accountId || !sessionToken) return null;
    try {
      const res = await authFetch('/api/games/' + encodeURIComponent(gameId) + '/' + name, {
        method: 'POST',
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      });
      if (!res.ok) { await failure(res); void refresh(); return null; }
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

  return { gameState, isConnected, loading, error, targetDegrees: gameState?.lastSpin?.targetDegrees,
    lastSpinSlice: gameState?.lastSpin?.slice, lastResult: gameState?.lastResult,
    spin, answer, chooseCrown, resign, refresh };
}
