import { apiUrl } from '../utils/api';
import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  AnswerQuestionRequest,
  Category,
  CrownChoiceRequest,
  GameStateSync,
  QuestionResult,
  SpinResponse
} from '../../../shared/src/index';

interface UseGameSyncOptions {
  gameId: string | null;
  accountId: string | null;
  sessionToken: string | null;
  onUnauthorized?: () => void;
  initialState?: GameStateSync | null;
}

interface UseGameSyncReturn {
  gameState: GameStateSync | null;
  isConnected: boolean;
  loading: boolean;
  error: string | null;
  targetDegrees: number | undefined;
  lastSpinSlice: string | undefined;
  lastResult: QuestionResult | undefined;
  spin: () => Promise<SpinResponse | null>;
  answer: (questionId: string, answerIndex: number, timeSpentMs: number) => Promise<QuestionResult | null>;
  chooseCrown: (action: 'claim' | 'steal', category: Category, wagerCategory?: Category) => Promise<boolean>;
  resign: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useGameSync({
  gameId,
  accountId,
  sessionToken,
  onUnauthorized,
  initialState = null
}: UseGameSyncOptions): UseGameSyncReturn {
  const [gameState, setGameState] = useState<GameStateSync | null>(initialState);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(!initialState && Boolean(gameId));
  const [error, setError] = useState<string | null>(null);
  const [targetDegrees, setTargetDegrees] = useState<number | undefined>(undefined);
  const [lastSpinSlice, setLastSpinSlice] = useState<string | undefined>(undefined);
  const [lastResult, setLastResult] = useState<QuestionResult | undefined>(undefined);
  const eventSourceRef = useRef<EventSource | null>(null);
  const backoffRef = useRef<number>(1000);
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setGameState(initialState);
    setLoading(!initialState && Boolean(gameId));
    setError(null);
    setLastResult(undefined);
    setTargetDegrees(undefined);
    setLastSpinSlice(undefined);
  }, [gameId, initialState]);

  const authenticatedFetch = useCallback((path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`);
    return fetch(apiUrl(path), { ...init, headers });
  }, [sessionToken]);

  const refresh = useCallback(async () => {
    if (!gameId || !sessionToken) return;
    try {
      const res = await authenticatedFetch(`/api/games/${encodeURIComponent(gameId)}`);
      if (res.status === 401) {
        setError('Your session has expired. Please log in again.');
        onUnauthorized?.();
      } else if (res.ok) {
        const data = await res.json() as GameStateSync;
        setGameState((prev) => {
          if (
            prev &&
            prev.updatedAt === data.updatedAt &&
            prev.status === data.status &&
            prev.mode === data.mode &&
            prev.currentTurnPlayerId === data.currentTurnPlayerId &&
            prev.players.p1.crownGauge === data.players.p1.crownGauge &&
            prev.players.p2?.crownGauge === data.players.p2?.crownGauge
          ) {
            return prev;
          }
          return data;
        });
        setLastResult(data.lastResult);
        if (data.lastSpin) {
          setTargetDegrees(data.lastSpin.targetDegrees);
          setLastSpinSlice(data.lastSpin.slice);
        }
        setError(null);
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error || 'Could not load this match');
      }
    } catch {
      // Only surface disruption error if game has never loaded yet
      setGameState((prev) => {
        if (!prev) setError('Connection disrupted');
        return prev;
      });
    } finally { setLoading(false); }
  }, [gameId, sessionToken, authenticatedFetch, onUnauthorized]);

  useEffect(() => {
    if (!gameId || !sessionToken) {
      setIsConnected(false);
      setLoading(Boolean(gameId));
      return;
    }
    let isMounted = true;
    const connectSSE = () => {
      eventSourceRef.current?.close();
      const sseUrl = apiUrl(`/api/games/${encodeURIComponent(gameId)}/events?session=${encodeURIComponent(sessionToken)}`);
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;
      es.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true); setError(null); backoffRef.current = 1000;
      };
      es.addEventListener('sync', (event) => {
        if (!isMounted) return;
        try {
          const fresh = JSON.parse(event.data) as GameStateSync;
          setGameState(fresh);
          setLastResult(fresh.lastResult);
          if (fresh.lastSpin) { setTargetDegrees(fresh.lastSpin.targetDegrees); setLastSpinSlice(fresh.lastSpin.slice); }
          setLoading(false);
        } catch { /* Ignore malformed sync events. */ }
      });
      es.onerror = () => {
        if (!isMounted) return;
        setIsConnected(false); es.close();
        const timeout = Math.min(backoffRef.current, 10000);
        backoffRef.current *= 1.5;
        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (isMounted) { connectSSE(); void refresh(); }
        }, timeout);
      };
    };
    connectSSE();
    // Active polling (every 2s): Ensures synchronization across ephemeral serverless isolates
    // where SSE connections may be anchored to an isolate that didn't process the opponent's action.
    const pollInterval = window.setInterval(() => {
      if (isMounted) void refresh();
    }, 2000);
    return () => {
      isMounted = false;
      window.clearInterval(pollInterval);
      window.clearTimeout(reconnectTimeoutRef.current);
      eventSourceRef.current?.close();
    };
  }, [gameId, sessionToken, refresh]);

  const reportActionFailure = useCallback(async (res: Response) => {
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (res.status === 401) {
      setError('Your session has expired. Please log in again.');
      onUnauthorized?.();
    } else setError(data.error || 'The game action failed');
  }, [onUnauthorized]);

  const spin = useCallback(async (): Promise<SpinResponse | null> => {
    if (!gameId || !accountId || !sessionToken) return null;
    try {
      const res = await authenticatedFetch(`/api/games/${encodeURIComponent(gameId)}/spin`, { method: 'POST' });
      if (!res.ok) { await reportActionFailure(res); return null; }
      const data = await res.json() as SpinResponse;
      setTargetDegrees(data.targetDegrees); setLastSpinSlice(data.slice); setGameState(data.state); setLastResult(undefined); setError(null);
      return data;
    } catch { setError('Connection disrupted'); return null; }
  }, [gameId, accountId, sessionToken, authenticatedFetch, reportActionFailure]);

  const answer = useCallback(async (questionId: string, answerIndex: number, timeSpentMs: number): Promise<QuestionResult | null> => {
    if (!gameId || !accountId || !sessionToken) return null;
    try {
      const body: AnswerQuestionRequest = { questionId, answerIndex, timeSpentMs };
      const res = await authenticatedFetch(`/api/games/${encodeURIComponent(gameId)}/answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (!res.ok) { await reportActionFailure(res); return null; }
      const data = await res.json() as { result: QuestionResult; state: GameStateSync };
      setLastResult(data.result); setGameState(data.state); setError(null); return data.result;
    } catch { setError('Connection disrupted'); return null; }
  }, [gameId, accountId, sessionToken, authenticatedFetch, reportActionFailure]);

  const chooseCrown = useCallback(async (action: 'claim' | 'steal', category: Category, wagerCategory?: Category): Promise<boolean> => {
    if (!gameId || !accountId || !sessionToken) return false;
    try {
      const body: CrownChoiceRequest = { action, category, wagerCategory };
      const res = await authenticatedFetch(`/api/games/${encodeURIComponent(gameId)}/crown`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (!res.ok) { await reportActionFailure(res); return false; }
      setGameState(await res.json() as GameStateSync); setError(null); return true;
    } catch { setError('Connection disrupted'); return false; }
  }, [gameId, accountId, sessionToken, authenticatedFetch, reportActionFailure]);

  const resign = useCallback(async () => {
    if (!gameId || !accountId || !sessionToken) return;
    try {
      const res = await authenticatedFetch(`/api/games/${encodeURIComponent(gameId)}/resign`, { method: 'POST' });
      if (!res.ok) { await reportActionFailure(res); return; }
      setGameState(await res.json() as GameStateSync); setError(null);
    } catch { setError('Connection disrupted'); }
  }, [gameId, accountId, sessionToken, authenticatedFetch, reportActionFailure]);

  return { gameState, isConnected, loading, error, targetDegrees, lastSpinSlice, lastResult, spin, answer, chooseCrown, resign, refresh };
}
