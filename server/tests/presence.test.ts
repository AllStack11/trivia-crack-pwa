import { expect, test } from 'bun:test';
import { createBunDatabase, SCHEMA_SQL } from '../src/db/database';
import { register } from '../src/services/authService';
import { createGame } from '../src/services/gameEngine';
import { updateMatchPresence } from '../src/services/presenceService';
import app from '../src/index';
import { asD1 } from './helpers/d1';

test('presence is shared across bindings, expires, and closing one tab preserves another', async () => {
  const db = await createBunDatabase(':memory:'); await db.exec(SCHEMA_SQL);
  const alice = await register(db, {username:'PresenceAlice'});
  const bob = await register(db, {username:'PresenceBob'});
  const {gameId} = await createGame(db, alice.account.id, bob.account.id);
  const {createD1Database} = await import('../src/db/database');
  const independent = createD1Database(asD1(db));
  const start = 100_000;
  let presence = await updateMatchPresence(db, gameId, alice.account.id, 'alice-connection-1', true, start);
  expect(presence?.players).toEqual({[alice.account.id]:'live',[bob.account.id]:'offline'});
  presence = await updateMatchPresence(independent, gameId, bob.account.id, 'bob-connection-1', true, start);
  expect(presence?.players[alice.account.id]).toBe('live');
  await updateMatchPresence(db, gameId, alice.account.id, 'alice-connection-2', true, start + 1);
  presence = await updateMatchPresence(db, gameId, alice.account.id, 'alice-connection-1', false, start + 2);
  expect(presence?.players[alice.account.id]).toBe('live');
  presence = await updateMatchPresence(independent, gameId, bob.account.id, 'bob-connection-1', true, start + 30_001);
  expect(presence?.players[alice.account.id]).toBe('offline');
  expect((await db.queryFirst<{revision:number}>('SELECT revision FROM games WHERE id = ?', [gameId]))?.revision).toBe(0);
});

test('presence API authenticates, hides matches, validates leases, and ignores caller player identity', async () => {
  const db = await createBunDatabase(':memory:'); await db.exec(SCHEMA_SQL);
  const alice = await register(db, {username:'Alice'});
  const bob = await register(db, {username:'Bob'});
  const outsider = await register(db, {username:'Other'});
  const {gameId} = await createGame(db, alice.account.id, bob.account.id);
  const env = {DB:asD1(db)};
  const post = (token:string, body:unknown) => app.request(`/api/games/${gameId}/presence`, {method:'POST', headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}, body:JSON.stringify(body)}, env);
  const body = {connectionId:'test-connection-001',active:true};
  expect((await post('', body)).status).toBe(401);
  expect((await post(outsider.token, body)).status).toBe(404);
  expect((await post(alice.token, {connectionId:'bad',active:true})).status).toBe(400);
  expect((await post(alice.token, {...body,active:'true'})).status).toBe(400);
  const response = await post(alice.token, {...body,playerId:bob.account.id});
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const presence = await response.json();
  expect(presence.players).toEqual({[alice.account.id]:'live',[bob.account.id]:'offline'});
  expect((await (await post(alice.token, {...body,active:false})).json()).players[alice.account.id]).toBe('offline');
});
