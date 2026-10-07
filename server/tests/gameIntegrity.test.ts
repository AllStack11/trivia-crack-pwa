import { beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { createBunDatabase, createD1Database, SCHEMA_SQL, type AppDatabase } from '../src/db/database';
import { answerQuestion, chooseCrown, createGame, getGameStateSync, resignGame, spinWheel } from '../src/services/gameEngine';
import { getRandomQuestion } from '../src/services/packService';
import { memoryCache } from '../src/services/questionCache';
import { CURATED_QUESTIONS } from '../src/services/curatedQuestions';
import { register, logout } from '../src/services/authService';
import { app } from '../src/index';
import { asD1 } from './helpers/d1';
import { QUESTION_DURATION_MS, QUESTION_ANSWER_GRACE_MS } from '../../shared/src/index';

describe('game integrity through the D1 adapter', () => {
  let storage: AppDatabase;
  let db: AppDatabase;
  let gameId: string;
  let p1: Awaited<ReturnType<typeof register>>;
  let p2: Awaited<ReturnType<typeof register>>;

  beforeEach(async () => {
    storage = await createBunDatabase(':memory:');
    await storage.exec(SCHEMA_SQL);
    db = createD1Database(asD1(storage));
    p1 = await register(db, { username: 'Alice' });
    p2 = await register(db, { username: 'Bob' });
    gameId = (await createGame(db, p1.account.id, p2.account.id)).gameId;
  });

  const question = async (options: { id?: string; startedAt?: number; crown?: boolean } = {}) => {
    const stored = {
      questionData: { id: options.id || 'integrity-q', packId: 'default', category: 'ART', question: 'A question?', correctAnswer: 'Yes', incorrectAnswers: ['No', 'Maybe', 'Never'], difficulty: 'easy' },
      shuffledOptions: ['Yes', 'No', 'Maybe', 'Never'], correctIndex: 0,
      startedAt: options.startedAt ?? Date.now(), durationMs: QUESTION_DURATION_MS,
      isCrown: options.crown || false, crownCategory: options.crown ? 'ART' : undefined
    };
    await db.execute("UPDATE games SET active_mode = 'QUESTION', active_question_json = ? WHERE id = ?", [JSON.stringify(stored), gameId]);
    return stored;
  };

  test('an expired correct answer is incorrect even when the client reports zero elapsed time', async () => {
    const q = await question({ startedAt: Date.now() - 3600000 });
    const result = await answerQuestion(db, gameId, p1.account.id, q.questionData.id, 0, 0);
    expect(result.wasCorrect).toBe(false);
    expect(result.nextPlayerId).toBe(p2.account.id);
    expect((await getGameStateSync(db, gameId))?.players.p1.score).toBe(0);
  });

  test('reading a match resolves an expired question without an answer from the disconnected player', async () => {
    await db.execute('UPDATE games SET crown_gauge = 2 WHERE id = ?', [gameId]);
    await question({ startedAt: Date.now() - QUESTION_DURATION_MS - QUESTION_ANSWER_GRACE_MS - 1000 });
    const state = await getGameStateSync(db, gameId);
    expect(state?.mode).toBe('SPIN');
    expect(state?.currentTurnPlayerId).toBe(p2.account.id);
    expect(state?.players.p1.crownGauge).toBe(2);
    expect(state?.players.p2?.crownGauge).toBe(0);
    expect(state?.revision).toBe(1);
    expect((await getGameStateSync(db, gameId))?.revision).toBe(1);
  });

  test('a failed final state update rolls back answer claims, scores and crowns and allows retry', async () => {
    await question({ crown: true });
    await storage.exec("CREATE TRIGGER fail_answer BEFORE UPDATE OF active_mode ON games WHEN NEW.active_mode = 'SPIN' BEGIN SELECT RAISE(ABORT, 'Injected failure'); END;");
    await expect(answerQuestion(db, gameId, p1.account.id, 'integrity-q', 0, 100)).rejects.toThrow('Injected failure');
    expect(await db.query('SELECT * FROM game_answers')).toHaveLength(0);
    expect(await db.query('SELECT * FROM game_answer_claims')).toHaveLength(0);
    expect(await db.query('SELECT * FROM game_crowns')).toHaveLength(0);
    expect(await db.query('SELECT * FROM game_mutation_guards')).toHaveLength(0);
    expect((await getGameStateSync(db, gameId))?.mode).toBe('QUESTION');
    await storage.exec('DROP TRIGGER fail_answer');
    expect((await answerQuestion(db, gameId, p1.account.id, 'integrity-q', 0, 100)).awardedCrown).toBe('ART');
    expect((await getGameStateSync(db, gameId))?.players.p1.score).toBe(1);
  });

  test('invalid answer indices leave the question and all writes unchanged', async () => {
    await question();
    for (const index of [-2, 4, 0.5, NaN]) {
      await expect(answerQuestion(db, gameId, p1.account.id, 'integrity-q', index, 0)).rejects.toThrow();
    }
    const state = await getGameStateSync(db, gameId);
    expect(state?.revision).toBe(0);
    expect(state?.mode).toBe('QUESTION');
    expect(state?.players.p1.score).toBe(0);
    expect(await db.query('SELECT * FROM game_answers')).toHaveLength(0);
    expect(await db.query('SELECT * FROM game_answer_claims')).toHaveLength(0);
    expect(await db.query('SELECT * FROM game_mutation_guards')).toHaveLength(0);
  });

  test('a paused answer cannot overwrite a committed resignation', async () => {
    await question();
    let release!: () => void;
    let arrived!: () => void;
    const ready = new Promise<void>((resolve) => { arrived = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const paused: AppDatabase = { ...db, batch: async (statements) => { arrived(); await gate; await db.batch(statements); } };
    const pending = answerQuestion(paused, gameId, p1.account.id, 'integrity-q', 0, 100).then(
      () => ({ error: '' }), (error: Error) => ({ error: error.message })
    );
    await ready;
    await resignGame(db, gameId, p2.account.id);
    release();
    expect((await pending).error).toContain('Game changed');
    const state = await getGameStateSync(db, gameId);
    expect(state?.status).toBe('COMPLETED');
    expect(state?.winnerId).toBe(p1.account.id);
    expect(state?.players.p1.score).toBe(0);
  });

  test('concurrent spins and crown choices each commit only one transition', async () => {
    const spins = await Promise.allSettled([spinWheel(db, gameId, p1.account.id), spinWheel(db, gameId, p1.account.id)]);
    expect(spins.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await getGameStateSync(db, gameId))?.revision).toBe(1);
    await db.execute("UPDATE games SET active_mode = 'CROWN_CHOICE', active_question_json = NULL WHERE id = ?", [gameId]);
    const crowns = await Promise.allSettled([
      chooseCrown(db, gameId, p1.account.id, 'claim', 'ART'),
      chooseCrown(db, gameId, p1.account.id, 'claim', 'SCIENCE')
    ]);
    expect(crowns.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await getGameStateSync(db, gameId))?.revision).toBe(2);
  });

  test('exhausted offline fallback questions remain answerable on repeated occurrences', async () => {
    const savedFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error('Offline'))) as typeof fetch;
    memoryCache.clear();
    try {
      const excluded = CURATED_QUESTIONS.map((q) => q.id);
      const first = await getRandomQuestion(db, ['default'], 'ART', excluded);
      const second = await getRandomQuestion(db, ['default'], 'ART', [...excluded, first.id]);
      expect(excluded).not.toContain(first.id);
      expect(second.id).not.toBe(first.id);
      await question({ id: first.id });
      expect((await answerQuestion(db, gameId, p1.account.id, first.id, 0, 100)).wasCorrect).toBe(true);
      await question({ id: second.id });
      expect((await answerQuestion(db, gameId, p1.account.id, second.id, 0, 100)).wasCorrect).toBe(true);
      expect((await getGameStateSync(db, gameId))?.players.p1.score).toBe(2);
    } finally { globalThis.fetch = savedFetch; memoryCache.clear(); }
  });

  test('SSE requires a bearer header and query credentials are never logged', async () => {
    const logger = spyOn(console, 'log').mockImplementation(() => {});
    try {
      const res = await app.request('/api/games/' + gameId + '/events?session=' + p1.token, {}, { DB: asD1(storage) });
      expect(res.status).toBe(401);
      expect(JSON.stringify(logger.mock.calls)).not.toContain(p1.token);
    } finally { logger.mockRestore(); }
  });

  test('an SSE request observes writes made through another database binding', async () => {
    const res = await app.request('/api/games/' + gameId + '/events', { headers: { Authorization: 'Bearer ' + p2.token } }, { DB: asD1(storage) });
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    try {
      const first = new TextDecoder().decode((await reader.read()).value);
      expect(first).toContain('"revision":0');
      await resignGame(createD1Database(asD1(storage)), gameId, p1.account.id);
      const next = new TextDecoder().decode((await reader.read()).value);
      expect(next).toContain('"revision":1');
      expect(next).toContain('"status":"COMPLETED"');
    } finally { await reader.cancel(); }
  });

  test('a revoked session cannot open another SSE stream', async () => {
    await logout(db, p1.token);
    const res = await app.request('/api/games/' + gameId + '/events', { headers: { Authorization: 'Bearer ' + p1.token } }, { DB: asD1(storage) });
    expect(res.status).toBe(401);
  });
});
