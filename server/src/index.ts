import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { streamSSE } from 'hono/streaming';
import {
  CATEGORIES,
  type AnswerQuestionRequest,
  type Category,
  type CrownChoiceRequest,
  type ExpandPackRequest,
  type GameStateSync,
  type QuestionPackExport,
  type SpinResponse
} from '../../shared/src/index';
import type { CloudflareD1Database } from './db/database';
import { getDatabase } from './db/database';
import {
  answerQuestion,
  chooseCrown,
  getGameStateSync,
  resignGame,
  spinWheel
} from './services/gameEngine';
import { getSession, listDirectory, listPlayers, login, logout, register, RegistrationError } from './services/authService';
import { isGameParticipant, listInvitations, listMatches, respondToInvitation, sendInvitation } from './services/invitationService';
import {
  createPack,
  deletePack,
  expandPack,
  exportPack,
  fetchLiveQuestions,
  getPack,
  importPack,
  listPacks
} from './services/packService';
import {
  countDbCachedQuestionsByCategory,
  memoryCache
} from './services/questionCache';
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
app.use('*', cors({ allowHeaders: ['Content-Type', 'Authorization'] }));
app.use('*', logger());

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// Account authentication and identity.
app.get('/api/auth/directory', async (c) => {
  const db = await getDatabase(c.env);
  return c.json({ players: await listDirectory(db) });
});

app.post('/api/auth/register', async (c) => {
  try {
    const body = await c.req.json();
    return c.json(await register(await getDatabase(c.env), body), 201);
  } catch (error) {
    console.error('Registration failed:', error);
    if (error instanceof RegistrationError) return c.json({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return c.json({ error: 'Invalid JSON body' }, 400);
    return c.json({ error: 'Registration failed' }, 500);
  }
});

app.post('/api/auth/login', async (c) => {
  try {
    const body = await c.req.json<{ username?: string; email?: string; pin?: string; password?: string }>();
    const identifier = body?.username || body?.email || '';
    const secret = body?.pin || body?.password || undefined;
    return c.json(await login(await getDatabase(c.env), identifier, secret));
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Login failed' }, 401);
  }
});
function sessionToken(c: Context<{ Bindings: Bindings }>, allowQuery = false): string | undefined {
  const authorization = c.req.header('Authorization');
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7);
  return allowQuery ? c.req.query('session') : undefined;
}

async function authenticated(c: Context<{ Bindings: Bindings }>, allowQuery = false) {
  const db = await getDatabase(c.env);
  const token = sessionToken(c, allowQuery);
  const account = await getSession(db, token);
  return { db, token, account };
}

app.post('/api/auth/logout', async (c) => {
  const { db, token } = await authenticated(c);
  await logout(db, token);
  return c.json({ ok: true });
});

app.get('/api/me', async (c) => {
  const { account } = await authenticated(c);
  return account ? c.json({ account }) : c.json({ error: 'Authentication required' }, 401);
});

app.get('/api/players', async (c) => {
  const { db, account } = await authenticated(c);
  if (!account) return c.json({ error: 'Authentication required' }, 401);
  return c.json({ players: await listPlayers(db, account.id) });
});

app.get('/api/invitations', async (c) => {
  const { db, account } = await authenticated(c);
  if (!account) return c.json({ error: 'Authentication required' }, 401);
  return c.json({ invitations: await listInvitations(db, account.id) });
});

app.post('/api/invitations', async (c) => {
  const { db, account } = await authenticated(c);
  if (!account) return c.json({ error: 'Authentication required' }, 401);
  try {
    const body = await c.req.json<{ recipientId: string; packIds?: string[] }>();
    await sendInvitation(db, account.id, body.recipientId, body.packIds);
    return c.json({ ok: true }, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Could not send invitation' }, 400);
  }
});

app.post('/api/invitations/:invitationId/respond', async (c) => {
  const { db, account } = await authenticated(c);
  if (!account) return c.json({ error: 'Authentication required' }, 401);
  try {
    const body = await c.req.json<{ decision: 'accept' | 'decline' }>();
    if (body.decision !== 'accept' && body.decision !== 'decline') throw new Error('Invalid invitation decision');
    const result = await respondToInvitation(db, c.req.param('invitationId'), account.id, body.decision);
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Could not respond to invitation' }, 400);
  }
});

app.get('/api/games', async (c) => {
  const { db, account } = await authenticated(c);
  if (!account) return c.json({ error: 'Authentication required' }, 401);
  return c.json({ matches: await listMatches(db, account.id) });
});

app.get('/api/games/:gameId', async (c) => {
  const { db, account } = await authenticated(c);
  if (!account) return c.json({ error: 'Authentication required' }, 401);
  const gameId = c.req.param('gameId');
  if (!(await isGameParticipant(db, gameId, account.id))) return c.json({ error: 'Game not found' }, 404);
  const state = await getGameStateSync(db, gameId);
  return state ? c.json(state) : c.json({ error: 'Game not found' }, 404);
});

app.post('/api/games/:gameId/spin', async (c) => {
  const { db, account } = await authenticated(c);
  if (!account) return c.json({ error: 'Authentication required' }, 401);
  const gameId = c.req.param('gameId');
  if (!(await isGameParticipant(db, gameId, account.id))) return c.json({ error: 'Game not found' }, 404);
  try {
    const { sliceIndex, slice, targetDegrees } = await spinWheel(db, gameId, account.id);
    const state = await getGameStateSync(db, gameId);
    if (!state) return c.json({ error: 'Failed to fetch updated state' }, 500);
    broadcastGameState(gameId, state);
    const response: SpinResponse = { sliceIndex, slice, targetDegrees, state };
    return c.json(response);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Spin failed' }, 400);
  }
});

app.post('/api/games/:gameId/answer', async (c) => {
  const { db, account } = await authenticated(c);
  if (!account) return c.json({ error: 'Authentication required' }, 401);
  const gameId = c.req.param('gameId');
  if (!(await isGameParticipant(db, gameId, account.id))) return c.json({ error: 'Game not found' }, 404);
  let body: AnswerQuestionRequest;
  try {
    body = await c.req.json<AnswerQuestionRequest>();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }
  try {
    const result = await answerQuestion(db, gameId, account.id, body.questionId, body.answerIndex, body.timeSpentMs || 0);
    const state = await getGameStateSync(db, gameId);
    if (state) broadcastGameState(gameId, state);
    return c.json({ result, state });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Answer failed' }, 400);
  }
});

app.post('/api/games/:gameId/crown', async (c) => {
  const { db, account } = await authenticated(c);
  if (!account) return c.json({ error: 'Authentication required' }, 401);
  const gameId = c.req.param('gameId');
  if (!(await isGameParticipant(db, gameId, account.id))) return c.json({ error: 'Game not found' }, 404);
  let body: CrownChoiceRequest;
  try {
    body = await c.req.json<CrownChoiceRequest>();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }
  try {
    await chooseCrown(db, gameId, account.id, body.action, body.category, body.wagerCategory);
    const state = await getGameStateSync(db, gameId);
    if (!state) return c.json({ error: 'Failed to retrieve state' }, 500);
    broadcastGameState(gameId, state);
    return c.json(state);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Crown choice failed' }, 400);
  }
});

app.post('/api/games/:gameId/resign', async (c) => {
  const { db, account } = await authenticated(c);
  if (!account) return c.json({ error: 'Authentication required' }, 401);
  const gameId = c.req.param('gameId');
  if (!(await isGameParticipant(db, gameId, account.id))) return c.json({ error: 'Game not found' }, 404);
  try {
    await resignGame(db, gameId, account.id);
    const state = await getGameStateSync(db, gameId);
    if (state) broadcastGameState(gameId, state);
    return c.json(state);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Resignation failed' }, 400);
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

// Expand Pack with Free Trivia APIs
app.post('/api/packs/:packId/expand', async (c) => {
  const db = await getDatabase(c.env);
  const packId = c.req.param('packId');
  const pack = await getPack(db, packId);
  if (!pack) {
    return c.json({ error: 'Pack not found' }, 404);
  }

  let body: ExpandPackRequest = {};
  try {
    body = (await c.req.json<ExpandPackRequest>().catch(() => ({}))) || {};
  } catch {
    body = {};
  }

  const countPerCategory = Math.min(Math.max(body.countPerCategory || 5, 1), 20);
  const validCategories: Category[] = (body.categories || []).filter((cat): cat is Category =>
    Object.hasOwn(CATEGORIES, cat)
  );

  const forceRefresh = body.forceRefresh === true || c.req.query('refresh') === 'true';

  const result = await expandPack(
    db,
    packId,
    countPerCategory,
    validCategories.length > 0 ? validCategories : undefined,
    forceRefresh
  );

  return c.json(result);
});

// Live Question Fetching from Free Trivia APIs with Multi-Tier Caching
app.get('/api/questions/fetch', async (c) => {
  const db = await getDatabase(c.env);
  const categoryParam = c.req.query('category')?.toUpperCase() as Category;
  const category: Category = Object.hasOwn(CATEGORIES, categoryParam)
    ? categoryParam
    : (['ART', 'SCIENCE', 'SPORTS', 'ENTERTAINMENT', 'GEOGRAPHY', 'HISTORY'][Math.floor(Math.random() * 6)] as Category);

  const rawAmount = parseInt(c.req.query('amount') || '5', 10);
  const amount = Number.isFinite(rawAmount) ? Math.min(Math.max(rawAmount, 1), 20) : 5;
  const packId = c.req.query('packId') || 'default';
  const refresh = c.req.query('refresh') === 'true';

  const result = await fetchLiveQuestions(category, amount, packId, db, refresh);
  const isHit = result.provider === 'cache:memory' || result.provider === 'cache:db';

  c.header('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
  c.header('X-Cache-Status', isHit ? 'HIT' : 'MISS');

  return c.json({
    questions: result.questions,
    provider: result.provider,
    cached: isHit
  });
});

// Question Cache Monitoring & Statistics
app.get('/api/questions/cache/stats', async (c) => {
  const db = await getDatabase(c.env);
  const memStats = memoryCache.getStats();
  const dbCounts = await countDbCachedQuestionsByCategory(db);

  return c.json({
    inMemory: memStats.inMemoryCounts,
    db: dbCounts,
    hits: memStats.hits,
    misses: memStats.misses,
    hitRate: memStats.hitRate
  });
});

// Invalidate In-Memory Question Cache
app.post('/api/questions/cache/clear', async (c) => {
  memoryCache.clear();
  return c.json({ cleared: true });
});

// -------------------------------------------------------------
// SERVER-SENT EVENTS (SSE) MULTIPLAYER BROADCAST
// -------------------------------------------------------------
app.get('/api/games/:gameId/events', async (c) => {
  const { db, account } = await authenticated(c, true);
  if (!account) return c.text('Authentication required', 401);
  const gameId = c.req.param('gameId');
  if (!(await isGameParticipant(db, gameId, account.id))) return c.text('Game not found', 404);
  const initial = await getGameStateSync(db, gameId);
  if (!initial) return c.text('Game not found', 404);
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
