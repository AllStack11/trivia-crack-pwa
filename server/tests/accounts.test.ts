import { asD1 } from './helpers/d1';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { AppDatabase } from '../src/db/database';
import { createBunDatabase, SCHEMA_SQL } from '../src/db/database';
import { getSession, listDirectory, listPlayers, login, logout, register } from '../src/services/authService';
import { createGame } from '../src/services/gameEngine';
import app from '../src/index';
import {
  isGameParticipant,
  listInvitations,
  listMatches,
  respondToInvitation,
  sendInvitation
} from '../src/services/invitationService';

const PASSWORD = 'correct-horse-battery';


describe('account identity and invitations', () => {
  let db: AppDatabase;

  beforeEach(async () => {
    db = await createBunDatabase(':memory:');
    await db.exec(SCHEMA_SQL);
  });

  test('registers unique normalized accounts and authenticates expiring sessions', async () => {
    const created = await register(db, { username: 'Alice', email: 'Alice@Example.test', password: PASSWORD });
    expect(created.account.username).toBe('Alice');
    expect(await getSession(db, created.token)).toEqual(created.account);
    await expect(register(db, { username: 'alice', email: 'another@example.test', password: PASSWORD })).rejects.toThrow('username');
    await expect(register(db, { username: 'Other', email: 'alice@example.TEST', password: PASSWORD })).rejects.toThrow('email');
    await expect(login(db, 'ALICE@example.test', PASSWORD)).resolves.toMatchObject({ account: created.account });
    await expect(login(db, 'alice@example.test', 'incorrect-password')).rejects.toThrow('Incorrect PIN');
    expect(await getSession(db, created.token, Date.now() + 31 * 24 * 60 * 60 * 1000)).toBeNull();
    await logout(db, created.token);
    expect(await getSession(db, created.token)).toBeNull();
  });

  test('registration reports invalid input and conflicts separately from server failures', async () => {
    await expect(register(db, null as never)).rejects.toMatchObject({ name: 'RegistrationError', status: 400 });
    const created = await register(db, { username: 'Alice', email: 'alice@example.test', password: PASSWORD });
    await expect(register(db, { username: 'Alice', email: 'other@example.test', password: PASSWORD }))
      .rejects.toMatchObject({ name: 'RegistrationError', status: 409 });
    await expect(register(db, { username: 'Other', email: 'alice@example.test', password: PASSWORD }))
      .rejects.toMatchObject({ name: 'RegistrationError', status: 409 });
    expect(created.account.username).toBe('Alice');
  });
  test('creates player with username only and logs in without password', async () => {
    const created = await register(db, { username: 'Sam' });
    expect(created.account.username).toBe('Sam');
    expect(await getSession(db, created.token)).toEqual(created.account);

    const loggedIn = await login(db, 'Sam');
    expect(loggedIn.account.username).toBe('Sam');
    expect(loggedIn.account.id).toBe(created.account.id);
    expect(await getSession(db, loggedIn.token)).toEqual(created.account);
  });

  test('creates player with 4-digit PIN and requires PIN on login', async () => {
    await expect(register(db, { username: 'BadPin', pin: '123' })).rejects.toThrow('PIN must be 4 digits');
    await expect(register(db, { username: 'BadPin', pin: 'abcd' })).rejects.toThrow('PIN must be 4 digits');

    const created = await register(db, { username: 'Charlie', pin: '1234' });
    expect(created.account.username).toBe('Charlie');

    // Missing PIN
    await expect(login(db, 'Charlie')).rejects.toThrow('Incorrect PIN');
    // Wrong PIN
    await expect(login(db, 'Charlie', '9999')).rejects.toThrow('Incorrect PIN');
    // Correct PIN
    const loggedIn = await login(db, 'Charlie', '1234');
    expect(loggedIn.account.username).toBe('Charlie');
    expect(loggedIn.account.id).toBe(created.account.id);
  });

  test('username-only registration and case-insensitive login work through the API', async () => {
    const env = { DB: asD1(db) };
    const post = (path: string, body: unknown) => app.request(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }, env);
    const registered = await post('/api/auth/register', { username: 'DisplayName' });
    expect(registered.status).toBe(201);
    const profile = await registered.json<{ account: { id: string; username: string }; token: string }>();
    const loggedIn = await post('/api/auth/login', { username: 'displayname' });
    expect(loggedIn.status).toBe(200);
    const session = await loggedIn.json<{ account: { id: string; username: string }; token: string }>();
    expect(session.account).toEqual(profile.account);
    expect(session.account.username).toBe('DisplayName');
    const restored = await app.request('/api/me', { headers: { Authorization: 'Bearer ' + session.token } }, env);
    expect(restored.status).toBe(200);
    expect(await restored.json()).toEqual({ account: profile.account });
    await post('/api/auth/register', { username: 'Protected', pin: '4321' });
    expect((await post('/api/auth/login', { username: 'protected' })).status).toBe(401);
    expect((await post('/api/auth/login', { username: 'protected', pin: '0000' })).status).toBe(401);
    expect((await post('/api/auth/login', { username: 'protected', pin: '4321' })).status).toBe(200);
  });

  test('every game route authenticates and hides matches from other profiles', async () => {
    const alice = await register(db, { username: 'Alice' });
    const bob = await register(db, { username: 'Bob' });
    const eve = await register(db, { username: 'Eve' });
    const { gameId } = await createGame(db, alice.account.id, bob.account.id);
    const env = { DB: asD1(db) };
    for (const suffix of ['', '/events', '/spin', '/answer', '/crown', '/resign', '/presence']) {
      const method = suffix === '' || suffix === '/events' ? 'GET' : 'POST';
      const path = '/api/games/' + gameId + suffix;
      expect((await app.request(path, { method }, env)).status).toBe(401);
      expect((await app.request(path, { method, headers: { Authorization: 'Bearer ' + eve.token } }, env)).status).toBe(404);
    }
    const game = await db.queryFirst<{ revision: number; status: string }>('SELECT revision, status FROM games WHERE id = ?', [gameId]);
    expect(game).toEqual({ revision: 0, status: 'IN_PROGRESS' });
  });

  test('public directory endpoint lists players and reflects hasPin status', async () => {
    const sam = await register(db, { username: 'Sam' });
    const charlie = await register(db, { username: 'Charlie', pin: '4321' });

    const dir = await listDirectory(db);
    expect(dir).toEqual([
      { id: charlie.account.id, username: 'Charlie', hasPin: true },
      { id: sam.account.id, username: 'Sam', hasPin: false }
    ]);

    const env = { DB: asD1(db) };
    const res = await app.request('/api/auth/directory', {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ players: Array<{ id: string; username: string; hasPin: boolean }> }>();
    expect(body.players).toEqual([
      { id: charlie.account.id, username: 'Charlie', hasPin: true },
      { id: sam.account.id, username: 'Sam', hasPin: false }
    ]);
  });

  test('case-insensitive username uniqueness is preserved', async () => {
    await register(db, { username: 'Alex' });
    await expect(register(db, { username: 'alex' })).rejects.toThrow('already taken');
    await expect(register(db, { username: 'ALEX' })).rejects.toThrow('already taken');
  });

  test('registration route keeps client errors distinct from database failures', async () => {
    const unavailableDatabase = {
      prepare: () => { throw new Error('database unavailable'); },
      exec: async () => {},
      batch: async () => {}
    };
    const env = { DB: unavailableDatabase as never };
    const invalidJson = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{'
    }, env);
    expect(invalidJson.status).toBe(400);

    const databaseFailure = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'NewUser', email: 'new@example.test', password: PASSWORD })
    }, env);
    expect(databaseFailure.status).toBe(500);
  });

  test('player discovery excludes the caller and preserves display names', async () => {
    const alice = await register(db, { username: 'Alice', email: 'alice@example.test', password: PASSWORD });
    const bob = await register(db, { username: 'bOb', email: 'bob@example.test', password: PASSWORD });
    const charlie = await register(db, { username: 'Charlie', email: 'charlie@example.test', password: PASSWORD });
    expect(await listPlayers(db, alice.account.id)).toEqual([
      { id: bob.account.id, username: 'bOb' },
      { id: charlie.account.id, username: 'Charlie' }
    ]);
  });

  test('game API requires a session and hides matches from nonparticipants', async () => {
    const alice = await register(db, { username: 'Alice', email: 'alice@example.test', password: PASSWORD });
    const bob = await register(db, { username: 'Bob', email: 'bob@example.test', password: PASSWORD });
    const eve = await register(db, { username: 'Eve', email: 'eve@example.test', password: PASSWORD });
    const { gameId } = await createGame(db, alice.account.id, bob.account.id);
    const env = { DB: asD1(db) };

    const anonymous = await app.request('/api/games', {}, env);
    expect(anonymous.status).toBe(401);

    const forbidden = await app.request(`/api/games/${gameId}`, {
      headers: { Authorization: `Bearer ${eve.token}` }
    }, env);
    expect(forbidden.status).toBe(404);

    const participant = await app.request(`/api/games/${gameId}`, {
      headers: { Authorization: `Bearer ${bob.token}` }
    }, env);
    expect(participant.status).toBe(200);
    expect(await participant.json()).toMatchObject({
      id: gameId,
      players: { p1: { id: alice.account.id }, p2: { id: bob.account.id } }
    });
  });

  test('only invite recipient may respond; accept creates one paired match with selected packs', async () => {
    const alice = await register(db, { username: 'Alice', email: 'alice@example.test', password: PASSWORD });
    const bob = await register(db, { username: 'Bob', email: 'bob@example.test', password: PASSWORD });
    const eve = await register(db, { username: 'Eve', email: 'eve@example.test', password: PASSWORD });
    await sendInvitation(db, alice.account.id, bob.account.id, ['default', 'history-pack']);
    const [pending] = await listInvitations(db, bob.account.id);
    expect(pending).toMatchObject({ sender: alice.account, recipient: bob.account, status: 'PENDING' });
    await expect(sendInvitation(db, alice.account.id, bob.account.id)).rejects.toThrow('pending invitation');
    await sendInvitation(db, bob.account.id, alice.account.id);
    await expect(respondToInvitation(db, pending.id, eve.account.id, 'accept')).rejects.toThrow('recipient');
    const accepted = await respondToInvitation(db, pending.id, bob.account.id, 'accept');
    expect(accepted.gameId).toBeDefined();
    const game = await db.queryFirst<{ player1_id: string; player2_id: string; status: string; pack_ids_json: string }>(
      'SELECT player1_id, player2_id, status, pack_ids_json FROM games WHERE id = ?', [accepted.gameId]
    );
    expect(game).toEqual({
      player1_id: alice.account.id,
      player2_id: bob.account.id,
      status: 'IN_PROGRESS',
      pack_ids_json: '["default","history-pack"]'
    });
    expect(await isGameParticipant(db, accepted.gameId!, alice.account.id)).toBe(true);
    expect(await isGameParticipant(db, accepted.gameId!, eve.account.id)).toBe(false);
    expect(await listMatches(db, alice.account.id)).toMatchObject([
      { gameId: accepted.gameId, opponent: bob.account, status: 'IN_PROGRESS', currentTurn: alice.account }
    ]);
    expect(await listMatches(db, eve.account.id)).toEqual([]);
    expect((await listInvitations(db, bob.account.id))).toHaveLength(0);
  });

  test('declines only a pending invitation and creates no match', async () => {
    const alice = await register(db, { username: 'Alice', email: 'alice@example.test', password: PASSWORD });
    const bob = await register(db, { username: 'Bob', email: 'bob@example.test', password: PASSWORD });
    await sendInvitation(db, alice.account.id, bob.account.id);
    const [pending] = await listInvitations(db, bob.account.id);
    await respondToInvitation(db, pending.id, bob.account.id, 'decline');
    await expect(respondToInvitation(db, pending.id, bob.account.id, 'accept')).rejects.toThrow('no longer pending');
    expect(await listMatches(db, alice.account.id)).toEqual([]);
    expect(await db.queryFirst('SELECT id FROM games')).toBeNull();
  });
});
