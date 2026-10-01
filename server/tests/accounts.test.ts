import { beforeEach, describe, expect, test } from 'bun:test';
import type { AppDatabase } from '../src/db/database';
import { createBunDatabase, SCHEMA_SQL } from '../src/db/database';
import { getSession, listPlayers, login, logout, register } from '../src/services/authService';
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
    await expect(login(db, 'alice@example.test', 'incorrect-password')).rejects.toThrow('Invalid email or password');
    expect(await getSession(db, created.token, Date.now() + 31 * 24 * 60 * 60 * 1000)).toBeNull();
    await logout(db, created.token);
    expect(await getSession(db, created.token)).toBeNull();
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
