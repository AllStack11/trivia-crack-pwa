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
  playerId: string | null;
  playerToken: string | null;
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
  playerId,
  playerToken,
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
  const refresh = useCallback(async () => {
    if (!gameId) return;
    try {
      const res = await fetch(apiUrl(`/api/games/${gameId}`));
      if (res.ok) {
        const data = (await res.json()) as GameStateSync;
        setGameState(data);
        if (data.lastResult) {
          setLastResult(data.lastResult);
        }
        setError(null);
      } else {
        setError('Match not found');
      }
    } catch {
      setError('Connection disrupted');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  // Connect to SSE stream
  useEffect(() => {
    if (!gameId || !playerToken) {
      setIsConnected(false);
      return;
    }

    let isMounted = true;

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const sseUrl = apiUrl(`/api/games/${gameId}/events?token=${encodeURIComponent(playerToken)}`);
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true);
        setError(null);
        backoffRef.current = 1000; // Reset backoff on successful connect
      };

      es.addEventListener('sync', (e) => {
        if (!isMounted) return;
        try {
          const fresh = JSON.parse(e.data) as GameStateSync;
          setGameState(fresh);
          if (fresh.lastResult) {
            setLastResult(fresh.lastResult);
          }
          setLoading(false);
        } catch {
          // Ignore JSON parse error
        }
      });

      es.onerror = () => {
        if (!isMounted) return;
        setIsConnected(false);
        es.close();

        // Auto-reconnect with exponential backoff
        const timeout = Math.min(backoffRef.current, 10000);
        backoffRef.current *= 1.5;

        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (isMounted) {
            connectSSE();
            refresh();
          }
        }, timeout);
      };
    };

    connectSSE();

    // Secondary backup polling every 4 seconds to protect mobile tabs
    const pollInterval = setInterval(() => {
      if (isMounted && (!eventSourceRef.current || eventSourceRef.current.readyState !== EventSource.OPEN)) {
        refresh();
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [gameId, playerToken, refresh]);

  // Spin Action
  const spin = useCallback(async (): Promise<SpinResponse | null> => {
    if (!gameId || !playerId) return null;
    try {
      const res = await fetch(apiUrl(`/api/games/${gameId}/spin`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-id': playerId
        }
      });

      if (res.ok) {
        const data = (await res.json()) as SpinResponse;
        setTargetDegrees(data.targetDegrees);
        setLastSpinSlice(data.slice);
        setGameState(data.state);
        setLastResult(undefined);
        return data;
      }
      return null;
    } catch {
      return null;
    }
  }, [gameId, playerId]);

  // Answer Action
  const answer = useCallback(
    async (questionId: string, answerIndex: number, timeSpentMs: number): Promise<QuestionResult | null> => {
      if (!gameId || !playerId) return null;
      try {
        const body: AnswerQuestionRequest = {
          questionId,
          answerIndex,
          timeSpentMs
        };

        const res = await fetch(apiUrl(`/api/games/${gameId}/answer`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-player-id': playerId
          },
          body: JSON.stringify(body)
        });

        if (res.ok) {
          const data = (await res.json()) as { result: QuestionResult; state: GameStateSync };
          setLastResult(data.result);
          setGameState(data.state);
          return data.result;
        }
        return null;
      } catch {
        return null;
      }
    },
    [gameId, playerId]
  );

  // Crown Choice Action
  const chooseCrown = useCallback(
    async (action: 'claim' | 'steal', category: Category, wagerCategory?: Category): Promise<boolean> => {
      if (!gameId || !playerId) return false;
      try {
        const body: CrownChoiceRequest = {
          action,
          category,
          wagerCategory
        };

        const res = await fetch(apiUrl(`/api/games/${gameId}/crown`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-player-id': playerId
          },
          body: JSON.stringify(body)
        });

        if (res.ok) {
          const fresh = (await res.json()) as GameStateSync;
          setGameState(fresh);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [gameId, playerId]
  );

  // Resign Action
  const resign = useCallback(async (): Promise<void> => {
    if (!gameId || !playerId) return;
    try {
      const res = await fetch(apiUrl(`/api/games/${gameId}/resign`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-id': playerId
        }
      });
      if (res.ok) {
        const fresh = (await res.json()) as GameStateSync;
        setGameState(fresh);
      }
    } catch {
      // Ignore
    }
  }, [gameId, playerId]);

  return {
    gameState,
    isConnected,
    loading,
    error,
    targetDegrees,
    lastSpinSlice,
    lastResult,
    spin,
    answer,
    chooseCrown,
    resign,
    refresh
  };
}
