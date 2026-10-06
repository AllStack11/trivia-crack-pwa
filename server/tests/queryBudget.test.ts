import { expect, test, spyOn } from 'bun:test';
import { createBunDatabase, SCHEMA_SQL } from '../src/db/database';
import { queryBudget } from '../src/db/queryBudget';
import { createGame, getGameStateSync } from '../src/services/gameEngine';
import { register, logout } from '../src/services/authService';
import { app } from '../src/index';
import { asD1 } from './helpers/d1';
import { readGameEvents } from '../../client/src/utils/gameEvents';

test('budget counts individual batch statements and rejects whole batches before any writes', async () => {
  const source = await createBunDatabase(':memory:');
  await source.exec('CREATE TABLE sample (id INTEGER)');
  const budget = queryBudget(source, 2);
  await budget.db.execute('INSERT INTO sample VALUES (1)');
  expect(() => budget.db.batch([{ sql: 'INSERT INTO sample VALUES (2)' }, { sql: 'INSERT INTO sample VALUES (3)' }])).toThrow();
  expect(await source.query('SELECT * FROM sample')).toEqual([{ id: 1 }]);
  expect(budget.used).toBe(1);
});

test('frequent committed revisions rotate before query limit without push work in SSE invocation', async () => {
  const source = await createBunDatabase(':memory:'); await source.exec(SCHEMA_SQL);
  const p1 = await register(source, { username: 'Alice' }), p2 = await register(source, { username: 'Bob' });
  const { gameId } = await createGame(source, p1.account.id, p2.account.id);
  const counted = queryBudget(source, 45);
  let background = 0;
  const response = await app.request(`/api/games/${gameId}/events`, { headers: { Authorization: `Bearer ${p1.token}` } },
    { DB: asD1(counted.db), VAPID_PUBLIC_KEY: 'configured', VAPID_PRIVATE_KEY: 'configured', VAPID_SUBJECT: 'mailto:local@example.com' },
    { waitUntil: () => { background++; }, passThroughOnException: () => {} } as any);
  let snapshots = 0, rotations = 0;
  await readGameEvents(response, (event, data) => {
    if (event === 'sync') {
      snapshots++;
      void source.execute('UPDATE games SET revision = revision + 1 WHERE id = ?', [gameId]);
    }
    if (event === 'reconnect') { rotations++; expect(JSON.parse(data).refresh).toBe(false); }
  });
  expect(snapshots).toBeGreaterThan(1); expect(rotations).toBe(1);
  expect(counted.used).toBeLessThanOrEqual(45); expect(background).toBe(0);
}, 10000);

test('one coherent SSE snapshot fits the reserved eight statements and leaves expired mutations for REST', async () => {
  const db = await createBunDatabase(':memory:'); await db.exec(SCHEMA_SQL);
  const p1 = await register(db, { username: 'Alice' }), p2 = await register(db, { username: 'Bob' });
  const { gameId } = await createGame(db, p1.account.id, p2.account.id);
  const budget = queryBudget(db, 8);
  expect((await getGameStateSync(budget.db, gameId, { attempts: 1, resolveExpired: false }))?.id).toBe(gameId);
  expect(budget.used).toBe(8);
});

test('snapshot revision conflict rotates to REST after one bounded attempt', async () => {
  const source = await createBunDatabase(':memory:'); await source.exec(SCHEMA_SQL);
  const p1 = await register(source, { username: 'Alice' }), p2 = await register(source, { username: 'Bob' });
  const { gameId } = await createGame(source, p1.account.id, p2.account.id);
  const counted = queryBudget(source, 45);
  const concurrent: typeof source = { ...counted.db,
    queryFirst: async (sql, params) => {
      if (sql === 'SELECT revision FROM games WHERE id = ?') await source.execute('UPDATE games SET revision = revision + 1 WHERE id = ?', [gameId]);
      return counted.db.queryFirst(sql, params);
    }
  };
  const response = await app.request(`/api/games/${gameId}/events`, { headers: { Authorization: `Bearer ${p1.token}` } }, { DB: asD1(concurrent) });
  const body = await response.text();
  expect(body).toContain('event: reconnect'); expect(body).toContain('"refresh":true');
  expect(body).not.toContain('event: sync'); expect(counted.used).toBe(10);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
});

test('open SSE detects session revocation during its periodic recheck', async () => {
  const source = await createBunDatabase(':memory:'); await source.exec(SCHEMA_SQL);
  const p1 = await register(source, { username: 'Alice' }), p2 = await register(source, { username: 'Bob' });
  const { gameId } = await createGame(source, p1.account.id, p2.account.id);
  const response = await app.request(`/api/games/${gameId}/events`, { headers: { Authorization: `Bearer ${p1.token}` } }, { DB: asD1(source) });
  const reader = response.body!.getReader();
  await reader.read(); await logout(source, p1.token);
  const realNow = Date.now();
  const clock = spyOn(Date, 'now').mockReturnValue(realNow + 16000);
  try { expect(new TextDecoder().decode((await reader.read()).value)).toContain('event: unauthorized'); }
  finally { clock.mockRestore(); await reader.cancel(); }
}, 5000);
