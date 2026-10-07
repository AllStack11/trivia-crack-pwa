import { test, expect } from 'bun:test';
import { createBunDatabase, createD1Database, SCHEMA_SQL } from '../src/db/database';
import { asD1 } from './helpers/d1';
import { ingestQuestions } from '../src/services/questionIngestion';
import { getRandomQuestion } from '../src/services/packService';
import app from '../src/index';
import { fetchFromOpenTdb, fetchFromTriviaApiV2, fetchTriviaQuestionsWithFallback } from '../src/services/triviaApiService';

test('concurrent opens share one refill, bank grows permanently, and repeated content is deduplicated', async () => {
  const storage = await createBunDatabase(':memory:');
  await storage.exec(SCHEMA_SQL);
  const binding = asD1(storage);
  const db = createD1Database(binding);
  const savedFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async input => {
    calls++;
    const url = new URL(String(input));
    const category = url.searchParams.get('categories') || url.searchParams.get('category');
    if (url.hostname === 'opentdb.com' && !['9', '15'].includes(category || '')) return Response.json({ response_code: 0, results: [] });
    if (url.hostname !== 'opentdb.com' && url.pathname !== '/v2/questions') return Response.json([]);
    const questions = Array.from({ length: 10 }, (_, i) => ({
      question: `Fresh ${category === '9' ? 'internet meme' : category} question ${i}?`,
      correct_answer: 'Yes', incorrect_answers: ['No', 'Maybe', 'Never'], difficulty: 'easy',
    }));
    return url.hostname === 'opentdb.com'
      ? Response.json({ response_code: 0, results: questions })
      : Response.json(questions.map(q => ({ question: { text: q.question }, correctAnswer: q.correct_answer, incorrectAnswers: q.incorrect_answers, difficulty: q.difficulty })));

  }) as typeof fetch;
  try {
    await Promise.all([ingestQuestions(db), ingestQuestions(createD1Database(binding))]);
    expect(calls).toBe(9);
    expect(await db.queryFirst('SELECT COUNT(*) AS count FROM questions')).toEqual({ count: 279 });
    expect(await db.queryFirst('SELECT last_added FROM question_ingestion')).toEqual({ last_added: 90 });
    for (const category of ['MEMES', 'MOVIES_TV', 'VIDEO_GAMES']) {
      expect(await db.queryFirst("SELECT COUNT(*) AS count FROM questions WHERE category = ? AND id LIKE 'bank_%'", [category])).toEqual({ count: 10 });
    }
    expect(await db.queryFirst("SELECT COUNT(*) AS count FROM questions WHERE category = 'CUSTOM'")).toEqual({ count: 0 });
    await ingestQuestions(db);
    expect(calls).toBe(9);
    const curated = await db.query<{ id: string }>("SELECT id FROM questions WHERE id NOT LIKE 'bank_%'");
    expect((await getRandomQuestion(db, ['default'], 'SCIENCE', curated.map(q => q.id))).id).toStartWith('bank_');
    expect(calls).toBe(9); // Turn selection never requests an external provider.
    await db.execute('UPDATE question_ingestion SET next_allowed_at = 0');
    const refreshTasks: Promise<unknown>[] = [];
    const refresh = await app.request('/api/questions/refresh', { method: 'POST' }, { DB: binding }, {
      waitUntil: task => { refreshTasks.push(task); }, passThroughOnException() {},
    } as ExecutionContext);
    expect(refresh.status).toBe(202);
    await Promise.all(refreshTasks);
    expect(await db.queryFirst('SELECT COUNT(*) AS count FROM questions')).toEqual({ count: 279 });
  } finally { globalThis.fetch = savedFetch; }
});

test('refresh returns immediately, Workers retains the task, and provider failure preserves playable questions', async () => {
  const db = await createBunDatabase(':memory:');
  await db.exec(SCHEMA_SQL);
  const savedFetch = globalThis.fetch;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  globalThis.fetch = (async () => { await gate; throw new Error('Offline'); }) as typeof fetch;
  const tasks: Promise<unknown>[] = [];
  try {
    const response = await app.request('/api/questions/refresh', { method: 'POST' }, { DB: asD1(db) }, {
      waitUntil: task => { tasks.push(task); }, passThroughOnException() {},
    } as ExecutionContext);
    expect(response.status).toBe(202);
    expect(tasks.length).toBe(1);
    release();
    await Promise.all(tasks);
    expect(await db.queryFirst('SELECT COUNT(*) AS count FROM questions')).toEqual({ count: 189 });
    expect(await db.queryFirst('SELECT last_added FROM question_ingestion')).toEqual({ last_added: 0 });
  } finally { release(); globalThis.fetch = savedFetch; }
});

test('provider mappings isolate movies and games, filter unrelated meme content, and never refill Custom', async () => {
  const savedFetch = globalThis.fetch;
  const requested: URL[] = [];
  globalThis.fetch = (async input => {
    const url = new URL(String(input)); requested.push(url);
    if (url.hostname === 'the-trivia-api.com') return Response.json([]);
    return Response.json({ response_code: 0, results: [
      { question: 'Which internet meme features Doge?', correct_answer: 'Doge', incorrect_answers: ['A', 'B', 'C'] },
      { question: 'What is the capital of France?', correct_answer: 'Paris', incorrect_answers: ['Lyon', 'Nice', 'Rome'] },
    ] });
  }) as typeof fetch;
  try {
    await fetchFromTriviaApiV2('MOVIES_TV', 10);
    expect(requested.at(-1)?.searchParams.get('categories')).toBe('film_and_tv');
    await fetchFromOpenTdb('MOVIES_TV', 10);
    expect(['11', '14']).toContain(requested.at(-1)!.searchParams.get('category'));
    await fetchFromOpenTdb('VIDEO_GAMES', 10);
    expect(requested.at(-1)?.searchParams.get('category')).toBe('15');
    const memes = await fetchFromOpenTdb('MEMES', 10);
    expect(requested.at(-1)?.searchParams.get('category')).toBe('9');
    expect(requested.at(-1)?.searchParams.get('amount')).toBe('50');
    expect(memes.length).toBe(1); expect(memes[0].category).toBe('MEMES');
    const callsBeforeCustom = requested.length;
    const custom = await fetchTriviaQuestionsWithFallback({ category: 'CUSTOM', forceRefresh: true });
    expect(custom.questions).toEqual([]); expect(requested.length).toBe(callsBeforeCustom);
  } finally { globalThis.fetch = savedFetch; }
});
