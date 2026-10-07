import { CLASSIC_CATEGORIES } from '../../shared/src/index';
import { expect, test, describe, beforeEach } from 'bun:test';
import type { Category } from '../../shared/src/index';
import type { AppDatabase } from '../src/db/database';
import { createBunDatabase, SCHEMA_SQL } from '../src/db/database';
import {
  createGame,
  spinWheel,
  chooseCrown,
  answerQuestion,
  resignGame,
  getGameStateSync
} from '../src/services/gameEngine';
import { ensureDefaultPackSeeded } from '../src/services/packService';

const PLAYER_ONE = 'player_one';
const PLAYER_TWO = 'player_two';

describe('Game Engine State Machine', () => {
  let db: AppDatabase;

  beforeEach(async () => {
    // Fresh in-memory sqlite database for every test
    db = await createBunDatabase(':memory:');
    await db.exec(SCHEMA_SQL);
    await ensureDefaultPackSeeded(db);
    await db.execute("INSERT INTO users (id, username, created_at) VALUES (?, 'Alice', ?)", [PLAYER_ONE, Date.now()]);
    await db.execute("INSERT INTO accounts (user_id, email, normalized_email, normalized_username, password_hash) VALUES (?, 'alice@example.test', 'alice@example.test', 'alice', 'test')", [PLAYER_ONE]);
    await db.execute("INSERT INTO users (id, username, created_at) VALUES (?, 'Bob', ?)", [PLAYER_TWO, Date.now()]);
    await db.execute("INSERT INTO accounts (user_id, email, normalized_email, normalized_username, password_hash) VALUES (?, 'bob@example.test', 'bob@example.test', 'bob', 'test')", [PLAYER_TWO]);
  });

  test('Wheel spin generates valid slice and question prompt', async () => {
    const host = await createGame(db, PLAYER_ONE, PLAYER_TWO, ['default'], CLASSIC_CATEGORIES);
    const spin = await spinWheel(db, host.gameId, PLAYER_ONE);
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
      expect(typeof state?.activeQuestion?.id).toBe('string');
    }
  });


  test('Correct answer increments crown gauge and retains turn', async () => {
    const host = await createGame(db, PLAYER_ONE, PLAYER_TWO, ['default'], CLASSIC_CATEGORIES);

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
    const result = await answerQuestion(db, host.gameId, PLAYER_ONE, questionId, 1, 3500);
    expect(result.wasCorrect).toBe(true);
    expect(result.turnContinued).toBe(true);
    expect(result.nextPlayerId).toBe(PLAYER_ONE);

    const state = await getGameStateSync(db, host.gameId);
    expect(state?.players.p1.crownGauge).toBe(1);
    expect(state?.currentTurnPlayerId).toBe(PLAYER_ONE);
    expect(state?.mode).toBe('SPIN');
  });

  test('Reaching 3 gauge points triggers CROWN_CHOICE', async () => {
    const host = await createGame(db, PLAYER_ONE, PLAYER_TWO, ['default'], CLASSIC_CATEGORIES);
    

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

    const result = await answerQuestion(db, host.gameId, PLAYER_ONE, questionId, 2, 2000);
    expect(result.wasCorrect).toBe(true);

    const state = await getGameStateSync(db, host.gameId);
    expect(state?.mode).toBe('CROWN_CHOICE');
    expect(state?.players.p1.crownGauge).toBe(0); // Gauge resets
  });

  test('Crown claim awards character crown upon correct answer', async () => {
    const host = await createGame(db, PLAYER_ONE, PLAYER_TWO, ['default'], CLASSIC_CATEGORIES);
    

    await db.execute(`UPDATE games SET active_mode = 'CROWN_CHOICE' WHERE id = ?`, [host.gameId]);

    // Alice chooses to claim HISTORY crown
    await chooseCrown(db, host.gameId, PLAYER_ONE, 'claim', 'HISTORY');

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
      PLAYER_ONE,
      stored.questionData.id,
      stored.correctIndex,
      1500
    );

    expect(result.wasCorrect).toBe(true);
    expect(result.awardedCrown).toBe('HISTORY');

    state = await getGameStateSync(db, host.gameId);
    expect(state?.players.p1.crowns).toContain('HISTORY');
    expect(state?.currentTurnPlayerId).toBe(PLAYER_ONE); // Still Alice's turn
  });

  test("Incorrect answers preserve each player's gauge across turn changes", async () => {
    const host = await createGame(db, PLAYER_ONE, PLAYER_TWO, ['default'], CLASSIC_CATEGORIES);

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
    const result = await answerQuestion(db, host.gameId, PLAYER_ONE, questionId, 0, 4000);
    expect(result.wasCorrect).toBe(false);
    expect(result.turnContinued).toBe(false);
    expect(result.nextPlayerId).toBe(PLAYER_TWO);

    const state = await getGameStateSync(db, host.gameId);
    expect(state?.players.p1.crownGauge).toBe(2);
    expect(state?.players.p2?.crownGauge).toBe(0);
    const persistedGame = await db.queryFirst<{ crown_gauge: number }>(
      'SELECT crown_gauge FROM games WHERE id = ?',
      [host.gameId]
    );
    expect(persistedGame?.crown_gauge).toBe(0);
    const parkedGauge = await db.queryFirst<{ other_crown_gauge: number }>(
      'SELECT other_crown_gauge FROM games WHERE id = ?', [host.gameId]
    );
    expect(parkedGauge?.other_crown_gauge).toBe(2);

    // The opponent earns a point, then misses: both players keep their progress.
    await db.execute(
      "UPDATE games SET crown_gauge = 1, active_mode = 'QUESTION', active_question_json = ? WHERE id = ?",
      [JSON.stringify({ ...stored, questionData: { ...stored.questionData, id: 'opponent-question' } }), host.gameId]
    );
    await answerQuestion(db, host.gameId, PLAYER_TWO, 'opponent-question', 0, 4000);
    const returnedState = await getGameStateSync(db, host.gameId);
    expect(returnedState?.currentTurnPlayerId).toBe(PLAYER_ONE);
    expect(returnedState?.players.p1.crownGauge).toBe(2);
    expect(returnedState?.players.p2?.crownGauge).toBe(1);
    expect(state?.currentTurnPlayerId).toBe(PLAYER_TWO);
    expect(state?.mode).toBe('SPIN');
  });

  test('a question can be submitted only once when duplicate answers race', async () => {
    const { gameId } = await createGame(db, PLAYER_ONE, PLAYER_TWO, ['default'], CLASSIC_CATEGORIES);
    const questionId = 'race_question';
    const stored = {
      questionData: {
        id: questionId,
        packId: 'default',
        category: 'SCIENCE' as Category,
        question: 'Which planet is known as the Red Planet?',
        correctAnswer: 'Mars',
        incorrectAnswers: ['Venus', 'Jupiter', 'Mercury'],
        difficulty: 'easy' as const
      },
      shuffledOptions: ['Venus', 'Mars', 'Jupiter', 'Mercury'],
      correctIndex: 1,
      startedAt: Date.now(),
      durationMs: 20000,
      isCrown: false
    };
    await db.execute(
      `UPDATE games SET active_mode = 'QUESTION', active_question_json = ? WHERE id = ?`,
      [JSON.stringify(stored), gameId]
    );

    const submissions = await Promise.allSettled([
      answerQuestion(db, gameId, PLAYER_ONE, questionId, 1, 4000),
      answerQuestion(db, gameId, PLAYER_ONE, questionId, 1, 4000)
    ]);
    const state = await getGameStateSync(db, gameId);
    const answers = await db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM game_answers WHERE game_id = ? AND question_id = ?',
      [gameId, questionId]
    );

    expect(submissions.filter((submission) => submission.status === 'fulfilled')).toHaveLength(1);
    expect(submissions.filter((submission) => submission.status === 'rejected')).toHaveLength(1);
    expect(answers[0]?.count).toBe(1);
    expect(state?.players.p1.crownGauge).toBe(1);
  });

  test('Steal Challenge: challenger steals crown on correct answer', async () => {
    const host = await createGame(db, PLAYER_ONE, PLAYER_TWO, ['default'], CLASSIC_CATEGORIES);

    // Give Alice ART crown and Bob SCIENCE crown
    await db.execute(
      `INSERT INTO game_crowns (game_id, player_id, category, created_at)
       VALUES (?, ?, 'ART', ?), (?, ?, 'SCIENCE', ?)`,
      [host.gameId, PLAYER_ONE, Date.now(), host.gameId, PLAYER_TWO, Date.now()]
    );

    // Set Bob's turn in CROWN_CHOICE
    await db.execute(
      `UPDATE games SET current_turn_player_id = ?, active_mode = 'CROWN_CHOICE' WHERE id = ?`,
      [PLAYER_TWO, host.gameId]
    );

    // Bob challenges Alice for ART crown, wagering his SCIENCE crown
    await chooseCrown(db, host.gameId, PLAYER_TWO, 'steal', 'ART', 'SCIENCE');

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
      PLAYER_TWO,
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
    const host = await createGame(db, PLAYER_ONE, PLAYER_TWO, ['default'], CLASSIC_CATEGORIES);
    

    // Give Alice 5 crowns already
    const fiveCrowns: Category[] = ['ART', 'SCIENCE', 'SPORTS', 'ENTERTAINMENT', 'GEOGRAPHY'];
    for (const c of fiveCrowns) {
      await db.execute(
        'INSERT INTO game_crowns (game_id, player_id, category, created_at) VALUES (?, ?, ?, ?)',
        [host.gameId, PLAYER_ONE, c, Date.now()]
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

    await answerQuestion(db, host.gameId, PLAYER_ONE, 'his_1', 1, 2000);

    const state = await getGameStateSync(db, host.gameId);
    expect(state?.status).toBe('COMPLETED');
    expect(state?.mode).toBe('GAME_OVER');
    expect(state?.winnerId).toBe(PLAYER_ONE);
    expect(state?.players.p1.crowns.length).toBe(6);
  });

  test('Resignation surrenders match to opponent', async () => {
    const host = await createGame(db, PLAYER_ONE, PLAYER_TWO, ['default'], CLASSIC_CATEGORIES);

    await resignGame(db, host.gameId, PLAYER_ONE);

    const state = await getGameStateSync(db, host.gameId);
    expect(state?.status).toBe('COMPLETED');
    expect(state?.mode).toBe('GAME_OVER');
    expect(state?.winnerId).toBe(PLAYER_TWO);
    expect(state?.winReason).toBe('Opponent surrendered');
  });
});
