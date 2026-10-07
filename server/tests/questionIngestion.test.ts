import { test, expect } from 'bun:test';
import { createBunDatabase, createD1Database, SCHEMA_SQL } from '../src/db/database';
import { asD1 } from './helpers/d1';
import { ingestQuestions } from '../src/services/questionIngestion';
import { getRandomQuestion } from '../src/services/packService';
import app from '../src/index';

test('concurrent opens share one refill, bank grows permanently, and repeated content is deduplicated', async () => {
  const storage = await createBunDatabase(':memory:');
  await storage.exec(SCHEMA_SQL);
  const binding = asD1(storage);
  const db = createD1Database(binding);
  const savedFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async input => {
    calls++;
    const category = new URL(String(input)).searchParams.get('categories');
    return Response.json(Array.from({ length: 10 }, (_, i) => ({
      question: { text: `Fresh ${category} question ${i}?` },
      correctAnswer: 'Yes', incorrectAnswers: ['No', 'Maybe', 'Never'], difficulty: 'easy'
    })));
  }) as typeof fetch;
  try {
    await Promise.all([ingestQuestions(db), ingestQuestions(createD1Database(binding))]);
    expect(calls).toBe(6);
    expect(await db.queryFirst('SELECT COUNT(*) AS count FROM questions')).toEqual({ count: 240 });
    expect(await db.queryFirst('SELECT last_added FROM question_ingestion')).toEqual({ last_added: 60 });
    await ingestQuestions(db);
    expect(calls).toBe(6);
    const curated = await db.query<{ id: string }>("SELECT id FROM questions WHERE id NOT LIKE 'bank_%'");
    expect((await getRandomQuestion(db, ['default'], 'SCIENCE', curated.map(q => q.id))).id).toStartWith('bank_');
    expect(calls).toBe(6); // Turn selection never requests an external provider.
    await db.execute('UPDATE question_ingestion SET next_allowed_at = 0');
    await ingestQuestions(db);
    expect(await db.queryFirst('SELECT COUNT(*) AS count FROM questions')).toEqual({ count: 240 });
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
    expect(await db.queryFirst('SELECT COUNT(*) AS count FROM questions')).toEqual({ count: 180 });
    expect(await db.queryFirst('SELECT last_added FROM question_ingestion')).toEqual({ last_added: 0 });
  } finally { release(); globalThis.fetch = savedFetch; }
});
