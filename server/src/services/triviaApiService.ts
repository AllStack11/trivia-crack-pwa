import { shuffled } from './questionSelection';
import type { Category, QuestionData } from '../../../shared/src/index';
import type { AppDatabase } from '../db/database';
import { CURATED_QUESTIONS } from './curatedQuestions';
import {
  memoryCache,
  queryDbCachedQuestions,
  persistDbCachedQuestions,
  incrementDbServedCount,
  toQuestionData,
  normalizeQuestionText
} from './questionCache';

export { normalizeQuestionText };

export type TriviaProviderName =
  | 'cache:memory'
  | 'cache:db'
  | 'the-trivia-api-v2'
  | 'opentdb'
  | 'the-trivia-api-v1'
  | 'willfry'
  | 'curated-fallback';
// Automatic ingestion excludes the user-owned Custom pool.
export const CATEGORY_IDS: Exclude<Category, 'CUSTOM'>[] = [
  'ART',
  'SCIENCE',
  'SPORTS',
  'ENTERTAINMENT',
  'GEOGRAPHY',
  'HISTORY',
  'MEMES',
  'MOVIES_TV',
  'VIDEO_GAMES'
];

// OpenTDB category IDs
const OPENTDB_CATEGORY_MAP: Partial<Record<Category, number[]>> = {
  ART: [25],
  SCIENCE: [17, 18, 19],
  SPORTS: [21],
  ENTERTAINMENT: [11, 12, 14, 15],
  GEOGRAPHY: [22],
  HISTORY: [23],
  MEMES: [9],
  MOVIES_TV: [11, 14],
  VIDEO_GAMES: [15]
};

// The Trivia API (v1 / v2) category tags
const TRIVIA_API_CATEGORY_MAP: Partial<Record<Category, string>> = {
  ART: 'arts_and_literature',
  SCIENCE: 'science',
  SPORTS: 'sport_and_leisure',
  ENTERTAINMENT: 'film_and_tv,music',
  GEOGRAPHY: 'geography',
  HISTORY: 'history',
  MOVIES_TV: 'film_and_tv'
};

/**
 * Fast HTML entity decoder for OpenTDB and other web responses
 */
export function decodeHtmlEntities(text: string): string {
  if (!text || !text.includes('&')) return text || '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&eacute;/g, 'é')
    .replace(/&Eacute;/g, 'É')
    .replace(/&egrave;/g, 'è')
    .replace(/&agrave;/g, 'à')
    .replace(/&aacute;/g, 'á')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&uuml;/g, 'ü')
    .replace(/&ouml;/g, 'ö')
    .replace(/&auml;/g, 'ä')
    .replace(/&deg;/g, '°')
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rdquo;/g, '”')
    .replace(/&ldquo;/g, '“')
    .replace(/&hellip;/g, '…')
    .replace(/&shy;/g, '')
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isNaN(code) ? '' : String.fromCharCode(code);
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isNaN(code) ? '' : String.fromCharCode(code);
    });
}


interface RawQuestionCandidate {
  question: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  difficulty?: string;
}

function cleanAndValidateQuestions(
  rawList: RawQuestionCandidate[],
  category: Category,
  packId: string,
  prefix: string
): QuestionData[] {
  const result: QuestionData[] = [];
  const seenTexts = new Set<string>();

  for (const item of rawList) {
    const questionText = decodeHtmlEntities(item.question || '').trim();
    const correct = decodeHtmlEntities(item.correctAnswer || '').trim();
    if (!questionText || !correct) continue;

    const norm = normalizeQuestionText(questionText);
    if (seenTexts.has(norm)) continue;
    seenTexts.add(norm);

    // Validate incorrect answers
    const rawIncorrect = Array.isArray(item.incorrectAnswers) ? item.incorrectAnswers : [];
    const incorrect = rawIncorrect
      .map((ans) => decodeHtmlEntities(String(ans)).trim())
      .filter((ans) => ans && ans.toLowerCase() !== correct.toLowerCase());

    // Deduplicate incorrect options
    const uniqueIncorrect = Array.from(new Set(incorrect));
    if (uniqueIncorrect.length < 3) continue;

    const diff = (item.difficulty || 'medium').toLowerCase();
    const difficulty = diff === 'easy' || diff === 'hard' ? diff : 'medium';

    const qId = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    result.push({
      id: qId,
      packId,
      category,
      question: questionText,
      correctAnswer: correct,
      incorrectAnswers: uniqueIncorrect.slice(0, 3),
      difficulty
    });
  }

  return result;
}

/**
 * Provider 1: The Trivia API v2
 */
export async function fetchFromTriviaApiV2(
  category: Category,
  amount: number,
  packId: string = 'default',
  timeoutMs: number = 4000
): Promise<QuestionData[]> {
  const catParam = TRIVIA_API_CATEGORY_MAP[category];
  if (!catParam) return [];
  const url = `https://the-trivia-api.com/v2/questions?categories=${catParam}&limit=${amount}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json' }
  });

  if (!res.ok) {
    throw new Error(`The Trivia API v2 returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as Array<{
    question?: { text?: string } | string;
    correctAnswer?: string;
    incorrectAnswers?: string[];
    difficulty?: string;
  }>;

  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const rawList: RawQuestionCandidate[] = data.map((item) => ({
    question: typeof item.question === 'object' && item.question?.text ? item.question.text : String(item.question || ''),
    correctAnswer: item.correctAnswer || '',
    incorrectAnswers: item.incorrectAnswers || [],
    difficulty: item.difficulty
  }));

  return cleanAndValidateQuestions(rawList, category, packId, 'ttapi2');
}

/**
 * Provider 2: Open Trivia Database (OpenTDB)
 */
export async function fetchFromOpenTdb(
  category: Category,
  amount: number,
  packId: string = 'default',
  timeoutMs: number = 4000
): Promise<QuestionData[]> {
  const catIds = OPENTDB_CATEGORY_MAP[category];
  if (!catIds?.length) return [];
  const catId = catIds[Math.floor(Math.random() * catIds.length)];
  // General Knowledge contains sparse meme content; request one larger bounded batch.
  const requestAmount = category === 'MEMES' ? 50 : amount;
  const url = `https://opentdb.com/api.php?amount=${requestAmount}&category=${catId}&type=multiple`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json' }
  });

  if (!res.ok) {
    throw new Error(`OpenTDB returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    response_code: number;
    results?: Array<{
      question: string;
      correct_answer: string;
      incorrect_answers: string[];
      difficulty: string;
    }>;
  };

  if (data.response_code !== 0 || !Array.isArray(data.results) || data.results.length === 0) {
    return [];
  }

  const rawList: RawQuestionCandidate[] = data.results.map((item) => ({
    question: item.question,
    correctAnswer: item.correct_answer,
    incorrectAnswers: item.incorrect_answers,
    difficulty: item.difficulty
  }));

  const questions = cleanAndValidateQuestions(rawList, category, packId, 'opentdb');
  return category === 'MEMES'
    ? questions.filter(q => /\b(?:memes?|rickroll(?:ing|ed)?|doge|nyan cat|grumpy cat|viral (?:internet )?(?:video|image)|internet (?:phenomenon|phenomena))\b/i.test(q.question)).slice(0, amount)
    : questions;
}

/**
 * Provider 3: The Trivia API v1
 */
export async function fetchFromTriviaApiV1(
  category: Category,
  amount: number,
  packId: string = 'default',
  timeoutMs: number = 4000
): Promise<QuestionData[]> {
  const catParam = TRIVIA_API_CATEGORY_MAP[category];
  if (!catParam) return [];
  const url = `https://the-trivia-api.com/api/questions?categories=${catParam}&limit=${amount}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json' }
  });

  if (!res.ok) {
    throw new Error(`The Trivia API v1 returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as Array<{
    question?: string;
    correctAnswer?: string;
    incorrectAnswers?: string[];
    difficulty?: string;
  }>;

  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const rawList: RawQuestionCandidate[] = data.map((item) => ({
    question: item.question || '',
    correctAnswer: item.correctAnswer || '',
    incorrectAnswers: item.incorrectAnswers || [],
    difficulty: item.difficulty
  }));

  return cleanAndValidateQuestions(rawList, category, packId, 'ttapi1');
}

/**
 * Provider 4: Will Fry Trivia API (Backup Mirror)
 */
export async function fetchFromWillFry(
  category: Category,
  amount: number,
  packId: string = 'default',
  timeoutMs: number = 4000
): Promise<QuestionData[]> {
  const catParam = TRIVIA_API_CATEGORY_MAP[category];
  if (!catParam) return [];
  const url = `https://trivia.willfry.co.uk/api/questions?categories=${catParam}&limit=${amount}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json' }
  });

  if (!res.ok) {
    throw new Error(`Will Fry Trivia API returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as Array<{
    question?: string;
    correctAnswer?: string;
    incorrectAnswers?: string[];
    difficulty?: string;
  }>;

  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const rawList: RawQuestionCandidate[] = data.map((item) => ({
    question: item.question || '',
    correctAnswer: item.correctAnswer || '',
    incorrectAnswers: item.incorrectAnswers || [],
    difficulty: item.difficulty
  }));

  return cleanAndValidateQuestions(rawList, category, packId, 'willfry');
}

export interface FetchTriviaOptions {
  category: Category;
  amount?: number;
  packId?: string;
  db?: AppDatabase;
  excludeTexts?: Set<string>;
  excludeQuestionIds?: string[];
  forceRefresh?: boolean;
}

export interface FetchTriviaResult {
  questions: QuestionData[];
  provider: TriviaProviderName;
}

/**
 * Cascading trivia fetcher with multi-tier caching:
 * 1. Fast in-memory cache (memoryCache)
 * 2. Persistent database cache (cached_questions table)
 * 3. External trivia APIs in cascading fallback:
 *    - The Trivia API v2
 *    - OpenTDB
 *    - The Trivia API v1
 *    - Will Fry Trivia Mirror
 * 4. Pre-bundled Curated Questions Pool
 */
export async function fetchTriviaQuestionsWithFallback(
  options: FetchTriviaOptions
): Promise<FetchTriviaResult> {
  const {
    category,
    amount = 5,
    packId = 'default',
    db,
    excludeTexts,
    excludeQuestionIds,
    forceRefresh = false
  } = options;

  const excludeIds =
    excludeQuestionIds && excludeQuestionIds.length > 0
      ? new Set(excludeQuestionIds)
      : undefined;

  // 1. In-Memory Cache (skip if forceRefresh is true)
  if (!forceRefresh) {
    if (memoryCache.has(category, amount)) {
      const cached = memoryCache.get(category, amount, { excludeTexts, excludeIds });
      if (cached.length >= amount) {
        return {
          questions: cached.slice(0, amount).map((q) => toQuestionData(q, packId)),
          provider: 'cache:memory'
        };
      }
    }

    // 2. Persistent Database Cache (cached_questions)
    if (db) {
      try {
        const dbCached = await queryDbCachedQuestions(
          db,
          category,
          Math.max(amount * 2, 10),
          { excludeTexts, excludeIds }
        );
        if (dbCached.length >= amount) {
          // Warm up in-memory cache
          memoryCache.put(category, dbCached, 'cache:db');
          const selected = dbCached.slice(0, amount);
          await incrementDbServedCount(
            db,
            selected.map((q) => q.id)
          );
          return {
            questions: selected.map((q) => toQuestionData(q, packId)),
            provider: 'cache:db'
          };
        }
      } catch {
        // Fall through to external API refill
      }
    }
  }

  // 3. Cache Miss or Force Refresh: Refill Batch from External Trivia APIs
  const refillAmount = Math.max(amount, 10);
  const providers: Array<{
    name: TriviaProviderName;
    fn: () => Promise<QuestionData[]>;
  }> = [
    {
      name: 'the-trivia-api-v2',
      fn: () => fetchFromTriviaApiV2(category, refillAmount, packId)
    },
    {
      name: 'opentdb',
      fn: () => fetchFromOpenTdb(category, refillAmount, packId)
    },
    {
      name: 'the-trivia-api-v1',
      fn: () => fetchFromTriviaApiV1(category, refillAmount, packId)
    },
    {
      name: 'willfry',
      fn: () => fetchFromWillFry(category, refillAmount, packId)
    }
  ];

  for (const provider of providers) {
    try {
      const fetched = await provider.fn();
      const filtered = fetched.filter((q) =>
        !excludeIds?.has(q.id) && !excludeTexts?.has(normalizeQuestionText(q.question))
      );

      if (filtered.length > 0) {
        // Cache refill batch to database if db available
        if (db) {
          try {
            await persistDbCachedQuestions(db, filtered, provider.name);
          } catch {
            // Best effort DB caching
          }
        }

        // Cache refill batch to in-memory cache
        memoryCache.put(category, filtered, provider.name);

        return {
          questions: filtered.slice(0, amount).map((q) => ({ ...q, packId })),
          provider: provider.name
        };
      }
    } catch {
      // Continue to next provider on any error (timeout, network, rate-limit, parse)
    }
  }

  // 4. Graceful Fallback: Curated Questions Pool
  const curated = CURATED_QUESTIONS.filter((q) => q.category === category);
  const filteredCurated = curated.filter((q) =>
    !excludeIds?.has(q.id) && !excludeTexts?.has(normalizeQuestionText(q.question))
  );

  // Shuffle curated questions
  const fallbackList: QuestionData[] = shuffled(filteredCurated)
    .slice(0, amount)
    .map((q) => ({
      ...q,
      packId
    }));

  return {
    questions: fallbackList,
    provider: 'curated-fallback'
  };
}

/**
 * Persist questions to the database `questions` table
 */
export async function persistQuestionsToDb(
  db: AppDatabase,
  questions: QuestionData[]
): Promise<number> {
  let inserted = 0;
  for (const q of questions) {
    try {
      const result = await db.execute(
        `INSERT OR IGNORE INTO questions (id, pack_id, category, question, image_url, correct_answer, incorrect_answers_json, difficulty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          q.id,
          q.packId,
          q.category,
          q.question,
          q.imageUrl || null,
          q.correctAnswer,
          JSON.stringify(q.incorrectAnswers),
          q.difficulty
        ]
      );
      inserted += result.rowsAffected;
    } catch {
      // Silently ignore insert conflict
    }
  }
  return inserted;
}

/**
 * Bulk expand a question pack with fresh questions from free APIs across categories
 */
export async function expandPackQuestions(
  db: AppDatabase,
  packId: string,
  countPerCategory: number = 5,
  categories: Category[] = CATEGORY_IDS,
  forceRefresh: boolean = false
): Promise<{
  packId: string;
  added: number;
  totalInPack: number;
  byCategory: Record<Category, number>;
  providersUsed: string[];
}> {
  // 1. Get existing question texts for this pack to avoid duplicate questions
  const existingRows = await db.query<{ question: string }>(
    'SELECT question FROM questions WHERE pack_id = ?',
    [packId]
  );
  const existingTexts = new Set<string>(
    existingRows.map((r) => normalizeQuestionText(r.question))
  );

  let totalAdded = 0;
  const byCategory: Record<Category, number> = {
    ART: 0,
    SCIENCE: 0,
    SPORTS: 0,
    ENTERTAINMENT: 0,
    GEOGRAPHY: 0,
    MEMES: 0, CUSTOM: 0, MOVIES_TV: 0, VIDEO_GAMES: 0, HISTORY: 0
  };
  const providersUsedSet = new Set<string>();

  // Fetch for each category
  for (const cat of categories) {
    const fetchAmount = Math.max(1, countPerCategory);
    const result = await fetchTriviaQuestionsWithFallback({
      category: cat,
      amount: fetchAmount,
      packId,
      db,
      excludeTexts: existingTexts,
      forceRefresh
    });

    providersUsedSet.add(result.provider);

    // Filter questions not already in database
    const toInsert = result.questions.filter(
      (q) => !existingTexts.has(normalizeQuestionText(q.question))
    );

    if (toInsert.length > 0) {
      // Provider IDs are shared across packs; each stored pack copy needs its own ID.
      const inserted = await persistQuestionsToDb(db, toInsert.map(q => ({ ...q, id: `${packId}:${q.id}` })));
      for (const q of toInsert) {
        existingTexts.add(normalizeQuestionText(q.question));
      }
      byCategory[cat] = inserted;
      totalAdded += inserted;
    }
  }

  // Count total questions now in pack
  const countRow = await db.queryFirst<{ count: number }>(
    'SELECT COUNT(*) as count FROM questions WHERE pack_id = ?',
    [packId]
  );

  return {
    packId,
    added: totalAdded,
    totalInPack: countRow?.count ?? 0,
    byCategory,
    providersUsed: Array.from(providersUsedSet)
  };
}
