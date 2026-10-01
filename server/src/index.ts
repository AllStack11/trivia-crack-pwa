import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { streamSSE } from 'hono/streaming';
import type {
  AnswerQuestionRequest,
  CreateGameRequest,
  CreateGameResponse,
  CrownChoiceRequest,
  GameStateSync,
  JoinGameRequest,
  JoinGameResponse,
  QuestionPackExport,
  SpinResponse
} from '../../shared/src/index';
import type { CloudflareD1Database } from './db/database';
import { getDatabase } from './db/database';
import {
  answerQuestion,
  chooseCrown,
  createGame,
  getGameStateSync,
  joinGame,
  resignGame,
  spinWheel
} from './services/gameEngine';
import {
  createPack,
  deletePack,
  exportPack,
  getPack,
  importPack,
  listPacks
} from './services/packService';

type Bindings = {
  DB?: CloudflareD1Database;
};

// Map of active SSE client stream write callbacks: gameId -> Set<writer>
type SseWriter = (data: string) => Promise<void>;
const gameSubscribers = new Map<string, Set<SseWriter>>();

export function broadcastGameState(gameId: string, state: GameStateSync): void {
  const subscribers = gameSubscribers.get(gameId);
  if (!subscribers || subscribers.size === 0) return;

  const payload = JSON.stringify(state);
  for (const writer of subscribers) {
    writer(payload).catch(() => {
      subscribers.delete(writer);
    });
  }
}

export const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS and logging
app.use('*', cors());
app.use('*', logger());

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// -------------------------------------------------------------
// GAME REST ENDPOINTS
// -------------------------------------------------------------

// Create Game
app.post('/api/games', async (c) => {
  const db = await getDatabase(c.env);
  let body: CreateGameRequest;
  try {
    body = await c.req.json<CreateGameRequest>();
  } catch {
    return c.json({ error: 'Invalid JSON request body' }, 400);
  }

  const { gameId, inviteCode, playerId, playerToken } = await createGame(
    db,
    body.username || 'Host',
    body.packIds || ['default']
  );

  const state = await getGameStateSync(db, gameId);
  if (!state) {
    return c.json({ error: 'Failed to create game state' }, 500);
  }

  const response: CreateGameResponse = {
    gameId,
    inviteCode,
    playerId,
    playerToken,
    state
  };

  return c.json(response, 201);
});

// Join Game
app.post('/api/games/:gameIdOrCode/join', async (c) => {
  const db = await getDatabase(c.env);
  const gameIdOrCode = c.req.param('gameIdOrCode');
  let body: JoinGameRequest;
  try {
    body = await c.req.json<JoinGameRequest>();
  } catch {
    body = { username: 'Challenger' };
  }

  try {
    const { gameId, playerId, playerToken } = await joinGame(
      db,
      gameIdOrCode,
      body.username || 'Challenger'
    );

    const state = await getGameStateSync(db, gameId);
    if (!state) {
      return c.json({ error: 'Failed to retrieve game state' }, 500);
    }

    broadcastGameState(gameId, state);

    const response: JoinGameResponse = {
      gameId,
      playerId,
      playerToken,
      state
    };

    return c.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to join game';
    return c.json({ error: message }, 400);
  }
});

// Get Game State
app.get('/api/games/:gameId', async (c) => {
  const db = await getDatabase(c.env);
  const gameId = c.req.param('gameId');

  const state = await getGameStateSync(db, gameId);
  if (!state) {
    return c.json({ error: 'Game not found' }, 404);
  }

  return c.json(state);
});

// Spin Wheel
app.post('/api/games/:gameId/spin', async (c) => {
  const db = await getDatabase(c.env);
  const gameId = c.req.param('gameId');
  const playerId = c.req.header('x-player-id') || c.req.query('token');

  if (!playerId) {
    return c.json({ error: 'Missing player authentication' }, 401);
  }

  try {
    const { sliceIndex, slice, targetDegrees } = await spinWheel(db, gameId, playerId);
    const state = await getGameStateSync(db, gameId);
    if (!state) {
      return c.json({ error: 'Failed to fetch updated state' }, 500);
    }

    broadcastGameState(gameId, state);

    const response: SpinResponse = {
      sliceIndex,
      slice,
      targetDegrees,
      state
    };

    return c.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Spin failed';
    return c.json({ error: message }, 400);
  }
});

// Submit Answer
app.post('/api/games/:gameId/answer', async (c) => {
  const db = await getDatabase(c.env);
  const gameId = c.req.param('gameId');
  const playerId = c.req.header('x-player-id') || c.req.query('token');

  if (!playerId) {
    return c.json({ error: 'Missing player authentication' }, 401);
  }

  let body: AnswerQuestionRequest;
  try {
    body = await c.req.json<AnswerQuestionRequest>();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  try {
    const result = await answerQuestion(
      db,
      gameId,
      playerId,
      body.questionId,
      body.answerIndex,
      body.timeSpentMs || 0
    );

    const state = await getGameStateSync(db, gameId);
    if (state) {
      broadcastGameState(gameId, state);
    }

    return c.json({ result, state });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Answer failed';
    return c.json({ error: message }, 400);
  }
});

// Choose Crown (Claim or Steal)
app.post('/api/games/:gameId/crown', async (c) => {
  const db = await getDatabase(c.env);
  const gameId = c.req.param('gameId');
  const playerId = c.req.header('x-player-id') || c.req.query('token');

  if (!playerId) {
    return c.json({ error: 'Missing player authentication' }, 401);
  }

  let body: CrownChoiceRequest;
  try {
    body = await c.req.json<CrownChoiceRequest>();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  try {
    await chooseCrown(
      db,
      gameId,
      playerId,
      body.action,
      body.category,
      body.wagerCategory
    );

    const state = await getGameStateSync(db, gameId);
    if (!state) {
      return c.json({ error: 'Failed to retrieve state' }, 500);
    }

    broadcastGameState(gameId, state);
    return c.json(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Crown choice failed';
    return c.json({ error: message }, 400);
  }
});

// Resign / Surrender
app.post('/api/games/:gameId/resign', async (c) => {
  const db = await getDatabase(c.env);
  const gameId = c.req.param('gameId');
  const playerId = c.req.header('x-player-id') || c.req.query('token');

  if (!playerId) {
    return c.json({ error: 'Missing player authentication' }, 401);
  }

  try {
    await resignGame(db, gameId, playerId);
    const state = await getGameStateSync(db, gameId);
    if (state) {
      broadcastGameState(gameId, state);
    }
    return c.json(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Resignation failed';
    return c.json({ error: message }, 400);
  }
});

// -------------------------------------------------------------
// QUESTION PACKS ENDPOINTS
// -------------------------------------------------------------

// List Packs
app.get('/api/packs', async (c) => {
  const db = await getDatabase(c.env);
  const packs = await listPacks(db);
  return c.json(packs);
});

// Get Single Pack
app.get('/api/packs/:packId', async (c) => {
  const db = await getDatabase(c.env);
  const packId = c.req.param('packId');
  const pack = await getPack(db, packId);
  if (!pack) {
    return c.json({ error: 'Pack not found' }, 404);
  }
  return c.json(pack);
});

// Create Pack
app.post('/api/packs', async (c) => {
  const db = await getDatabase(c.env);
  let body: QuestionPackExport;
  try {
    body = await c.req.json<QuestionPackExport>();
  } catch {
    return c.json({ error: 'Invalid JSON request body' }, 400);
  }

  try {
    const packId = await createPack(
      db,
      body.title,
      body.description,
      'User',
      body.questions || []
    );
    const pack = await getPack(db, packId);
    return c.json(pack, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create pack';
    return c.json({ error: message }, 400);
  }
});

// Delete Pack
app.delete('/api/packs/:packId', async (c) => {
  const db = await getDatabase(c.env);
  const packId = c.req.param('packId');

  const success = await deletePack(db, packId);
  if (!success) {
    return c.json({ error: 'Cannot delete pack (default pack is protected)' }, 400);
  }
  return c.json({ success: true });
});

// Export Pack JSON
app.get('/api/packs/:packId/export', async (c) => {
  const db = await getDatabase(c.env);
  const packId = c.req.param('packId');
  const exported = await exportPack(db, packId);
  if (!exported) {
    return c.json({ error: 'Pack not found' }, 404);
  }
  return c.json(exported);
});

// Import Pack JSON
app.post('/api/packs/import', async (c) => {
  const db = await getDatabase(c.env);
  let body: QuestionPackExport;
  try {
    body = await c.req.json<QuestionPackExport>();
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  try {
    const packId = await importPack(db, body, 'Imported');
    const pack = await getPack(db, packId);
    return c.json(pack, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to import pack';
    return c.json({ error: message }, 400);
  }
});

// -------------------------------------------------------------
// SERVER-SENT EVENTS (SSE) MULTIPLAYER BROADCAST
// -------------------------------------------------------------
app.get('/api/games/:gameId/events', async (c) => {
  const db = await getDatabase(c.env);
  const gameId = c.req.param('gameId');

  const initial = await getGameStateSync(db, gameId);
  if (!initial) {
    return c.text('Game not found', 404);
  }

  return streamSSE(c, async (stream) => {
    const writer: SseWriter = async (data: string) => {
      await stream.writeSSE({
        data,
        event: 'sync',
        id: String(Date.now())
      });
    };

    if (!gameSubscribers.has(gameId)) {
      gameSubscribers.set(gameId, new Set());
    }
    gameSubscribers.get(gameId)!.add(writer);

    // Send immediate state sync on connect
    await writer(JSON.stringify(initial));

    // Keep-alive ping interval to prevent Cloudflare Worker idle stream closure
    const pingInterval = setInterval(async () => {
      try {
        await stream.writeSSE({
          data: JSON.stringify({ ping: Date.now() }),
          event: 'ping'
        });
      } catch {
        clearInterval(pingInterval);
      }
    }, 15000);

    // Clean up when client disconnects
    stream.onAbort(() => {
      clearInterval(pingInterval);
      const subs = gameSubscribers.get(gameId);
      if (subs) {
        subs.delete(writer);
        if (subs.size === 0) {
          gameSubscribers.delete(gameId);
        }
      }
    });

    // Keep stream open while waiting for events
    while (!stream.aborted) {
      await stream.sleep(1000);
    }
  });
});

export default app;
