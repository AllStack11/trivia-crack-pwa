import { asD1 } from './helpers/d1';
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
  QuestionResult,
  SpinResponse
} from '../../shared/src/index';


describe('Gameplay Loop E2E Integration', () => {
  let db: AppDatabase;
  let env: { DB: CloudflareD1Database };
  let p1Token: string;
  let p1Id: string;
  let p2Token: string;
  let p2Id: string;

  beforeEach(async () => {
    db = await createBunDatabase(':memory:');
    await db.exec(SCHEMA_SQL);
    await ensureDefaultPackSeeded(db);
    env = { DB: asD1(db) };

    const suffix = Math.random().toString(36).slice(2, 8);

    // Register Player 1
    const p1Reg = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `p1_${suffix}@test.com`,
        username: `Player1_${suffix}`,
        password: 'password123'
      })
    }, env);
    const p1Data = (await p1Reg.json()) as AuthResponse;
    p1Token = p1Data.token;
    p1Id = p1Data.account.id;

    // Register Player 2
    const p2Reg = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `p2_${suffix}@test.com`,
        username: `Player2_${suffix}`,
        password: 'password123'
      })
    }, env);
    const p2Data = (await p2Reg.json()) as AuthResponse;
    p2Token = p2Data.token;
    p2Id = p2Data.account.id;
  });

  test('full gameplay loop: invite, spin, answer, next turn', async () => {
    // 1. P1 sends invitation to P2
    const inviteRes = await app.request('/api/invitations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${p1Token}`
      },
      body: JSON.stringify({
        recipientId: p2Id,
        packIds: ['default']
      })
    }, env);
    expect(inviteRes.status).toBe(201);

    // 2. P2 gets invitations to find invitationId
    const p2InvitesRes = await app.request('/api/invitations', {
      headers: { Authorization: `Bearer ${p2Token}` }
    }, env);
    expect(p2InvitesRes.status).toBe(200);
    const p2InvitesData = (await p2InvitesRes.json()) as { invitations: InvitationSummary[] };
    expect(p2InvitesData.invitations.length).toBe(1);
    const invitationId = p2InvitesData.invitations[0].id;

    // 2b. P2 accepts invitation
    const acceptRes = await app.request(`/api/invitations/${invitationId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${p2Token}`
      },
      body: JSON.stringify({ decision: 'accept' })
    }, env);
    expect(acceptRes.status).toBe(200);

    // 3. P1 gets games list to find gameId
    const gamesRes = await app.request('/api/games', {
      headers: { Authorization: `Bearer ${p1Token}` }
    }, env);
    expect(gamesRes.status).toBe(200);
    const gamesData = (await gamesRes.json()) as GameListResponse;
    expect(gamesData.matches.length).toBe(1);
    const gameId = gamesData.matches[0].gameId;

    // 4. P1 checks game state
    const stateRes = await app.request(`/api/games/${gameId}`, {
      headers: { Authorization: `Bearer ${p1Token}` }
    }, env);
    expect(stateRes.status).toBe(200);
    let state = (await stateRes.json()) as GameStateSync;
    expect(state.currentTurnPlayerId).toBe(p1Id);
    expect(state.mode).toBe('SPIN');

    // 5. P1 spins the wheel
    const spinRes = await app.request(`/api/games/${gameId}/spin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${p1Token}` }
    }, env);
    expect(spinRes.status).toBe(200);
    const spinData = (await spinRes.json()) as SpinResponse;
    expect(spinData.slice).toBeDefined();

    // Re-fetch state
    const postSpinRes = await app.request(`/api/games/${gameId}`, {
      headers: { Authorization: `Bearer ${p1Token}` }
    }, env);
    state = (await postSpinRes.json()) as GameStateSync;

    console.log('Post-spin mode:', state.mode);
    if (state.mode === 'QUESTION') {
      expect(state.activeQuestion).toBeDefined();
      const question = state.activeQuestion!;
      expect(question.options.length).toBe(4);

      // 6. P1 answers the question
      const answerRes = await app.request(`/api/games/${gameId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${p1Token}`
        },
        body: JSON.stringify({
          questionId: question.id,
          answerIndex: 0,
          timeSpentMs: 2500
        })
      }, env);
      expect(answerRes.status).toBe(200);
      const answerData = (await answerRes.json()) as { result: QuestionResult; state: GameStateSync };
      console.log('Answer result wasCorrect:', answerData.result.wasCorrect);
      console.log('Post-answer mode:', answerData.state.mode);
      console.log('Post-answer turn:', answerData.state.currentTurnPlayerId);
      console.log('Post-answer lastResult:', answerData.state.lastResult);
      // Check question was preserved in lastResult
      expect(answerData.result.question).toBeDefined();
      expect(answerData.result.question?.id).toBe(question.id);
      expect(answerData.result.question?.question).toBe(question.question);
      expect(answerData.result.question?.options.length).toBe(4);
      expect(answerData.state.lastResult?.question).toBeDefined();
      expect(answerData.state.lastResult?.question?.id).toBe(question.id);

      // Verify state after answer
      if (answerData.result.wasCorrect) {
        expect(answerData.state.currentTurnPlayerId).toBe(p1Id);
      } else {
        expect(answerData.state.currentTurnPlayerId).toBe(p2Id);
      }

      // Check if subsequent actions work without error (Round 2)
      const activePlayerToken = answerData.state.currentTurnPlayerId === p1Id ? p1Token : p2Token;
      const activePlayerId = answerData.state.currentTurnPlayerId;
      if (answerData.state.mode === 'SPIN') {
        const nextSpinRes = await app.request(`/api/games/${gameId}/spin`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${activePlayerToken}` }
        }, env);
        expect(nextSpinRes.status).toBe(200);

        // Fetch round 2 state
        const round2StateRes = await app.request(`/api/games/${gameId}`, {
          headers: { Authorization: `Bearer ${activePlayerToken}` }
        }, env);
        expect(round2StateRes.status).toBe(200);
        const round2State = (await round2StateRes.json()) as GameStateSync;

        if (round2State.mode === 'QUESTION') {
          // CRITICAL: lastResult must be undefined during a question to prevent auto-answer/freezing!
          expect(round2State.lastResult).toBeUndefined();
          expect(round2State.activeQuestion).toBeDefined();
          const q2 = round2State.activeQuestion!;
          expect(q2.id).not.toBe(question.id);

          // Answer round 2 question
          const ans2Res = await app.request(`/api/games/${gameId}/answer`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${activePlayerToken}`
            },
            body: JSON.stringify({
              questionId: q2.id,
              answerIndex: 1,
              timeSpentMs: 3000
            })
          }, env);
          expect(ans2Res.status).toBe(200);
          const ans2Data = (await ans2Res.json()) as { result: QuestionResult; state: GameStateSync };
          expect(ans2Data.result.question?.id).toBe(q2.id);
          console.log('Round 2 answer completed successfully!');
        }
      }
    }
  });
});
