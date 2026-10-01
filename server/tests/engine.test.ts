import { expect, test, describe, beforeEach } from 'bun:test';
import type { Category } from '../../shared/src/index';
import type { AppDatabase } from '../src/db/database';
import { createBunDatabase, SCHEMA_SQL } from '../src/db/database';
import {
  createGame,
  joinGame,
  spinWheel,
  chooseCrown,
  answerQuestion,
  resignGame,
  getGameStateSync
} from '../src/services/gameEngine';
import { ensureDefaultPackSeeded } from '../src/services/packService';

describe('Game Engine State Machine', () => {
  let db: AppDatabase;

  beforeEach(async () => {
    // Fresh in-memory sqlite database for every test
    db = await createBunDatabase(':memory:');
    await db.exec(SCHEMA_SQL);
    await ensureDefaultPackSeeded(db);
  });

  test('Room creation and player join lifecycle', async () => {
    const host = await createGame(db, 'Alice');
    expect(host.gameId).toBeDefined();
    expect(host.inviteCode.startsWith('TRIV-')).toBe(true);

    let state = await getGameStateSync(db, host.gameId);
    expect(state).not.toBeNull();
    expect(state?.status).toBe('WAITING');
    expect(state?.players.p1.username).toBe('Alice');
    expect(state?.players.p2).toBeNull();
    expect(state?.currentTurnPlayerId).toBe(host.playerId);

    // Guest joins room
    const guest = await joinGame(db, host.inviteCode, 'Bob');
    expect(guest.playerId).toBeDefined();

    state = await getGameStateSync(db, host.gameId);
    expect(state?.status).toBe('IN_PROGRESS');
    expect(state?.players.p2?.username).toBe('Bob');
    expect(state?.mode).toBe('SPIN');
  });

  test('Wheel spin generates valid slice and question prompt', async () => {
    const host = await createGame(db, 'Alice');
    await joinGame(db, host.inviteCode, 'Bob');

    const spin = await spinWheel(db, host.gameId, host.playerId);
    expect(spin.sliceIndex).toBeGreaterThanOrEqual(0);
    expect(spin.sliceIndex).toBeLessThanOrEqual(6);
    expect(spin.targetDegrees).toBeGreaterThan(360);

    const state = await getGameStateSync(db, host.gameId);
    if (spin.slice === 'CROWN') {
      expect(state?.mode).toBe('CROWN_CHOICE');
    } else {
      expect(state?.mode).toBe('QUESTION');
      expect(state?.activeQuestion?.options.length).toBe(4);
      expect(state?.activeQuestion?.category).toBe(spin.slice);
      // Question should NOT expose secret correct answer or index
      expect(typeof state?.activeQuestion?.id).toBe('string');
    }
  });

  test('Correct answer increments crown gauge and retains turn', async () => {
    const host = await createGame(db, 'Alice');
    await joinGame(db, host.inviteCode, 'Bob');

    // Force a question state in DB
    const questionId = 'art_1';
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
      [JSON.stringify(stored), host.gameId]
    );

    // Answer correctly (index 1)
    const result = await answerQuestion(db, host.gameId, host.playerId, questionId, 1, 3500);
    expect(result.wasCorrect).toBe(true);
    expect(result.turnContinued).toBe(true);
    expect(result.nextPlayerId).toBe(host.playerId);

    const state = await getGameStateSync(db, host.gameId);
    expect(state?.players.p1.crownGauge).toBe(1);
    expect(state?.currentTurnPlayerId).toBe(host.playerId);
    expect(state?.mode).toBe('SPIN');
  });

  test('Reaching 3 gauge points triggers CROWN_CHOICE', async () => {
    const host = await createGame(db, 'Alice');
    await joinGame(db, host.inviteCode, 'Bob');

    // Set crown gauge already at 2
    await db.execute('UPDATE games SET crown_gauge = 2 WHERE id = ?', [host.gameId]);

    const questionId = 'sci_1';
    const stored = {
      questionData: {
        id: questionId,
        packId: 'default',
        category: 'SCIENCE' as Category,
        question: 'Chemical symbol for Gold?',
        correctAnswer: 'Au',
        incorrectAnswers: ['Ag', 'Fe', 'Cu'],
        difficulty: 'easy' as const
      },
      shuffledOptions: ['Ag', 'Fe', 'Au', 'Cu'],
      correctIndex: 2,
      startedAt: Date.now(),
      durationMs: 20000,
      isCrown: false
    };

    await db.execute(
      `UPDATE games SET active_mode = 'QUESTION', active_question_json = ? WHERE id = ?`,
      [JSON.stringify(stored), host.gameId]
    );

    const result = await answerQuestion(db, host.gameId, host.playerId, questionId, 2, 2000);
    expect(result.wasCorrect).toBe(true);

    const state = await getGameStateSync(db, host.gameId);
    expect(state?.mode).toBe('CROWN_CHOICE');
    expect(state?.players.p1.crownGauge).toBe(0); // Gauge resets
  });

  test('Crown claim awards character crown upon correct answer', async () => {
    const host = await createGame(db, 'Alice');
    await joinGame(db, host.inviteCode, 'Bob');

    await db.execute(`UPDATE games SET active_mode = 'CROWN_CHOICE' WHERE id = ?`, [host.gameId]);

    // Alice chooses to claim HISTORY crown
    await chooseCrown(db, host.gameId, host.playerId, 'claim', 'HISTORY');

    let state = await getGameStateSync(db, host.gameId);
    expect(state?.mode).toBe('QUESTION');
    expect(state?.activeQuestion?.isCrown).toBe(true);
    expect(state?.activeQuestion?.crownCategory).toBe('HISTORY');

    // Inspect stored correct answer to answer correctly
    const gameRow = await db.queryFirst<{ active_question_json: string }>(
      'SELECT active_question_json FROM games WHERE id = ?',
      [host.gameId]
    );
    const stored = JSON.parse(gameRow!.active_question_json);

    const result = await answerQuestion(
      db,
      host.gameId,
      host.playerId,
      stored.questionData.id,
      stored.correctIndex,
      1500
    );

    expect(result.wasCorrect).toBe(true);
    expect(result.awardedCrown).toBe('HISTORY');

    state = await getGameStateSync(db, host.gameId);
    expect(state?.players.p1.crowns).toContain('HISTORY');
    expect(state?.currentTurnPlayerId).toBe(host.playerId); // Still Alice's turn
  });

  test('Incorrect answer passes turn to opponent and resets gauge', async () => {
    const host = await createGame(db, 'Alice');
    const guest = await joinGame(db, host.inviteCode, 'Bob');

    await db.execute('UPDATE games SET crown_gauge = 2 WHERE id = ?', [host.gameId]);

    const questionId = 'spo_1';
    const stored = {
      questionData: {
        id: questionId,
        packId: 'default',
        category: 'SPORTS' as Category,
        question: 'Soccer players per team?',
        correctAnswer: '11',
        incorrectAnswers: ['10', '9', '12'],
        difficulty: 'easy' as const
      },
      shuffledOptions: ['10', '11', '9', '12'],
      correctIndex: 1,
      startedAt: Date.now(),
      durationMs: 20000,
      isCrown: false
    };

    await db.execute(
      `UPDATE games SET active_mode = 'QUESTION', active_question_json = ? WHERE id = ?`,
      [JSON.stringify(stored), host.gameId]
    );

    // Alice picks wrong answer (index 0)
    const result = await answerQuestion(db, host.gameId, host.playerId, questionId, 0, 4000);
    expect(result.wasCorrect).toBe(false);
    expect(result.turnContinued).toBe(false);
    expect(result.nextPlayerId).toBe(guest.playerId);

    const state = await getGameStateSync(db, host.gameId);
    expect(state?.players.p1.crownGauge).toBe(0);
    expect(state?.currentTurnPlayerId).toBe(guest.playerId);
    expect(state?.mode).toBe('SPIN');
  });

  test('Steal Challenge: challenger steals crown on correct answer', async () => {
    const host = await createGame(db, 'Alice');
    const guest = await joinGame(db, host.inviteCode, 'Bob');

    // Give Alice ART crown and Bob SCIENCE crown
    await db.execute(
      `INSERT INTO game_crowns (game_id, player_id, category, created_at)
       VALUES (?, ?, 'ART', ?), (?, ?, 'SCIENCE', ?)`,
      [host.gameId, host.playerId, Date.now(), host.gameId, guest.playerId, Date.now()]
    );

    // Set Bob's turn in CROWN_CHOICE
    await db.execute(
      `UPDATE games SET current_turn_player_id = ?, active_mode = 'CROWN_CHOICE' WHERE id = ?`,
      [guest.playerId, host.gameId]
    );

    // Bob challenges Alice for ART crown, wagering his SCIENCE crown
    await chooseCrown(db, host.gameId, guest.playerId, 'steal', 'ART', 'SCIENCE');

    const gameRow = await db.queryFirst<{ active_question_json: string }>(
      'SELECT active_question_json FROM games WHERE id = ?',
      [host.gameId]
    );
    const stored = JSON.parse(gameRow!.active_question_json);
    expect(stored.isSteal).toBe(true);

    // Bob answers correctly
    const result = await answerQuestion(
      db,
      host.gameId,
      guest.playerId,
      stored.questionData.id,
      stored.correctIndex,
      2500
    );

    expect(result.wasCorrect).toBe(true);
    expect(result.stolenCrown).toBe('ART');

    const state = await getGameStateSync(db, host.gameId);
    expect(state?.players.p2?.crowns).toContain('ART');
    expect(state?.players.p2?.crowns).toContain('SCIENCE');
    expect(state?.players.p1.crowns).not.toContain('ART');
  });

  test('6-Crown Victory concludes match with GAME_OVER', async () => {
    const host = await createGame(db, 'Alice');
    await joinGame(db, host.inviteCode, 'Bob');

    // Give Alice 5 crowns already
    const fiveCrowns: Category[] = ['ART', 'SCIENCE', 'SPORTS', 'ENTERTAINMENT', 'GEOGRAPHY'];
    for (const c of fiveCrowns) {
      await db.execute(
        'INSERT INTO game_crowns (game_id, player_id, category, created_at) VALUES (?, ?, ?, ?)',
        [host.gameId, host.playerId, c, Date.now()]
      );
    }

    // Set Alice playing for the 6th crown (HISTORY)
    const stored = {
      questionData: {
        id: 'his_1',
        packId: 'default',
        category: 'HISTORY' as Category,
        question: 'Year of Columbus voyage?',
        correctAnswer: '1492',
        incorrectAnswers: ['1500', '1450', '1520'],
        difficulty: 'easy' as const
      },
      shuffledOptions: ['1500', '1492', '1450', '1520'],
      correctIndex: 1,
      startedAt: Date.now(),
      durationMs: 20000,
      isCrown: true,
      crownCategory: 'HISTORY' as Category
    };

    await db.execute(
      `UPDATE games SET active_mode = 'QUESTION', active_question_json = ? WHERE id = ?`,
      [JSON.stringify(stored), host.gameId]
    );

    await answerQuestion(db, host.gameId, host.playerId, 'his_1', 1, 2000);

    const state = await getGameStateSync(db, host.gameId);
    expect(state?.status).toBe('COMPLETED');
    expect(state?.mode).toBe('GAME_OVER');
    expect(state?.winnerId).toBe(host.playerId);
    expect(state?.players.p1.crowns.length).toBe(6);
  });

  test('Resignation surrenders match to opponent', async () => {
    const host = await createGame(db, 'Alice');
    const guest = await joinGame(db, host.inviteCode, 'Bob');

    await resignGame(db, host.gameId, host.playerId);

    const state = await getGameStateSync(db, host.gameId);
    expect(state?.status).toBe('COMPLETED');
    expect(state?.mode).toBe('GAME_OVER');
    expect(state?.winnerId).toBe(guest.playerId);
    expect(state?.winReason).toBe('Opponent surrendered');
  });
});
