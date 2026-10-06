import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { streamSSE } from 'hono/streaming';
import {
  CATEGORIES,
  QUESTION_ANSWER_GRACE_MS,
  type AnswerQuestionRequest,
  type Category,
  type CrownChoiceRequest,
  type ExpandPackRequest,
  type GameStateSync,
  type QuestionPackExport,
  type PushTestResponse,
  type SpinResponse
} from '../../shared/src/index';
import type { CloudflareD1Database } from './db/database';
import { getDatabase } from './db/database';
import { queryBudget } from './db/queryBudget';
import {
  answerQuestion,
  chooseCrown,
  getGameStateSync,
  GameSnapshotConflictError,
  resignGame,
  spinWheel
} from './services/gameEngine';
import { digest, getSession, listDirectory, listPlayers, login, logout, register, RegistrationError } from './services/authService';
import { isGameParticipant, listInvitations, listMatches, respondToInvitation, sendInvitation } from './services/invitationService';
import { drainPushOutbox, enqueueTest, hasSubscription, pushConfigured, removeSubscription, saveSubscription, type PushEnvironment } from './services/pushService';
import type { PushSubscriptionRequest } from '../../shared/src/index';
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
} & PushEnvironment;

export const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS and logging
app.use('*', cors({ allowHeaders: ['Content-Type', 'Authorization'] }));
app.use('*', async (c, next) => {
  // Query strings and Authorization headers can contain credentials.
  console.log(c.req.method, new URL(c.req.url).pathname);
  await next();
  if (c.req.method !== 'GET' && pushConfigured(c.env || {})) {
    // Only Workers has an execution context. Bun uses its bounded background timer.
    try {
      c.executionCtx.waitUntil(getDatabase(c.env).then(db => drainPushOutbox(db, c.env)).catch(() => console.warn('Push delivery deferred')));
    } catch { /* Bun/test request has no execution context. */ }
  }
});

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
function sessionToken(c: Context<{ Bindings: Bindings }>): string | undefined {
  const authorization = c.req.header('Authorization');
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7);
  return undefined;
}

async function authenticated(c: Context<{ Bindings: Bindings }>) {
  const db = await getDatabase(c.env);
  const token = sessionToken(c);
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

app.get('/api/push/config', async (c) => {
  const { account } = await authenticated(c);
  if (!account) return c.json({ error: 'Authentication required' }, 401);
  const available = pushConfigured(c.env || {});
  return c.json({ available, publicKey: available ? c.env.VAPID_PUBLIC_KEY! : null });
});

app.use('/api/push/*', bodyLimit({ maxSize: 4096, onError: c => c.json({ error: 'Subscription too large' }, 413) }));

app.get('/api/push/subscription', async (c) => {
  const { db, token, account } = await authenticated(c);
  if (!account || !token) return c.json({ error: 'Authentication required' }, 401);
  return c.json({ subscribed: await hasSubscription(db, account.id, token) });
});

app.post('/api/push/subscription', async (c) => {
  const { db, token, account } = await authenticated(c);
  if (!account || !token) return c.json({ error: 'Authentication required' }, 401);
  if (!pushConfigured(c.env || {})) return c.json({ error: 'Notifications are not configured yet' }, 503);
  try {
    if (Number(c.req.header('Content-Length')) > 4096) return c.json({ error: 'Subscription too large' }, 413);
    const body = await c.req.text();
    if (body.length > 4096) return c.json({ error: 'Subscription too large' }, 413);
    await saveSubscription(db, account.id, token, JSON.parse(body) as PushSubscriptionRequest);
    return c.json({ ok: true });
  } catch { return c.json({ error: 'Invalid or unsupported notification subscription' }, 400); }
});

app.delete('/api/push/subscription', async (c) => {
  const { db, token, account } = await authenticated(c);
  if (!account || !token) return c.json({ error: 'Authentication required' }, 401);
  await removeSubscription(db, account.id, token);
  return c.json({ ok: true });
});

app.post('/api/push/test', async (c) => {
  const { db, token, account } = await authenticated(c);
  if (!account || !token) return c.json({ error: 'Authentication required' }, 401);
  if (!pushConfigured(c.env || {})) return c.json({ error: 'Notifications are not configured yet' }, 503);
  if (!await hasSubscription(db, account.id, token)) return c.json({ error: 'Enable notifications on this device first' }, 409);
  const eventKey = await enqueueTest(db, account.id, token);
  const report = await drainPushOutbox(db, c.env, undefined, Date.now(), { userId: account.id, sessionHash: await digest(token), eventKey });
  const outcome: PushTestResponse['outcome'] = report.unsubscribed ? 'unsubscribed' : report.rejected ? 'rejected' : report.retrying ? 'retrying' : report.accepted ? 'accepted' : 'queued';
  return c.json({ outcome } satisfies PushTestResponse, outcome === 'accepted' ? 200 : 202);
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
  c.header('Cache-Control', 'no-store');
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
      (body.questions || []).map((question) => ({ ...question, difficulty: question.difficulty || 'medium' }))
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
// SERVER-SENT EVENTS (SSE) FROM COMMITTED DATABASE STATE
// -------------------------------------------------------------
app.get('/api/games/:gameId/events', async (c) => {
  const events = (callback: Parameters<typeof streamSSE>[1]) => {
    const response = streamSSE(c, callback);
    // Hono's SSE helper defaults to no-cache, which still permits storage.
    c.header('Cache-Control', 'no-store');
    response.headers.set('Cache-Control', 'no-store');
    return response;
  };
  const budget = queryBudget(await getDatabase(c.env));
  const db = budget.db;
  const token = sessionToken(c);
  const account = await getSession(db, token);
  if (!account) return c.text('Authentication required', 401);
  const gameId = c.req.param('gameId');
  if (!(await isGameParticipant(db, gameId, account.id))) return c.text('Game not found', 404);
  // One coherent read costs at most eight statements. Expiry mutations are
  // delegated to a fresh REST request, never started inside a depleted stream.
  const snapshot = () => getGameStateSync(db, gameId, { attempts: 1, resolveExpired: false });
  c.header('Cache-Control', 'no-store');
  let initial: GameStateSync | null;
  try { initial = await snapshot(); }
  catch (error) {
    if (!(error instanceof GameSnapshotConflictError)) throw error;
    return events(async stream => { await stream.writeSSE({ event: 'reconnect', data: '{"refresh":true}' }); });
  }
  if (!initial) return c.text('Game not found', 404);
  return events(async (stream) => {
    let revision = initial.revision;
    let lastAuthCheck = Date.now();
    const started = Date.now();
    const rotate = async (refresh = false) => { await stream.writeSSE({ event: 'reconnect', data: JSON.stringify({ refresh }) }); };
    await stream.writeSSE({ data: JSON.stringify(initial), event: 'sync', id: String(revision) });
    if (initial.status === 'COMPLETED') return;
    if (initial.activeQuestion && Date.now() > initial.activeQuestion.startedAt + initial.activeQuestion.durationMs + QUESTION_ANSWER_GRACE_MS) { await rotate(true); return; }
    // All stream I/O remains in its originating request. No isolate-local subscriber map.
    while (!stream.aborted) {
      await stream.sleep(1000);
      if (stream.aborted) break;
      // Reserve auth (including expired-session deletion), membership, poll,
      // and one entire snapshot before starting a loop iteration.
      if (!budget.fits(12) || Date.now() - started >= 20000) { await rotate(); return; }
      if (Date.now() - lastAuthCheck >= 15000) {
        if (!(await getSession(db, token)) || !(await isGameParticipant(db, gameId, account.id))) {
          await stream.writeSSE({ data: '{}', event: 'unauthorized' });
          return;
        }
        await stream.writeSSE({ data: '{}', event: 'ping' });
        lastAuthCheck = Date.now();
      }
      const row = await db.queryFirst<{ revision: number; active_question_json: string | null }>(
        'SELECT revision, active_question_json FROM games WHERE id = ?', [gameId]
      );
      if (!row) { await stream.writeSSE({ event: 'not-found', data: '{}' }); return; }
      const question = row.active_question_json ? JSON.parse(row.active_question_json) as { startedAt: number; durationMs: number } : null;
      const expired = question && Date.now() > question.startedAt + question.durationMs + QUESTION_ANSWER_GRACE_MS;
      if (expired) { await rotate(true); return; }
      if (row.revision === revision && !expired) continue;
      let state: GameStateSync | null;
      try { state = await snapshot(); }
      catch (error) {
        if (!(error instanceof GameSnapshotConflictError)) throw error;
        await rotate(true); return;
      }
      if (!state) return;
      if (state.revision !== revision) {
        await stream.writeSSE({ data: JSON.stringify(state), event: 'sync', id: String(state.revision) });
        revision = state.revision;
      }
      if (state.status === 'COMPLETED') return;
    }
  });
});

export default app;
