import type {
  ActiveQuestionSync,
  Category,
  GameStateSync,
  PlayerState,
  QuestionData,
  QuestionResult,
  WheelSlice
} from '../../../shared/src/index';
import { WHEEL_SLICES, WHEEL_SPIN_DURATION_MS, SPIN_RESULT_HOLD_MS, QUESTION_DURATION_MS, QUESTION_ANSWER_GRACE_MS } from '../../../shared/src/index';
import { commitGameMutation, type GameStatement } from './gameMutation';
import type { AppDatabase } from '../db/database';
import { getRandomQuestion } from './packService';

interface DbGameRow {
  id: string;
  revision: number;
  invite_code: string;
  player1_id: string;
  player2_id: string | null;
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
  current_turn_player_id: string;
  crown_gauge: number;
  other_crown_gauge: number; // Progress belonging to the player whose turn is inactive
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
  const lastSpinPayload = JSON.stringify({ id: crypto.randomUUID(), targetDegrees, slice: landedSlice });

  let packIds: string[] = ['default'];
  try {
    packIds = JSON.parse(game.pack_ids_json) as string[];
  } catch {
    packIds = ['default'];
  }

  const now = Date.now();

  if (landedSlice === 'CROWN') {
    // Transition directly to Crown Choice
    await commitGameMutation(db, gameId, game.revision, [{ sql: `UPDATE games
       SET active_mode = 'CROWN_CHOICE', active_question_json = NULL,
           last_spin_json = ?, last_result_json = NULL, updated_at = ?
       WHERE id = ?`, params: [lastSpinPayload, now, gameId] }]);
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
      startedAt: Date.now() + WHEEL_SPIN_DURATION_MS + SPIN_RESULT_HOLD_MS,
      durationMs: QUESTION_DURATION_MS,
      isCrown: false
    };

    await commitGameMutation(db, gameId, game.revision, [{ sql: `UPDATE games
       SET active_mode = 'QUESTION', active_question_json = ?,
           last_spin_json = ?, last_result_json = NULL, updated_at = ?
       WHERE id = ?`, params: [JSON.stringify(storedQuestion), lastSpinPayload, now, gameId] }]);
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

  if (game.status !== 'IN_PROGRESS') throw new Error('Game is not active');
  if (!ALL_CATEGORIES.includes(chosenCategory) || !['claim', 'steal'].includes(action)) throw new Error('Invalid crown choice');

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
    durationMs: QUESTION_DURATION_MS,
    isCrown: true,
    crownCategory: chosenCategory,
    isSteal: action === 'steal',
    targetPlayerId: opponentId,
    wagerCategory
  };

  await commitGameMutation(db, gameId, game.revision, [{ sql: `UPDATE games
     SET active_mode = 'QUESTION', active_question_json = ?,
         last_result_json = NULL, updated_at = ?
     WHERE id = ?`, params: [JSON.stringify(storedQuestion), now, gameId] }]);
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

  if (game.status !== 'IN_PROGRESS') throw new Error('Game is not active');
  if (!Number.isInteger(answerIndex) || answerIndex < -1) throw new Error('Invalid answer index');

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

  if (answerIndex >= stored.shuffledOptions.length) throw new Error('Invalid answer index');
  const opponentId = game.player1_id === playerId ? game.player2_id : game.player1_id;
  const now = Date.now();
  // Client timing is telemetry only; the persisted deadline decides correctness.
  const elapsedMs = Math.max(0, now - stored.startedAt);
  const isTimeout = elapsedMs > stored.durationMs + QUESTION_ANSWER_GRACE_MS;
  const wasCorrect = !isTimeout && answerIndex === stored.correctIndex;
  const answerLogId = 'ans_' + crypto.randomUUID();
  const statements: GameStatement[] = [
    { sql: 'INSERT INTO game_answer_claims (game_id, question_id) VALUES (?, ?)', params: [gameId, questionId] },
    { sql: 'INSERT INTO game_answers (id, game_id, player_id, question_id, is_correct, time_spent_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params: [answerLogId, gameId, playerId, questionId, wasCorrect ? 1 : 0, elapsedMs, now] }
  ];
  void timeSpentMs;
  const crownRows = await db.query<{ player_id: string; category: Category }>(
    'SELECT player_id, category FROM game_crowns WHERE game_id = ?', [gameId]
  );
  const crowns = new Map<string, Set<Category>>();
  for (const row of crownRows) {
    if (!crowns.has(row.player_id)) crowns.set(row.player_id, new Set());
    crowns.get(row.player_id)!.add(row.category);
  }
  const changeCrown = (owner: string, category: Category, remove = false) => {
    if (!crowns.has(owner)) crowns.set(owner, new Set());
    if (remove) {
      crowns.get(owner)!.delete(category);
      statements.push({ sql: 'DELETE FROM game_crowns WHERE game_id = ? AND player_id = ? AND category = ?', params: [gameId, owner, category] });
    } else {
      crowns.get(owner)!.add(category);
      statements.push({ sql: 'INSERT OR IGNORE INTO game_crowns (game_id, player_id, category, created_at) VALUES (?, ?, ?, ?)', params: [gameId, owner, category, now] });
    }
  };

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
        changeCrown(stored.targetPlayerId, stored.crownCategory, true);
        changeCrown(playerId, stored.crownCategory);
        stolenCrown = stored.crownCategory;
      } else if (stored.crownCategory) {
        // Claim crown success
        changeCrown(playerId, stored.crownCategory);
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
    const crownsAfter = Array.from(crowns.get(playerId) || []);

    if (crownsAfter.length >= 6) {
      winnerId = playerId;
      winReason = 'Collected all 6 Crown Characters!';
      nextMode = 'GAME_OVER';
    }
  } else {
    // Incorrect answers and timeouts preserve the answering player's progress.
    turnContinued = false;
    nextPlayerId = opponentId || playerId;
    nextMode = 'SPIN';

    // If challenger failed a steal, forfeit wagered crown to opponent!
    if (stored.isCrown && stored.isSteal && stored.wagerCategory && opponentId) {
      changeCrown(playerId, stored.wagerCategory, true);
      changeCrown(opponentId, stored.wagerCategory);
      lostCrown = stored.wagerCategory;

      // Check if defender now reached 6 crowns from forfeited crown
      const oppCrowns = Array.from(crowns.get(opponentId) || []);

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
        const p1Crowns = (crowns.get(game.player1_id)?.size || 0);
        const p2Crowns = (crowns.get(game.player2_id || '')?.size || 0);

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

  const questionSnapshot: ActiveQuestionSync = {
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

  const result: QuestionResult = {
    wasCorrect,
    correctIndex: stored.correctIndex,
    correctAnswer: stored.shuffledOptions[stored.correctIndex],
    selectedOption: answerIndex >= 0 ? stored.shuffledOptions[answerIndex] : undefined,
    question: questionSnapshot,
    awardedCrown,
    stolenCrown,
    lostCrown,
    nextPlayerId,
    turnContinued
  };

  const status = winnerId ? 'COMPLETED' : 'IN_PROGRESS';

  const changesPlayer = nextPlayerId !== playerId;
  statements.push({ sql: `UPDATE games
     SET current_turn_player_id = ?, crown_gauge = ?, other_crown_gauge = ?, round_number = ?,
         status = ?, active_mode = ?, winner_id = ?, win_reason = ?,
         active_question_json = NULL, last_result_json = ?, updated_at = ?
     WHERE id = ?`, params: [
      nextPlayerId,
      changesPlayer ? game.other_crown_gauge : nextCrownGauge,
      changesPlayer ? nextCrownGauge : game.other_crown_gauge,
      roundNumber,
      status,
      nextMode,
      winnerId,
      winReason,
      JSON.stringify(result),
      now,
      gameId
    ] });
  await commitGameMutation(db, gameId, game.revision, statements);

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

  if (game.player1_id !== playerId && game.player2_id !== playerId) throw new Error('Game not found');
  if (game.status === 'COMPLETED') return;

  const opponentId = game.player1_id === playerId ? game.player2_id : game.player1_id;
  const now = Date.now();

  await commitGameMutation(db, gameId, game.revision, [{ sql: `UPDATE games
     SET status = 'COMPLETED', active_mode = 'GAME_OVER', active_question_json = NULL, winner_id = ?,
         win_reason = 'Opponent surrendered', updated_at = ?
     WHERE id = ?`, params: [opponentId, now, gameId] }]);
}

export class GameSnapshotConflictError extends Error {
  constructor() { super('Game changed; refresh and try again'); }
}

/** Read a coherent snapshot, and resolve elapsed questions even if the player disconnected. */
export async function getGameStateSync(db: AppDatabase, gameId: string, options: { attempts?: number; resolveExpired?: boolean } = {}): Promise<GameStateSync | null> {
  for (let attempt = 0; attempt < (options.attempts ?? 5); attempt++) {
    const state = await buildGameStateSync(db, gameId);
    if (!state) return null;
    const question = state.activeQuestion;
    if (options.resolveExpired !== false && state.status === 'IN_PROGRESS' && state.mode === 'QUESTION' && question &&
        Date.now() > question.startedAt + question.durationMs + QUESTION_ANSWER_GRACE_MS) {
      try {
        await answerQuestion(db, gameId, state.currentTurnPlayerId, question.id, -1, 0);
      } catch (error) {
        const current = await db.queryFirst<{ revision: number }>('SELECT revision FROM games WHERE id = ?', [gameId]);
        if (current?.revision === state.revision) throw error;
      }
      continue;
    }
    const current = await db.queryFirst<{ revision: number }>('SELECT revision FROM games WHERE id = ?', [gameId]);
    if (current?.revision === state.revision) return state;
  }
  throw new GameSnapshotConflictError();
}

/**
 * Build GameStateSync snapshot for clients
 */
async function buildGameStateSync(
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
    crownGauge: game.current_turn_player_id === game.player1_id ? game.crown_gauge : game.other_crown_gauge,
    isConnected: true,
    score: p1Score
  };

  const p2State: PlayerState | null = p2User
    ? {
        id: p2User.id,
        username: p2User.username,
        crowns: p2Crowns,
        crownGauge: game.current_turn_player_id === p2User.id ? game.crown_gauge : game.other_crown_gauge,
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
  if (
    game.last_result_json &&
    game.active_mode !== 'QUESTION' &&
    game.active_mode !== 'SPINNING'
  ) {
    try {
      lastResult = JSON.parse(game.last_result_json) as QuestionResult;
    } catch {
      // Ignored
    }
  }

  let lastSpin: { id: string; targetDegrees: number; slice: WheelSlice } | undefined;
  if (game.last_spin_json) {
    try {
      lastSpin = JSON.parse(game.last_spin_json) as { id: string; targetDegrees: number; slice: WheelSlice };
    } catch {
      // Ignored
    }
  }

  return {
    id: game.id,
    revision: game.revision,
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
