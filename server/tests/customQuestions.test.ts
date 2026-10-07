import { test, expect } from 'bun:test';
import app from '../src/index';
import { createBunDatabase, SCHEMA_SQL } from '../src/db/database';
import { asD1 } from './helpers/d1';
import { register } from '../src/services/authService';
import { getRandomQuestion } from '../src/services/packService';
import { createGame, spinWheel, getGameStateSync } from '../src/services/gameEngine';
import { CLASSIC_CATEGORIES } from '../../shared/src/index';

test('authenticated contributions share one Custom pool across accounts and pack selections', async () => {
  const db = await createBunDatabase(':memory:'); await db.exec(SCHEMA_SQL);
  const env = { DB: asD1(db) };
  const alice = await register(db, { username: 'Alice' });
  const bob = await register(db, { username: 'Bob' });
  const payload = { category: 'SCIENCE', question: 'Our shared question?', correctAnswer: 'Yes', incorrectAnswers: ['No', 'Maybe', 'Never'] };
  const submit = (token?: string, body: unknown = payload) => app.request('/api/questions/custom', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }, env);
  expect((await submit()).status).toBe(401);
  expect((await submit(alice.token, { ...payload, incorrectAnswers: ['Yes', 'No', 'Never'] })).status).toBe(400);
  expect((await submit(alice.token)).status).toBe(201);
  expect((await submit(bob.token, { ...payload, question: 'Another shared question?' })).status).toBe(201);
  expect(await db.queryFirst("SELECT COUNT(*) AS count FROM question_packs WHERE id = 'custom'")).toEqual({ count: 1 });
  const selected = await getRandomQuestion(db, ['nonexistent'], 'CUSTOM');
  expect(selected.category).toBe('CUSTOM'); expect(selected.packId).toBe('custom');
  const ids = (await db.query<{id: string}>("SELECT id FROM questions WHERE pack_id = 'custom'")).map(q => q.id);
  const replay = await getRandomQuestion(db, ['default'], 'CUSTOM', ids);
  expect(replay.id).toStartWith('replay_'); expect(replay.category).toBe('CUSTOM');
  for (const path of ['/api/packs', '/api/packs/import', '/api/packs/default/expand']) expect((await app.request(path, { method: 'POST' }, env)).status).toBe(410);
  for (const category of ['MEMES', 'MOVIES_TV', 'VIDEO_GAMES'] as const) {
    
    expect((await getRandomQuestion(db, ['default'], category)).category).toBe(category);
  }
});

test('empty Custom pool never substitutes an unrelated category', async () => {
  const db = await createBunDatabase(':memory:'); await db.exec(SCHEMA_SQL);
  await expect(getRandomQuestion(db, ['default'], 'CUSTOM')).rejects.toThrow('Custom pool is empty');
});

test('each new spinner result uses its matching question category and seven-slice angle', async () => {
  const db = await createBunDatabase(':memory:'); await db.exec(SCHEMA_SQL);
  const a = await register(db, { username: 'Spinner A' });
  const b = await register(db, { username: 'Spinner B' });
  await app.request('/api/questions/custom', { method: 'POST', headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'Custom spin?', correctAnswer: 'Yes', incorrectAnswers: ['No', 'Maybe', 'Never'] }) }, { DB: asD1(db) });
  const savedRandom = Math.random;
  try {
    for (const category of ['MEMES', 'CUSTOM', 'MOVIES_TV', 'VIDEO_GAMES'] as const) {
      const categories = [...CLASSIC_CATEGORIES.slice(0, 5), category];
      const index = categories.indexOf(category);
      const { gameId } = await createGame(db, a.account.id, b.account.id, ['default'], categories);
      Math.random = () => (index + .1) / 7;
      const spin = await spinWheel(db, gameId, a.account.id);
      expect(spin.slice).toBe(category); expect(spin.sliceIndex).toBe(index);
      const angle = ((270 - spin.targetDegrees) % 360 + 360) % 360;
      expect(angle).toBeCloseTo((index + .5) * 360 / 7);
      expect((await getGameStateSync(db, gameId))?.activeQuestion?.category).toBe(category);
    }
  } finally { Math.random = savedRandom; }
});
