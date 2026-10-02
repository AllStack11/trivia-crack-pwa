import { CATEGORIES, type Category, type QuestionData, type QuestionPackExport, type QuestionPackMeta } from '../../../shared/src/index';
import type { AppDatabase } from '../db/database';
import { CURATED_QUESTIONS } from './curatedQuestions';
import {
  expandPackQuestions,
  fetchTriviaQuestionsWithFallback
} from './triviaApiService';

interface DbPackRow {
  id: string;
  title: string;
  description: string | null;
  is_default: number;
  created_by: string | null;
  created_at: number;
  question_count?: number;
}

interface DbQuestionRow {
  id: string;
  pack_id: string;
  category: Category;
  question: string;
  image_url: string | null;
  correct_answer: string;
  incorrect_answers_json: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * Ensure default question pack and curated bank are seeded in database
 */
export async function ensureDefaultPackSeeded(db: AppDatabase): Promise<void> {
  const existing = await db.queryFirst<DbPackRow>(
    'SELECT id FROM question_packs WHERE id = ?',
    ['default']
  );

  if (!existing) {
    await db.execute(
      `INSERT OR IGNORE INTO question_packs (id, title, description, is_default, created_by, created_at)
       VALUES (?, ?, ?, 1, 'system', ?)`,
      ['default', 'Classic Trivia Clash Pack', 'Standard 180-question curated bank spanning all 6 classic categories with visual trivia', Date.now()]
    );
  }

  const countRow = await db.queryFirst<{ count: number }>(
    'SELECT COUNT(*) as count FROM questions WHERE pack_id = ?',
    ['default']
  );

  if (!countRow || countRow.count < 180) {
    for (const q of CURATED_QUESTIONS) {
      await db.execute(
        `INSERT OR IGNORE INTO questions (id, pack_id, category, question, image_url, correct_answer, incorrect_answers_json, difficulty)
         VALUES (?, 'default', ?, ?, ?, ?, ?, ?)`,
        [
          q.id,
          q.category,
          q.question,
          q.imageUrl || null,
          q.correctAnswer,
          JSON.stringify(q.incorrectAnswers),
          q.difficulty
        ]
      );
    }
  }
}

/**
 * List all available packs with question counts
 */
export async function listPacks(db: AppDatabase): Promise<QuestionPackMeta[]> {
  await ensureDefaultPackSeeded(db);
  const rows = await db.query<DbPackRow>(
    `SELECT p.*, COUNT(q.id) as question_count
     FROM question_packs p
     LEFT JOIN questions q ON p.id = q.pack_id
     GROUP BY p.id
     ORDER BY p.is_default DESC, p.created_at DESC`
  );

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description || '',
    isDefault: r.is_default === 1,
    questionCount: Number(r.question_count || 0),
    createdBy: r.created_by || undefined,
    createdAt: r.created_at
  }));
}

/**
 * Get single pack with its questions
 */
export async function getPack(
  db: AppDatabase,
  packId: string
): Promise<{ meta: QuestionPackMeta; questions: QuestionData[] } | null> {
  await ensureDefaultPackSeeded(db);
  const packRow = await db.queryFirst<DbPackRow>(
    'SELECT * FROM question_packs WHERE id = ?',
    [packId]
  );
  if (!packRow) return null;

  const questionRows = await db.query<DbQuestionRow>(
    'SELECT * FROM questions WHERE pack_id = ?',
    [packId]
  );

  const questions: QuestionData[] = questionRows.map((q) => {
    let incorrect: string[] = [];
    try {
      incorrect = JSON.parse(q.incorrect_answers_json) as string[];
    } catch {
      incorrect = [];
    }

    return {
      id: q.id,
      packId: q.pack_id,
      category: q.category,
      question: q.question,
      imageUrl: q.image_url || undefined,
      correctAnswer: q.correct_answer,
      incorrectAnswers: incorrect,
      difficulty: q.difficulty
    };
  });

  return {
    meta: {
      id: packRow.id,
      title: packRow.title,
      description: packRow.description || '',
      isDefault: packRow.is_default === 1,
      questionCount: questions.length,
      createdBy: packRow.created_by || undefined,
      createdAt: packRow.created_at
    },
    questions
  };
}

/**
 * Create a new custom question pack
 */
export async function createPack(
  db: AppDatabase,
  title: string,
  description: string = '',
  createdBy: string = 'User',
  questions: Omit<QuestionData, 'id' | 'packId'>[] = []
): Promise<string> {
  const packId = `pack_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await db.execute(
    `INSERT INTO question_packs (id, title, description, is_default, created_by, created_at)
     VALUES (?, ?, ?, 0, ?, ?)`,
    [packId, title.trim() || 'Untitled Pack', description.trim(), createdBy, Date.now()]
  );

  for (const q of questions) {
    const qId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.execute(
      `INSERT INTO questions (id, pack_id, category, question, image_url, correct_answer, incorrect_answers_json, difficulty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        qId,
        packId,
        q.category,
        q.question.trim(),
        q.imageUrl ? q.imageUrl.trim() : null,
        q.correctAnswer.trim(),
        JSON.stringify(q.incorrectAnswers.map((ans) => ans.trim())),
        q.difficulty || 'medium'
      ]
    );
  }

  return packId;
}

/**
 * Delete a custom question pack
 */
export async function deletePack(db: AppDatabase, packId: string): Promise<boolean> {
  if (packId === 'default') {
    return false; // Default pack cannot be deleted
  }
  await db.execute('DELETE FROM questions WHERE pack_id = ?', [packId]);
  const res = await db.execute('DELETE FROM question_packs WHERE id = ?', [packId]);
  return res.rowsAffected > 0;
}

/**
 * Export pack to JSON
 */
export async function exportPack(db: AppDatabase, packId: string): Promise<QuestionPackExport | null> {
  const pack = await getPack(db, packId);
  if (!pack) return null;

  return {
    id: pack.meta.id,
    title: pack.meta.title,
    description: pack.meta.description,
    questions: pack.questions.map((q) => ({
      category: q.category,
      question: q.question,
      imageUrl: q.imageUrl,
      correctAnswer: q.correctAnswer,
      incorrectAnswers: q.incorrectAnswers,
      difficulty: q.difficulty
    }))
  };
}

/**
 * Import pack from JSON payload
 */
export async function importPack(
  db: AppDatabase,
  data: QuestionPackExport,
  createdBy: string = 'User'
): Promise<string> {
  if (!data.title || typeof data.title !== 'string') {
    throw new Error('Pack title is required');
  }
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error('At least one valid question is required to import pack');
  }

  const validQuestions = data.questions.filter((q) => {
    return (
      q && typeof q === 'object' &&
      Object.hasOwn(CATEGORIES, q.category) &&
      typeof q.question === 'string' &&
      q.question.trim().length > 0 &&
      typeof q.correctAnswer === 'string' &&
      q.correctAnswer.trim().length > 0 &&
      Array.isArray(q.incorrectAnswers) &&
      q.incorrectAnswers.length >= 1
    );
  });

  if (validQuestions.length === 0) {
    throw new Error('No valid questions found in import data');
  }

  return createPack(
    db,
    data.title,
    data.description || 'Imported custom pack',
    createdBy,
    validQuestions.map((q) => ({
      category: q.category,
      question: q.question,
      imageUrl: q.imageUrl,
      correctAnswer: q.correctAnswer,
      incorrectAnswers: q.incorrectAnswers,
      difficulty: q.difficulty || 'medium'
    }))
  );
}

/**
 * Fetch a random unasked question for a match
 */
export async function getRandomQuestion(
  db: AppDatabase,
  packIds: string[],
  category: Category,
  excludeQuestionIds: string[] = []
): Promise<QuestionData> {
  await ensureDefaultPackSeeded(db);
  const activePacks = packIds.length > 0 ? packIds : ['default'];
  const placeholders = 'SELECT value FROM json_each(?)';

  let querySql = `
    SELECT * FROM questions
    WHERE pack_id IN (${placeholders})
    AND category = ?
  `;
  const queryParams: unknown[] = [JSON.stringify(activePacks), category];

  if (excludeQuestionIds.length > 0) {
    querySql += ' AND id NOT IN (SELECT value FROM json_each(?))';
    queryParams.push(JSON.stringify(excludeQuestionIds));
  }

  querySql += ' ORDER BY RANDOM() LIMIT 1';

  const row = await db.queryFirst<DbQuestionRow>(querySql, queryParams);
  if (row) {
    let incorrect: string[] = [];
    try {
      incorrect = JSON.parse(row.incorrect_answers_json) as string[];
    } catch {
      incorrect = [];
    }

    return {
      id: row.id,
      packId: row.pack_id,
      category: row.category,
      question: row.question,
      imageUrl: row.image_url || undefined,
      correctAnswer: row.correct_answer,
      incorrectAnswers: incorrect,
      difficulty: row.difficulty
    };
  }

  // If all local questions in this category have been exhausted, fetch dynamically with cache-first lookup
  const liveResult = await fetchLiveQuestions(category, 1, 'default', db, false, excludeQuestionIds);
  if (liveResult.questions.length > 0) {
    return liveResult.questions[0];
  }

  // Ultimate fallback to curated
  const fallback = CURATED_QUESTIONS.find((q) => q.category === category) || CURATED_QUESTIONS[0];
  return {
    ...fallback,
    // Once every source is exhausted, replay content as a new answerable occurrence.
    id: `replay_${crypto.randomUUID()}`,
    packId: 'default'
  };
}

/**
 * Expand a question pack with questions fetched from free trivia APIs with graceful fallback
 */
export async function expandPack(
  db: AppDatabase,
  packId: string,
  countPerCategory: number = 5,
  categories?: Category[],
  forceRefresh?: boolean
) {
  await ensureDefaultPackSeeded(db);
  return expandPackQuestions(db, packId, countPerCategory, categories, forceRefresh);
}

/**
 * Fetch live questions on demand with fallback across providers and multi-tier cache
 */
export async function fetchLiveQuestions(
  category: Category,
  amount: number = 5,
  packId: string = 'default',
  db?: AppDatabase,
  forceRefresh?: boolean,
  excludeQuestionIds?: string[]
) {
  return fetchTriviaQuestionsWithFallback({
    category,
    amount,
    packId,
    db,
    forceRefresh,
    excludeQuestionIds
  });
}
