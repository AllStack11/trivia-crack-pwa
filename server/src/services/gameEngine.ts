import type {
  Category,
  GameStateSync,
  PlayerState,
  QuestionData,
  QuestionResult,
  WheelSlice
} from '../../../shared/src/index';
import { WHEEL_SLICES } from '../../../shared/src/index';
import type { AppDatabase } from '../db/database';
import { getRandomQuestion } from './packService';

interface DbGameRow {
  id: string;
  invite_code: string;
  player1_id: string;
  player2_id: string | null;
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
  current_turn_player_id: string;
  crown_gauge: number;
  round_number: number;
  max_rounds: number;
  active_question_json: string | null;
  active_mode: 'SPIN' | 'SPINNING' | 'QUESTION' | 'CROWN_CHOICE' | 'RESULT' | 'GAME_OVER';
  winner_id: string | null;
  win_reason: string | null;
  pack_ids_json: string;
  last_spin_json: string | null;
  last_result_json: string | null;
  created_at: number;
  updated_at: number;
}

interface DbUserRow {
  id: string;
  username: string;
  created_at: number;
}

interface StoredActiveQuestion {
  questionData: QuestionData;
  shuffledOptions: string[];
  correctIndex: number;
  startedAt: number;
  durationMs: number;
  isCrown: boolean;
  crownCategory?: Category;
  isSteal?: boolean;
  targetPlayerId?: string;
  wagerCategory?: Category;
}

const ALL_CATEGORIES: Category[] = [
  'ART',
  'SCIENCE',
  'SPORTS',
  'ENTERTAINMENT',
  'GEOGRAPHY',
  'HISTORY'
];


/**
 * Fisher-Yates array shuffle
 */
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Create an account-owned two-player match.
 */
export async function createGame(
  db: AppDatabase,
  player1Id: string,
  player2Id: string,
  packIds: string[] = ['default']
): Promise<{ gameId: string }> {
  if (player1Id === player2Id) throw new Error('A match requires two different players');
  const users = await db.query<{ id: string }>(
    'SELECT id FROM users WHERE id IN (?, ?)',
    [player1Id, player2Id]
  );
  if (users.length !== 2) throw new Error('Both players must have accounts');
  const gameId = `game_${crypto.randomUUID()}`;
  const now = Date.now();
  await db.execute(
    `INSERT INTO games (
      id, invite_code, player1_id, player2_id, status, current_turn_player_id,
      crown_gauge, round_number, max_rounds, active_question_json, active_mode,
      winner_id, win_reason, pack_ids_json, last_result_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'IN_PROGRESS', ?, 0, 1, 25, NULL, 'SPIN', NULL, NULL, ?, NULL, ?, ?)`,
    [gameId, `LEGACY-${crypto.randomUUID()}`, player1Id, player2Id, player1Id, JSON.stringify(packIds.length ? packIds : ['default']), now, now]
  );
  return { gameId };
}

/**
 * Spin the 7-slice wheel
 */
export async function spinWheel(
  db: AppDatabase,
  gameId: string,
  playerId: string
): Promise<{ sliceIndex: number; slice: WheelSlice; targetDegrees: number }> {
  const game = await db.queryFirst<DbGameRow>('SELECT * FROM games WHERE id = ?', [gameId]);
  if (!game) throw new Error('Game not found');

  if (game.status !== 'IN_PROGRESS') {
    throw new Error('Game is not active');
  }

  if (game.current_turn_player_id !== playerId) {
    throw new Error('It is not your turn to spin');
  }

  if (game.active_mode !== 'SPIN') {
    throw new Error('Wheel cannot be spun right now');
  }

  // 7 slices: [GEOGRAPHY, SCIENCE, HISTORY, SPORTS, ART, ENTERTAINMENT, CROWN]
  const sliceIndex = Math.floor(Math.random() * WHEEL_SLICES.length);
  const landedSlice = WHEEL_SLICES[sliceIndex];

  // Calculate target rotation angle for smooth animation
  const sliceArc = 360 / 7;
  const sliceCenter = sliceIndex * sliceArc + sliceArc / 2;
  const extraRotations = (4 + Math.floor(Math.random() * 3)) * 360;
  const targetDegrees = extraRotations + ((270 - sliceCenter + 360) % 360);
  const lastSpinPayload = JSON.stringify({ targetDegrees, slice: landedSlice });

  let packIds: string[] = ['default'];
  try {
    packIds = JSON.parse(game.pack_ids_json) as string[];
  } catch {
    packIds = ['default'];
  }

  const now = Date.now();

  if (landedSlice === 'CROWN') {
    // Transition directly to Crown Choice
    await db.execute(
      `UPDATE games
       SET active_mode = 'CROWN_CHOICE', active_question_json = NULL,
           last_spin_json = ?, updated_at = ?
       WHERE id = ?`,
      [lastSpinPayload, now, gameId]
    );
  } else {
    // Category question
    const answeredIds = (
      await db.query<{ question_id: string }>(
        'SELECT question_id FROM game_answers WHERE game_id = ?',
        [gameId]
      )
    ).map((r) => r.question_id);

    const question = await getRandomQuestion(db, packIds, landedSlice, answeredIds);
    const options = shuffleArray([question.correctAnswer, ...question.incorrectAnswers]);
    const correctIndex = options.indexOf(question.correctAnswer);

    const storedQuestion: StoredActiveQuestion = {
      questionData: question,
      shuffledOptions: options,
      correctIndex,
      startedAt: now,
      durationMs: 20000,
      isCrown: false
    };

    await db.execute(
      `UPDATE games
       SET active_mode = 'QUESTION', active_question_json = ?,
           last_spin_json = ?, updated_at = ?
       WHERE id = ?`,
      [JSON.stringify(storedQuestion), lastSpinPayload, now, gameId]
    );
  }

  return {
    sliceIndex,
    slice: landedSlice,
    targetDegrees
  };
}

/**
 * Handle Crown Choice (Claim or Steal)
 */
export async function chooseCrown(
  db: AppDatabase,
  gameId: string,
  playerId: string,
  action: 'claim' | 'steal',
  chosenCategory: Category,
  wagerCategory?: Category
): Promise<void> {
  const game = await db.queryFirst<DbGameRow>('SELECT * FROM games WHERE id = ?', [gameId]);
  if (!game) throw new Error('Game not found');

  if (game.current_turn_player_id !== playerId) {
    throw new Error('It is not your turn');
  }

  if (game.active_mode !== 'CROWN_CHOICE') {
    throw new Error('Not currently in crown selection mode');
  }

  const opponentId = game.player1_id === playerId ? game.player2_id : game.player1_id;
  if (!opponentId) {
    throw new Error('Opponent not found');
  }

  const playerCrowns = (
    await db.query<{ category: Category }>(
      'SELECT category FROM game_crowns WHERE game_id = ? AND player_id = ?',
      [gameId, playerId]
    )
  ).map((r) => r.category);

  const opponentCrowns = (
    await db.query<{ category: Category }>(
      'SELECT category FROM game_crowns WHERE game_id = ? AND player_id = ?',
      [gameId, opponentId]
    )
  ).map((r) => r.category);

  if (action === 'steal') {
    if (playerCrowns.length === 0) {
      throw new Error('You must possess at least one crown to challenge a steal');
    }
    if (!wagerCategory || !playerCrowns.includes(wagerCategory)) {
      throw new Error('Invalid wager crown specified');
    }
    if (!opponentCrowns.includes(chosenCategory)) {
      throw new Error('Opponent does not possess the chosen crown to steal');
    }
  } else {
    // Claim mode
    if (playerCrowns.includes(chosenCategory)) {
      throw new Error('You already possess this crown character');
    }
  }

  let packIds: string[] = ['default'];
  try {
    packIds = JSON.parse(game.pack_ids_json) as string[];
  } catch {
    packIds = ['default'];
  }

  const answeredIds = (
    await db.query<{ question_id: string }>(
      'SELECT question_id FROM game_answers WHERE game_id = ?',
      [gameId]
    )
  ).map((r) => r.question_id);

  const question = await getRandomQuestion(db, packIds, chosenCategory, answeredIds);
  const options = shuffleArray([question.correctAnswer, ...question.incorrectAnswers]);
  const correctIndex = options.indexOf(question.correctAnswer);
  const now = Date.now();

  const storedQuestion: StoredActiveQuestion = {
    questionData: question,
    shuffledOptions: options,
    correctIndex,
    startedAt: now,
    durationMs: 20000,
    isCrown: true,
    crownCategory: chosenCategory,
    isSteal: action === 'steal',
    targetPlayerId: opponentId,
    wagerCategory
  };

  await db.execute(
    `UPDATE games
     SET active_mode = 'QUESTION', active_question_json = ?, updated_at = ?
     WHERE id = ?`,
    [JSON.stringify(storedQuestion), now, gameId]
  );
}

/**
 * Submit and evaluate an answer
 */
export async function answerQuestion(
  db: AppDatabase,
  gameId: string,
  playerId: string,
  questionId: string,
  answerIndex: number,
  timeSpentMs: number
): Promise<QuestionResult> {
  const game = await db.queryFirst<DbGameRow>('SELECT * FROM games WHERE id = ?', [gameId]);
  if (!game) throw new Error('Game not found');

  if (game.current_turn_player_id !== playerId) {
    throw new Error('It is not your turn');
  }

  if (game.active_mode !== 'QUESTION' || !game.active_question_json) {
    throw new Error('No question is currently active');
  }

  let stored: StoredActiveQuestion;
  try {
    stored = JSON.parse(game.active_question_json) as StoredActiveQuestion;
  } catch {
    throw new Error('Corrupted question data');
  }

  if (stored.questionData.id !== questionId) {
    throw new Error('Question mismatch');
  }

  const opponentId = game.player1_id === playerId ? game.player2_id : game.player1_id;
  const isTimeout = timeSpentMs > stored.durationMs + 3000; // 3s latency tolerance
  const wasCorrect = !isTimeout && answerIndex === stored.correctIndex;
  const now = Date.now();

  // Record answer in log
  const answerLogId = `ans_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await db.execute(
    `INSERT INTO game_answers (id, game_id, player_id, question_id, is_correct, time_spent_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [answerLogId, gameId, playerId, questionId, wasCorrect ? 1 : 0, timeSpentMs, now]
  );

  let awardedCrown: Category | undefined;
  let stolenCrown: Category | undefined;
  let lostCrown: Category | undefined;
  let nextPlayerId = playerId;
  let turnContinued = false;
  let nextCrownGauge = game.crown_gauge;
  let nextMode: DbGameRow['active_mode'] = 'SPIN';
  let winnerId: string | null = null;
  let winReason: string | null = null;
  let roundNumber = game.round_number;

  if (wasCorrect) {
    if (stored.isCrown) {
      if (stored.isSteal && stored.crownCategory && stored.targetPlayerId) {
        // Steal success: opponent loses crown, challenger gains crown
        await db.execute(
          'DELETE FROM game_crowns WHERE game_id = ? AND player_id = ? AND category = ?',
          [gameId, stored.targetPlayerId, stored.crownCategory]
        );
        await db.execute(
          'INSERT OR IGNORE INTO game_crowns (game_id, player_id, category, created_at) VALUES (?, ?, ?, ?)',
          [gameId, playerId, stored.crownCategory, now]
        );
        stolenCrown = stored.crownCategory;
      } else if (stored.crownCategory) {
        // Claim crown success
        await db.execute(
          'INSERT OR IGNORE INTO game_crowns (game_id, player_id, category, created_at) VALUES (?, ?, ?, ?)',
          [gameId, playerId, stored.crownCategory, now]
        );
        awardedCrown = stored.crownCategory;
      }

      nextCrownGauge = 0;
      turnContinued = true;
      nextPlayerId = playerId;
      nextMode = 'SPIN';
    } else {
      // Regular category question correct: +1 to crown gauge
      nextCrownGauge = game.crown_gauge + 1;
      if (nextCrownGauge >= 3) {
        // Crown threshold reached! Prompt for crown choice
        nextCrownGauge = 0;
        turnContinued = true;
        nextPlayerId = playerId;
        nextMode = 'CROWN_CHOICE';
      } else {
        turnContinued = true;
        nextPlayerId = playerId;
        nextMode = 'SPIN';
      }
    }

    // Check 6-crown victory condition for active player
    const crownsAfter = (
      await db.query<{ category: Category }>(
        'SELECT category FROM game_crowns WHERE game_id = ? AND player_id = ?',
        [gameId, playerId]
      )
    ).map((r) => r.category);

    if (crownsAfter.length >= 6) {
      winnerId = playerId;
      winReason = 'Collected all 6 Crown Characters!';
      nextMode = 'GAME_OVER';
    }
  } else {
    // Incorrect answer or timeout
    nextCrownGauge = 0;
    turnContinued = false;
    nextPlayerId = opponentId || playerId;
    nextMode = 'SPIN';

    // If challenger failed a steal, forfeit wagered crown to opponent!
    if (stored.isCrown && stored.isSteal && stored.wagerCategory && opponentId) {
      await db.execute(
        'DELETE FROM game_crowns WHERE game_id = ? AND player_id = ? AND category = ?',
        [gameId, playerId, stored.wagerCategory]
      );
      await db.execute(
        'INSERT OR IGNORE INTO game_crowns (game_id, player_id, category, created_at) VALUES (?, ?, ?, ?)',
        [gameId, opponentId, stored.wagerCategory, now]
      );
      lostCrown = stored.wagerCategory;

      // Check if defender now reached 6 crowns from forfeited crown
      const oppCrowns = (
        await db.query<{ category: Category }>(
          'SELECT category FROM game_crowns WHERE game_id = ? AND player_id = ?',
          [gameId, opponentId]
        )
      ).map((r) => r.category);

      if (oppCrowns.length >= 6) {
        winnerId = opponentId;
        winReason = 'Collected all 6 Crown Characters!';
        nextMode = 'GAME_OVER';
      }
    }

    // Advance round number when turn returns to Player 1
    if (playerId === game.player2_id) {
      roundNumber += 1;
      if (roundNumber > game.max_rounds && !winnerId) {
        // Round limit reached: decide winner by crown count, then score
        const p1Crowns = (
          await db.query<{ category: Category }>(
            'SELECT category FROM game_crowns WHERE game_id = ? AND player_id = ?',
            [gameId, game.player1_id]
          )
        ).length;
        const p2Crowns = (
          await db.query<{ category: Category }>(
            'SELECT category FROM game_crowns WHERE game_id = ? AND player_id = ?',
            [gameId, game.player2_id || '']
          )
        ).length;

        if (p1Crowns > p2Crowns) {
          winnerId = game.player1_id;
          winReason = `Won on crowns after ${game.max_rounds} rounds (${p1Crowns} vs ${p2Crowns})`;
        } else if (p2Crowns > p1Crowns) {
          winnerId = game.player2_id;
          winReason = `Won on crowns after ${game.max_rounds} rounds (${p2Crowns} vs ${p1Crowns})`;
        } else {
          // Tiebreaker: total correct answers
          const p1Score = (
            await db.queryFirst<{ score: number }>(
              'SELECT COUNT(*) as score FROM game_answers WHERE game_id = ? AND player_id = ? AND is_correct = 1',
              [gameId, game.player1_id]
            )
          )?.score || 0;
          const p2Score = (
            await db.queryFirst<{ score: number }>(
              'SELECT COUNT(*) as score FROM game_answers WHERE game_id = ? AND player_id = ? AND is_correct = 1',
              [gameId, game.player2_id || '']
            )
          )?.score || 0;

          if (p1Score >= p2Score) {
            winnerId = game.player1_id;
            winReason = `Won tiebreaker with ${p1Score} correct answers!`;
          } else {
            winnerId = game.player2_id;
            winReason = `Won tiebreaker with ${p2Score} correct answers!`;
          }
        }
        nextMode = 'GAME_OVER';
      }
    }
  }

  const result: QuestionResult = {
    wasCorrect,
    correctIndex: stored.correctIndex,
    correctAnswer: stored.shuffledOptions[stored.correctIndex],
    selectedOption: answerIndex >= 0 ? stored.shuffledOptions[answerIndex] : undefined,
    awardedCrown,
    stolenCrown,
    lostCrown,
    nextPlayerId,
    turnContinued
  };

  const status = winnerId ? 'COMPLETED' : 'IN_PROGRESS';

  await db.execute(
    `UPDATE games
     SET current_turn_player_id = ?, crown_gauge = ?, round_number = ?,
         status = ?, active_mode = ?, winner_id = ?, win_reason = ?,
         active_question_json = NULL, last_result_json = ?, updated_at = ?
     WHERE id = ?`,
    [
      nextPlayerId,
      nextCrownGauge,
      roundNumber,
      status,
      nextMode,
      winnerId,
      winReason,
      JSON.stringify(result),
      now,
      gameId
    ]
  );

  return result;
}

/**
 * Forfeit match
 */
export async function resignGame(
  db: AppDatabase,
  gameId: string,
  playerId: string
): Promise<void> {
  const game = await db.queryFirst<DbGameRow>('SELECT * FROM games WHERE id = ?', [gameId]);
  if (!game) throw new Error('Game not found');

  if (game.status === 'COMPLETED') return;

  const opponentId = game.player1_id === playerId ? game.player2_id : game.player1_id;
  const now = Date.now();

  await db.execute(
    `UPDATE games
     SET status = 'COMPLETED', active_mode = 'GAME_OVER', winner_id = ?,
         win_reason = 'Opponent surrendered', updated_at = ?
     WHERE id = ?`,
    [opponentId, now, gameId]
  );
}

/**
 * Build GameStateSync snapshot for clients
 */
export async function getGameStateSync(
  db: AppDatabase,
  gameId: string
): Promise<GameStateSync | null> {
  const game = await db.queryFirst<DbGameRow>('SELECT * FROM games WHERE id = ?', [gameId]);
  if (!game) return null;

  const p1User = await db.queryFirst<DbUserRow>('SELECT * FROM users WHERE id = ?', [game.player1_id]);
  const p2User = game.player2_id
    ? await db.queryFirst<DbUserRow>('SELECT * FROM users WHERE id = ?', [game.player2_id])
    : null;

  const p1Crowns = (
    await db.query<{ category: Category }>(
      'SELECT category FROM game_crowns WHERE game_id = ? AND player_id = ?',
      [gameId, game.player1_id]
    )
  ).map((r) => r.category);

  const p2Crowns = game.player2_id
    ? (
        await db.query<{ category: Category }>(
          'SELECT category FROM game_crowns WHERE game_id = ? AND player_id = ?',
          [gameId, game.player2_id]
        )
      ).map((r) => r.category)
    : [];

  const p1Score = (
    await db.queryFirst<{ score: number }>(
      'SELECT COUNT(*) as score FROM game_answers WHERE game_id = ? AND player_id = ? AND is_correct = 1',
      [gameId, game.player1_id]
    )
  )?.score || 0;

  const p2Score = game.player2_id
    ? (
        await db.queryFirst<{ score: number }>(
          'SELECT COUNT(*) as score FROM game_answers WHERE game_id = ? AND player_id = ? AND is_correct = 1',
          [gameId, game.player2_id]
        )
      )?.score || 0
    : 0;

  const p1State: PlayerState = {
    id: game.player1_id,
    username: p1User?.username || 'Player 1',
    crowns: p1Crowns,
    crownGauge: game.current_turn_player_id === game.player1_id ? game.crown_gauge : 0,
    isConnected: true,
    score: p1Score
  };

  const p2State: PlayerState | null = p2User
    ? {
        id: p2User.id,
        username: p2User.username,
        crowns: p2Crowns,
        crownGauge: game.current_turn_player_id === p2User.id ? game.crown_gauge : 0,
        isConnected: true,
        score: p2Score
      }
    : null;

  let activeQuestionSync;
  if (game.active_question_json) {
    try {
      const stored = JSON.parse(game.active_question_json) as StoredActiveQuestion;
      activeQuestionSync = {
        id: stored.questionData.id,
        category: stored.questionData.category,
        question: stored.questionData.question,
        imageUrl: stored.questionData.imageUrl,
        options: stored.shuffledOptions,
        durationMs: stored.durationMs,
        startedAt: stored.startedAt,
        isCrown: stored.isCrown,
        crownCategory: stored.crownCategory,
        isSteal: stored.isSteal,
        targetPlayerId: stored.targetPlayerId,
        wagerCategory: stored.wagerCategory
      };
    } catch {
      // Ignored
    }
  }

  let lastResult: QuestionResult | undefined;
  if (game.last_result_json) {
    try {
      lastResult = JSON.parse(game.last_result_json) as QuestionResult;
    } catch {
      // Ignored
    }
  }

  let lastSpin: { targetDegrees: number; slice: WheelSlice } | undefined;
  if (game.last_spin_json) {
    try {
      lastSpin = JSON.parse(game.last_spin_json) as { targetDegrees: number; slice: WheelSlice };
    } catch {
      // Ignored
    }
  }

  return {
    id: game.id,
    status: game.status,
    players: {
      p1: p1State,
      p2: p2State
    },
    currentTurnPlayerId: game.current_turn_player_id,
    roundNumber: game.round_number,
    maxRounds: game.max_rounds,
    mode: game.active_mode,
    activeQuestion: activeQuestionSync,
    lastSpin,
    lastResult,
    winnerId: game.winner_id || undefined,
    winReason: game.win_reason || undefined,
    updatedAt: game.updated_at
  };
}
