import { beforeEach, describe, expect, test } from 'bun:test';
import type { AppDatabase, CloudflareD1Database } from '../src/db/database';
import { createBunDatabase, SCHEMA_SQL } from '../src/db/database';
import { getSession, listPlayers, login, logout, register } from '../src/services/authService';
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

function asD1(db: AppDatabase): CloudflareD1Database {
  return {
    prepare(sql) {
      const bind = (...params: unknown[]) => ({
        all: async <T = unknown>() => ({ results: await db.query<T>(sql, params) }),
        first: async <T = unknown>() => db.queryFirst<T>(sql, params),
        run: async () => ({ meta: { changes: (await db.execute(sql, params)).rowsAffected } })
      });
      return {
        ...bind(),
        bind,
        all: async <T = unknown>() => ({ results: await db.query<T>(sql) }),
        first: async <T = unknown>() => db.queryFirst<T>(sql),
        run: async () => ({ meta: { changes: (await db.execute(sql)).rowsAffected } })
      };
    },
    exec: (sql) => db.exec(sql),
    batch: async (statements) => {
      for (const statement of statements) await statement.run();
    }
  };
}

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
    await expect(login(db, 'alice@example.test', 'incorrect-password')).rejects.toThrow('Invalid email or password');
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
