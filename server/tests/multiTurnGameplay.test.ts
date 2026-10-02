import { asD1 } from './helpers/d1';
import { expect, test, describe, beforeEach } from 'bun:test';
import { app } from '../src/index';
import type { AppDatabase, CloudflareD1Database } from '../src/db/database';
import { createBunDatabase, SCHEMA_SQL } from '../src/db/database';
import { ensureDefaultPackSeeded } from '../src/services/packService';
import type {
  AuthResponse,
  Category,
  GameListResponse,
  GameStateSync,
  InvitationSummary,
  QuestionResult,
  SpinResponse
} from '../../shared/src/index';


describe('Multi-Turn Sequential Game Loop', () => {
  let db: AppDatabase;
  let env: { DB: CloudflareD1Database };
  let p1Token: string;
  let p1Id: string;
  let p2Token: string;
  let p2Id: string;
  let gameId: string;

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
        email: `alice_${suffix}@test.com`,
        username: `Alice_${suffix}`,
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
        email: `bob_${suffix}@test.com`,
        username: `Bob_${suffix}`,
        password: 'password123'
      })
    }, env);
    const p2Data = (await p2Reg.json()) as AuthResponse;
    p2Token = p2Data.token;
    p2Id = p2Data.account.id;

    // Invite and accept match
    await app.request('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p1Token}` },
      body: JSON.stringify({ recipientId: p2Id, packIds: ['default'] })
    }, env);

    const invitesRes = await app.request('/api/invitations', {
      headers: { Authorization: `Bearer ${p2Token}` }
    }, env);
    const invites = (await invitesRes.json()) as { invitations: InvitationSummary[] };
    const inviteId = invites.invitations[0].id;

    await app.request(`/api/invitations/${inviteId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p2Token}` },
      body: JSON.stringify({ decision: 'accept' })
    }, env);

    const gamesRes = await app.request('/api/games', {
      headers: { Authorization: `Bearer ${p1Token}` }
    }, env);
    const games = (await gamesRes.json()) as GameListResponse;
    gameId = games.matches[0].gameId;
  });

  test('multi-turn streak, crown gauge reset, turn handoff, and state boundary cleanup', async () => {
    // -------------------------------------------------------------
    // TURN 1: P1 spins and answers correctly
    // -------------------------------------------------------------
    let stateRes = await app.request(`/api/games/${gameId}`, {
      headers: { Authorization: `Bearer ${p1Token}` }
    }, env);
    let state = (await stateRes.json()) as GameStateSync;
    expect(state.mode).toBe('SPIN');
    expect(state.currentTurnPlayerId).toBe(p1Id);
    expect(state.players.p1.crownGauge).toBe(0);
    expect(state.lastResult).toBeUndefined();

    // P1 spins
    let spinRes = await app.request(`/api/games/${gameId}/spin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${p1Token}` }
    }, env);
    expect(spinRes.status).toBe(200);

    stateRes = await app.request(`/api/games/${gameId}`, {
      headers: { Authorization: `Bearer ${p1Token}` }
    }, env);
    state = (await stateRes.json()) as GameStateSync;

    // Mode is either QUESTION or CROWN_CHOICE
    if (state.mode === 'QUESTION') {
      expect(state.lastResult).toBeUndefined(); // MUST be undefined!
      expect(state.activeQuestion).toBeDefined();

      // Answer correctly: find correct answer index from DB stored question
      const dbGame = await db.queryFirst<{ active_question_json: string }>(
        'SELECT active_question_json FROM games WHERE id = ?',
        [gameId]
      );
      const stored = JSON.parse(dbGame!.active_question_json);
      const correctIdx = stored.correctIndex;

      const ansRes = await app.request(`/api/games/${gameId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p1Token}` },
        body: JSON.stringify({
          questionId: state.activeQuestion!.id,
          answerIndex: correctIdx,
          timeSpentMs: 2000
        })
      }, env);
      expect(ansRes.status).toBe(200);
      const ansData = (await ansRes.json()) as { result: QuestionResult; state: GameStateSync };
      expect(ansData.result.wasCorrect).toBe(true);
      expect(ansData.result.turnContinued).toBe(true);
      expect(ansData.result.question).toBeDefined();
      expect(ansData.state.currentTurnPlayerId).toBe(p1Id);

      // Post-answer: mode is SPIN or CROWN_CHOICE, lastResult is defined
      expect(ansData.state.lastResult).toBeDefined();
    }

    // -------------------------------------------------------------
    // TURN 2: P1 spins for Question 2
    // CRITICAL: When Turn 2 begins, lastResult MUST NOT leak into QUESTION mode!
    // -------------------------------------------------------------
    stateRes = await app.request(`/api/games/${gameId}`, {
      headers: { Authorization: `Bearer ${p1Token}` }
    }, env);
    state = (await stateRes.json()) as GameStateSync;

    if (state.mode === 'SPIN') {
      spinRes = await app.request(`/api/games/${gameId}/spin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${p1Token}` }
      }, env);
      expect(spinRes.status).toBe(200);

      stateRes = await app.request(`/api/games/${gameId}`, {
        headers: { Authorization: `Bearer ${p1Token}` }
      }, env);
      state = (await stateRes.json()) as GameStateSync;

      if (state.mode === 'QUESTION') {
        // Assert BUG FIX 1: lastResult MUST BE UNDEFINED in QUESTION mode!
        expect(state.lastResult).toBeUndefined();
        expect(state.activeQuestion).toBeDefined();

        // -------------------------------------------------------------
        // TURN 2 ANSWER: P1 intentionally answers INCORRECTLY
        // -------------------------------------------------------------
        const dbGame2 = await db.queryFirst<{ active_question_json: string }>(
          'SELECT active_question_json FROM games WHERE id = ?',
          [gameId]
        );
        const stored2 = JSON.parse(dbGame2!.active_question_json);
        const wrongIdx = (stored2.correctIndex + 1) % 4; // guaranteed incorrect

        const ansRes2 = await app.request(`/api/games/${gameId}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p1Token}` },
          body: JSON.stringify({
            questionId: state.activeQuestion!.id,
            answerIndex: wrongIdx,
            timeSpentMs: 3500
          })
        }, env);
        expect(ansRes2.status).toBe(200);
        const ansData2 = (await ansRes2.json()) as { result: QuestionResult; state: GameStateSync };
        expect(ansData2.result.wasCorrect).toBe(false);
        expect(ansData2.result.turnContinued).toBe(false);
        expect(ansData2.result.nextPlayerId).toBe(p2Id);
        expect(ansData2.state.currentTurnPlayerId).toBe(p2Id);
        expect(ansData2.state.players.p1.crownGauge).toBe(0); // gauge resets on wrong answer

        // -------------------------------------------------------------
        // TURN 3: Turn passed to P2!
        // -------------------------------------------------------------
        // P1 should be rejected if attempting to spin
        const p1InvalidSpin = await app.request(`/api/games/${gameId}/spin`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${p1Token}` }
        }, env);
        expect(p1InvalidSpin.status).toBe(400);

        // P2 spins successfully
        const p2Spin = await app.request(`/api/games/${gameId}/spin`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${p2Token}` }
        }, env);
        expect(p2Spin.status).toBe(200);

        // Fetch P2 game state
        stateRes = await app.request(`/api/games/${gameId}`, {
          headers: { Authorization: `Bearer ${p2Token}` }
        }, env);
        state = (await stateRes.json()) as GameStateSync;
        expect(state.currentTurnPlayerId).toBe(p2Id);

        if (state.mode === 'QUESTION') {
          // P2 sees a fresh question, no stale lastResult
          expect(state.lastResult).toBeUndefined();
          expect(state.activeQuestion).toBeDefined();

          // P2 answers correctly
          const dbGameP2 = await db.queryFirst<{ active_question_json: string }>(
            'SELECT active_question_json FROM games WHERE id = ?',
            [gameId]
          );
          const storedP2 = JSON.parse(dbGameP2!.active_question_json);

          const ansP2Res = await app.request(`/api/games/${gameId}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p2Token}` },
            body: JSON.stringify({
              questionId: state.activeQuestion!.id,
              answerIndex: storedP2.correctIndex,
              timeSpentMs: 2500
            })
          }, env);
          expect(ansP2Res.status).toBe(200);
          const ansDataP2 = (await ansP2Res.json()) as { result: QuestionResult; state: GameStateSync };
          expect(ansDataP2.result.wasCorrect).toBe(true);
          expect(ansDataP2.result.nextPlayerId).toBe(p2Id);
          expect(ansDataP2.state.players.p2?.crownGauge).toBe(1);
        }
      }
    }
  });

  test('crown battle flow: reaching 3 points, claiming crown, and resetting gauge', async () => {
    // Force game state to crown gauge = 2 for P1
    await db.execute('UPDATE games SET crown_gauge = 2 WHERE id = ?', [gameId]);

    // Force a question state in DB
    const questionId = 'art_gauge_test';
    const stored = {
      questionData: {
        id: questionId,
        packId: 'default',
        category: 'ART' as Category,
        question: 'Who painted Starry Night?',
        correctAnswer: 'Vincent van Gogh',
        incorrectAnswers: ['Claude Monet', 'Pablo Picasso', 'Salvador Dalí'],
        difficulty: 'easy' as const
      },
      shuffledOptions: ['Claude Monet', 'Vincent van Gogh', 'Pablo Picasso', 'Salvador Dalí'],
      correctIndex: 1,
      startedAt: Date.now(),
      durationMs: 20000,
      isCrown: false
    };

    await db.execute(
      `UPDATE games SET active_mode = 'QUESTION', active_question_json = ? WHERE id = ?`,
      [JSON.stringify(stored), gameId]
    );

    // P1 answers correctly -> reaches 3 gauge points
    const ansRes = await app.request(`/api/games/${gameId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p1Token}` },
      body: JSON.stringify({
        questionId,
        answerIndex: 1,
        timeSpentMs: 1500
      })
    }, env);
    expect(ansRes.status).toBe(200);
    const ansData = (await ansRes.json()) as { result: QuestionResult; state: GameStateSync };

    expect(ansData.result.wasCorrect).toBe(true);
    // Gauge reached 3, transitions to CROWN_CHOICE
    expect(ansData.state.mode).toBe('CROWN_CHOICE');
    expect(ansData.state.players.p1.crownGauge).toBe(0); // gauge resets

    // P1 chooses Claim on GEOGRAPHY
    const crownChoiceRes = await app.request(`/api/games/${gameId}/crown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p1Token}` },
      body: JSON.stringify({
        action: 'claim',
        category: 'GEOGRAPHY'
      })
    }, env);
    expect(crownChoiceRes.status).toBe(200);
    const crownChoiceState = (await crownChoiceRes.json()) as GameStateSync;

    // Crown question is generated
    expect(crownChoiceState.mode).toBe('QUESTION');
    expect(crownChoiceState.activeQuestion?.isCrown).toBe(true);
    expect(crownChoiceState.activeQuestion?.crownCategory).toBe('GEOGRAPHY');
    // Ensure lastResult is cleared on crown choice question!
    expect(crownChoiceState.lastResult).toBeUndefined();

    // Answer crown question correctly
    const dbCrownGame = await db.queryFirst<{ active_question_json: string }>(
      'SELECT active_question_json FROM games WHERE id = ?',
      [gameId]
    );
    const storedCrown = JSON.parse(dbCrownGame!.active_question_json);

    const crownAnsRes = await app.request(`/api/games/${gameId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p1Token}` },
      body: JSON.stringify({
        questionId: crownChoiceState.activeQuestion!.id,
        answerIndex: storedCrown.correctIndex,
        timeSpentMs: 2000
      })
    }, env);
    expect(crownAnsRes.status).toBe(200);
    const crownAnsData = (await crownAnsRes.json()) as { result: QuestionResult; state: GameStateSync };

    // Crown awarded!
    expect(crownAnsData.result.wasCorrect).toBe(true);
    expect(crownAnsData.result.awardedCrown).toBe('GEOGRAPHY');
    expect(crownAnsData.state.players.p1.crowns).toContain('GEOGRAPHY');
    expect(crownAnsData.state.mode).toBe('SPIN');
    expect(crownAnsData.state.currentTurnPlayerId).toBe(p1Id);
  });
});
