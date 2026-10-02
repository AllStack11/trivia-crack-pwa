import type { Category, QuestionData } from '../../../shared/src/index';
import type { AppDatabase } from '../db/database';

export const CATEGORIES_LIST: Category[] = [
  'ART',
  'SCIENCE',
  'SPORTS',
  'ENTERTAINMENT',
  'GEOGRAPHY',
  'HISTORY'
];

export interface CachedQuestionItem {
  id: string;
  category: Category;
  question: string;
  imageUrl?: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  provider: string;
  cachedAt: number;
  servedCount: number;
  lastServedAt: number;
}

export interface CacheStatsSummary {
  inMemoryCounts: Record<Category, number>;
  dbCounts?: Record<Category, number>;
  hits: number;
  misses: number;
  hitRate: string;
}

export function normalizeQuestionText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function toQuestionData(item: CachedQuestionItem, packId: string = 'default'): QuestionData {
  return {
    id: item.id,
    packId,
    category: item.category,
    question: item.question,
    imageUrl: item.imageUrl,
    correctAnswer: item.correctAnswer,
    incorrectAnswers: item.incorrectAnswers,
    difficulty: item.difficulty
  };
}

/**
 * In-Memory Question Cache Engine with TTL, LRU Eviction, and Rotation Tracking
 */
export class MemoryQuestionCache {
  private pools: Map<Category, CachedQuestionItem[]> = new Map();
  private servedHistory: Map<Category, Set<string>> = new Map();
  private hits: number = 0;
  private misses: number = 0;
  public readonly ttlMs: number;
  public readonly maxCapacityPerCategory: number;

  constructor(options?: { ttlMs?: number; maxCapacityPerCategory?: number }) {
    this.ttlMs = options?.ttlMs ?? 2 * 60 * 60 * 1000; // 2 hours default
    this.maxCapacityPerCategory = options?.maxCapacityPerCategory ?? 100;
  }

  private evictExpired(category: Category, now: number = Date.now()): void {
    const pool = this.pools.get(category);
    if (!pool || pool.length === 0) return;
    const valid = pool.filter((q) => now - q.cachedAt <= this.ttlMs);
    if (valid.length !== pool.length) {
      this.pools.set(category, valid);
    }
  }

  /**
   * Check if category pool has at least `minCount` active, unexpired questions
   */
  public has(category: Category, minCount: number = 1): boolean {
    this.evictExpired(category);
    const pool = this.pools.get(category);
    return (pool?.length ?? 0) >= minCount;
  }

  /**
   * Retrieve questions from memory cache, rotating through items to avoid immediate repeats
   */
  public get(
    category: Category,
    amount: number,
    options?: { excludeTexts?: Set<string>; excludeIds?: Set<string> }
  ): CachedQuestionItem[] {
    const now = Date.now();
    this.evictExpired(category, now);

    const pool = this.pools.get(category);
    if (!pool || pool.length === 0 || amount <= 0) {
      this.misses++;
      return [];
    }

    // Filter candidates based on exclusions
    const candidates = pool.filter((q) => {
      if (options?.excludeIds?.has(q.id)) return false;
      if (options?.excludeTexts?.has(normalizeQuestionText(q.question))) return false;
      return true;
    });

    if (candidates.length === 0) {
      this.misses++;
      return [];
    }

    let servedSet = this.servedHistory.get(category);
    if (!servedSet) {
      servedSet = new Set<string>();
      this.servedHistory.set(category, servedSet);
    }

    // Identify unserved candidates in rotation
    let unserved = candidates.filter((q) => !servedSet!.has(q.id));

    // If unserved candidates are exhausted, reset the rotation cycle for this category
    if (unserved.length === 0) {
      servedSet.clear();
      unserved = [...candidates];
    }

    // Sort unserved by servedCount ASC, lastServedAt ASC for fair rotation
    unserved.sort((a, b) => a.servedCount - b.servedCount || a.lastServedAt - b.lastServedAt);

    const selected = unserved.slice(0, amount);

    // If we couldn't fulfill the entire amount from unserved, pull from remaining candidates
    if (selected.length < amount && selected.length < candidates.length) {
      const selectedIds = new Set(selected.map((s) => s.id));
      const remaining = candidates
        .filter((q) => !selectedIds.has(q.id))
        .sort((a, b) => a.servedCount - b.servedCount || a.lastServedAt - b.lastServedAt);
      const needed = amount - selected.length;
      selected.push(...remaining.slice(0, needed));
    }

    if (selected.length > 0) {
      this.hits++;
      for (const item of selected) {
        servedSet.add(item.id);
        item.servedCount++;
        item.lastServedAt = now;
      }
    } else {
      this.misses++;
    }

    return selected;
  }

  /**
   * Add questions to the category memory pool with deduplication and LRU capacity pruning
   */
  public put(
    category: Category,
    questions: Array<QuestionData | CachedQuestionItem>,
    provider: string
  ): number {
    const now = Date.now();
    this.evictExpired(category, now);

    let pool = this.pools.get(category);
    if (!pool) {
      pool = [];
      this.pools.set(category, pool);
    }

    const existingNormTexts = new Set(pool.map((q) => normalizeQuestionText(q.question)));
    const existingIds = new Set(pool.map((q) => q.id));
    let addedCount = 0;

    for (const q of questions) {
      if (!q.question || !q.correctAnswer || !Array.isArray(q.incorrectAnswers) || q.incorrectAnswers.length < 3) {
        continue;
      }

      const norm = normalizeQuestionText(q.question);
      if (existingNormTexts.has(norm)) {
        continue;
      }

      const item: CachedQuestionItem = {
        id: q.id || `cq_${crypto.randomUUID()}`,
        category,
        question: q.question.trim(),
        imageUrl: q.imageUrl,
        correctAnswer: q.correctAnswer.trim(),
        incorrectAnswers: q.incorrectAnswers.slice(0, 3).map((a) => a.trim()),
        difficulty: (q.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
        provider: (q as CachedQuestionItem).provider || provider,
        cachedAt: (q as CachedQuestionItem).cachedAt || now,
        servedCount: (q as CachedQuestionItem).servedCount || 0,
        lastServedAt: (q as CachedQuestionItem).lastServedAt || 0
      };

      if (existingIds.has(item.id)) {
        item.id = `cq_${crypto.randomUUID()}`;
      }

      pool.push(item);
      existingNormTexts.add(norm);
      existingIds.add(item.id);
      addedCount++;
    }

    // LRU eviction if capacity exceeded: evict least recently served and oldest cached
    if (pool.length > this.maxCapacityPerCategory) {
      pool.sort((a, b) => b.lastServedAt - a.lastServedAt || b.cachedAt - a.cachedAt);
      pool.splice(this.maxCapacityPerCategory);
    }

    return addedCount;
  }

  /**
   * Clear cache for a specific category or all categories
   */
  public clear(category?: Category): void {
    if (category) {
      this.pools.delete(category);
      this.servedHistory.delete(category);
    } else {
      this.pools.clear();
      this.servedHistory.clear();
      this.hits = 0;
      this.misses = 0;
    }
  }

  /**
   * Get stats summary for cache monitoring
   */
  public getStats(): CacheStatsSummary {
    const inMemoryCounts: Record<Category, number> = {
      ART: 0,
      SCIENCE: 0,
      SPORTS: 0,
      ENTERTAINMENT: 0,
      GEOGRAPHY: 0,
      HISTORY: 0
    };

    for (const cat of CATEGORIES_LIST) {
      this.evictExpired(cat);
      const pool = this.pools.get(cat);
      inMemoryCounts[cat] = pool?.length ?? 0;
    }

    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests === 0 ? '0.0%' : `${((this.hits / totalRequests) * 100).toFixed(1)}%`;

    return {
      inMemoryCounts,
      hits: this.hits,
      misses: this.misses,
      hitRate
    };
  }
}

// Global singleton instance for in-memory cache
export const memoryCache = new MemoryQuestionCache();

/**
 * Database persistent cache layer functions
 */

interface DbCachedQuestionRow {
  id: string;
  category: string;
  question: string;
  image_url: string | null;
  correct_answer: string;
  incorrect_answers_json: string;
  difficulty: string;
  provider: string;
  cached_at: number;
  served_count: number;
  last_served_at: number;
}

export async function queryDbCachedQuestions(
  db: AppDatabase,
  category: Category,
  limit: number,
  options?: {
    excludeTexts?: Set<string>;
    excludeIds?: Set<string>;
  }
): Promise<CachedQuestionItem[]> {
  // Query a pool of questions ordered by lowest served_count and oldest last_served_at
  const fetchLimit = Math.max(limit * 3, 30);
  const rows = await db.query<DbCachedQuestionRow>(
    `SELECT id, category, question, image_url, correct_answer, incorrect_answers_json, difficulty, provider, cached_at, served_count, last_served_at
     FROM cached_questions
     WHERE category = ?
     ORDER BY served_count ASC, last_served_at ASC
     LIMIT ?`,
    [category, fetchLimit]
  );

  const result: CachedQuestionItem[] = [];

  for (const row of rows) {
    if (options?.excludeIds?.has(row.id)) continue;
    if (options?.excludeTexts?.has(normalizeQuestionText(row.question))) continue;

    let incorrectAnswers: string[] = [];
    try {
      const parsed = JSON.parse(row.incorrect_answers_json);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        incorrectAnswers = parsed.slice(0, 3).map((a) => String(a));
      } else {
        continue;
      }
    } catch {
      continue;
    }

    result.push({
      id: row.id,
      category: row.category as Category,
      question: row.question,
      imageUrl: row.image_url || undefined,
      correctAnswer: row.correct_answer,
      incorrectAnswers,
      difficulty: (row.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
      provider: row.provider,
      cachedAt: row.cached_at,
      servedCount: row.served_count,
      lastServedAt: row.last_served_at
    });

    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

export async function persistDbCachedQuestions(
  db: AppDatabase,
  questions: QuestionData[],
  provider: string
): Promise<number> {
  const now = Date.now();
  let inserted = 0;

  for (const q of questions) {
    if (!q.question || !q.correctAnswer || !Array.isArray(q.incorrectAnswers) || q.incorrectAnswers.length < 3) {
      continue;
    }

    try {
      const id = q.id || `cq_${crypto.randomUUID()}`;
      const res = await db.execute(
        `INSERT OR IGNORE INTO cached_questions (
           id, category, question, image_url, correct_answer, incorrect_answers_json, difficulty, provider, cached_at, served_count, last_served_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [
          id,
          q.category,
          q.question.trim(),
          q.imageUrl || null,
          q.correctAnswer.trim(),
          JSON.stringify(q.incorrectAnswers.slice(0, 3).map((a) => a.trim())),
          q.difficulty || 'medium',
          provider,
          now
        ]
      );
      if (res && res.rowsAffected > 0) {
        inserted++;
      }
    } catch {
      // Ignore unique constraint collision or insert errors
    }
  }

  return inserted;
}

export async function incrementDbServedCount(
  db: AppDatabase,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  const now = Date.now();

  for (const id of ids) {
    try {
      await db.execute(
        `UPDATE cached_questions
         SET served_count = served_count + 1, last_served_at = ?
         WHERE id = ?`,
        [now, id]
      );
    } catch {
      // Best-effort tracking update
    }
  }
}

export async function countDbCachedQuestionsByCategory(
  db: AppDatabase
): Promise<Record<Category, number>> {
  const counts: Record<Category, number> = {
    ART: 0,
    SCIENCE: 0,
    SPORTS: 0,
    ENTERTAINMENT: 0,
    GEOGRAPHY: 0,
    HISTORY: 0
  };

  try {
    const rows = await db.query<{ category: string; count: number }>(
      'SELECT category, COUNT(*) as count FROM cached_questions GROUP BY category'
    );
    for (const row of rows) {
      if (row.category in counts) {
        counts[row.category as Category] = Number(row.count) || 0;
      }
    }
  } catch {
    // If table doesn't exist yet in mock db
  }

  return counts;
}
