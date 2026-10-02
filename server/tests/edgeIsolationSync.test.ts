import { expect, test, describe, beforeEach } from 'bun:test';
import { app } from '../src/index';
import type { AppDatabase, CloudflareD1Database } from '../src/db/database';
import { createBunDatabase, SCHEMA_SQL } from '../src/db/database';
import { ensureDefaultPackSeeded } from '../src/services/packService';
import type {
  AuthResponse,
  GameListResponse,
  GameStateSync,
  InvitationSummary,
  QuestionResult
} from '../../shared/src/index';

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

describe('Serverless Edge Isolation & Polling State Sync', () => {
  let db: AppDatabase;
  let envA: { DB: CloudflareD1Database };
  let envB: { DB: CloudflareD1Database };
  let p1Token: string;
  let p1Id: string;
  let p2Token: string;
  let p2Id: string;
  let gameId: string;

  beforeEach(async () => {
    db = await createBunDatabase(':memory:');
    await db.exec(SCHEMA_SQL);
    await ensureDefaultPackSeeded(db);

    // Two distinct env instances sharing ONLY the database (simulating 2 separate Cloudflare Worker edge isolates)
    envA = { DB: asD1(db) };
    envB = { DB: asD1(db) };

    const suffix = Math.random().toString(36).slice(2, 8);

    // P1 registers on Isolate A
    const p1Reg = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `p1_${suffix}@test.com`, username: `P1_${suffix}`, password: 'password123' })
    }, envA);
    const p1Data = (await p1Reg.json()) as AuthResponse;
    p1Token = p1Data.token;
    p1Id = p1Data.account.id;

    // P2 registers on Isolate B
    const p2Reg = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `p2_${suffix}@test.com`, username: `P2_${suffix}`, password: 'password123' })
    }, envB);
    const p2Data = (await p2Reg.json()) as AuthResponse;
    p2Token = p2Data.token;
    p2Id = p2Data.account.id;

    // P1 invites P2 on Isolate A
    await app.request('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p1Token}` },
      body: JSON.stringify({ recipientId: p2Id, packIds: ['default'] })
    }, envA);

    // P2 checks invites and accepts on Isolate B
    const p2Invites = await app.request('/api/invitations', {
      headers: { Authorization: `Bearer ${p2Token}` }
    }, envB);
    const invitesData = (await p2Invites.json()) as { invitations: InvitationSummary[] };
    const inviteId = invitesData.invitations[0].id;

    await app.request(`/api/invitations/${inviteId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p2Token}` },
      body: JSON.stringify({ decision: 'accept' })
    }, envB);

    // Get match on Isolate A
    const gamesRes = await app.request('/api/games', {
      headers: { Authorization: `Bearer ${p1Token}` }
    }, envA);
    const games = (await gamesRes.json()) as GameListResponse;
    gameId = games.matches[0].gameId;
  });

  test('P2 polling Isolate B accurately tracks P1 actions on Isolate A without shared memory', async () => {
    // 1. Initial State: Both isolates see the game
    const p1Init = await (await app.request(`/api/games/${gameId}`, { headers: { Authorization: `Bearer ${p1Token}` } }, envA)).json() as GameStateSync;
    const p2Init = await (await app.request(`/api/games/${gameId}`, { headers: { Authorization: `Bearer ${p2Token}` } }, envB)).json() as GameStateSync;

    expect(p1Init.currentTurnPlayerId).toBe(p1Id);
    expect(p2Init.currentTurnPlayerId).toBe(p1Id);
    expect(p2Init.mode).toBe('SPIN');

    // 2. P1 spins on Isolate A
    const spinRes = await app.request(`/api/games/${gameId}/spin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${p1Token}` }
    }, envA);
    expect(spinRes.status).toBe(200);

    // 3. P2 polls Isolate B (different edge isolate)
    const p2PollAfterSpin = await (await app.request(`/api/games/${gameId}`, { headers: { Authorization: `Bearer ${p2Token}` } }, envB)).json() as GameStateSync;
    expect(p2PollAfterSpin.lastSpin).toBeDefined();
    expect(p2PollAfterSpin.lastSpin?.targetDegrees).toBeGreaterThan(0);

    if (p2PollAfterSpin.mode === 'QUESTION') {
      expect(p2PollAfterSpin.activeQuestion).toBeDefined();
      const questionId = p2PollAfterSpin.activeQuestion!.id;

      // 4. P1 answers on Isolate A
      const answerRes = await app.request(`/api/games/${gameId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p1Token}` },
        body: JSON.stringify({
          questionId,
          answerIndex: 0,
          timeSpentMs: 2000
        })
      }, envA);
      expect(answerRes.status).toBe(200);
      const answerData = (await answerRes.json()) as { result: QuestionResult; state: GameStateSync };

      // 5. P2 polls Isolate B: P2 MUST receive lastResult with full question details
      const p2PollAfterAnswer = await (await app.request(`/api/games/${gameId}`, { headers: { Authorization: `Bearer ${p2Token}` } }, envB)).json() as GameStateSync;
      expect(p2PollAfterAnswer.lastResult).toBeDefined();
      expect(p2PollAfterAnswer.lastResult?.question).toBeDefined();
      expect(p2PollAfterAnswer.lastResult?.question?.id).toBe(questionId);
      expect(p2PollAfterAnswer.lastResult?.question?.options.length).toBe(4);
      expect(p2PollAfterAnswer.lastResult?.wasCorrect).toBe(answerData.result.wasCorrect);

      // Verify turn progression matches
      expect(p2PollAfterAnswer.currentTurnPlayerId).toBe(answerData.result.nextPlayerId);
    }
  });
});
