import { asD1 } from './helpers/d1';
import { expect, test, describe, beforeEach, spyOn } from 'bun:test';
import type { AppDatabase } from '../src/db/database';
import { createBunDatabase, SCHEMA_SQL } from '../src/db/database';
import {
  MemoryQuestionCache,
  memoryCache,
  queryDbCachedQuestions,
  persistDbCachedQuestions,
  incrementDbServedCount,
  countDbCachedQuestionsByCategory,
  type CachedQuestionItem
} from '../src/services/questionCache';
import {
  fetchTriviaQuestionsWithFallback
} from '../src/services/triviaApiService';
import { fetchLiveQuestions, ensureDefaultPackSeeded } from '../src/services/packService';
import app from '../src/index';
import type { QuestionData } from '../../shared/src/index';

describe('Multi-Tier Question Caching System', () => {
  let db: AppDatabase;
  const request = (path: string, init?: RequestInit) => app.request(path, init, { DB: asD1(db) });

  const mockQuestions: QuestionData[] = [
    {
      id: 'q1',
      packId: 'default',
      category: 'SCIENCE',
      question: 'What is the chemical symbol for Gold?',
      correctAnswer: 'Au',
      incorrectAnswers: ['Ag', 'Fe', 'Cu'],
      difficulty: 'easy'
    },
    {
      id: 'q2',
      packId: 'default',
      category: 'SCIENCE',
      question: 'What planet is known as the Red Planet?',
      correctAnswer: 'Mars',
      incorrectAnswers: ['Venus', 'Jupiter', 'Saturn'],
      difficulty: 'easy'
    },
    {
      id: 'q3',
      packId: 'default',
      category: 'SCIENCE',
      question: 'What is the speed of light in vacuum?',
      correctAnswer: '299,792 km/s',
      incorrectAnswers: ['150,000 km/s', '1,080 km/h', '30,000 km/s'],
      difficulty: 'medium'
    },
    {
      id: 'q4',
      packId: 'default',
      category: 'SCIENCE',
      question: 'What particle has a positive electrical charge?',
      correctAnswer: 'Proton',
      incorrectAnswers: ['Electron', 'Neutron', 'Photon'],
      difficulty: 'easy'
    }
  ];

  beforeEach(async () => {
    db = await createBunDatabase(':memory:');
    await db.exec(SCHEMA_SQL);
    memoryCache.clear();
  });

  describe('MemoryQuestionCache Engine', () => {
    test('stores and retrieves questions by category', () => {
      const cache = new MemoryQuestionCache();
      const added = cache.put('SCIENCE', mockQuestions, 'test-provider');
      expect(added).toBe(4);
      expect(cache.has('SCIENCE', 2)).toBe(true);

      const retrieved = cache.get('SCIENCE', 2);
      expect(retrieved.length).toBe(2);
      expect(retrieved[0].category).toBe('SCIENCE');
      expect(retrieved[0].provider).toBe('test-provider');
    });

    test('fair rotation avoids immediate repeats and resets when exhausted', () => {
      const cache = new MemoryQuestionCache();
      cache.put('SCIENCE', mockQuestions.slice(0, 3), 'test');

      const batch1 = cache.get('SCIENCE', 2);
      const batch1Ids = batch1.map((q) => q.id);
      expect(batch1Ids.length).toBe(2);

      // Next retrieval should select the 3rd question rather than immediately repeating batch 1
      const batch2 = cache.get('SCIENCE', 1);
      expect(batch2.length).toBe(1);
      expect(batch1Ids).not.toContain(batch2[0].id);

      // Subsequent retrieval rotates through all candidates again
      const batch3 = cache.get('SCIENCE', 2);
      expect(batch3.length).toBe(2);
    });

    test('randomizes tied questions rather than serving insertion order', () => {
      const random = spyOn(Math, 'random').mockReturnValue(0);
      try {
        const cache = new MemoryQuestionCache();
        cache.put('SCIENCE', mockQuestions, 'test');
        const firstCycle = cache.get('SCIENCE', 4).map(q => q.id);
        expect(firstCycle).toEqual(['q2', 'q3', 'q4', 'q1']);
        expect(new Set(firstCycle).size).toBe(4);
      } finally { random.mockRestore(); }
    });

    test('respects excludeTexts and excludeIds', () => {
      const cache = new MemoryQuestionCache();
      cache.put('SCIENCE', mockQuestions, 'test');

      const excludeIds = new Set(['q1']);
      const excludeTexts = new Set(['what planet is known as the red planet?']);

      const retrieved = cache.get('SCIENCE', 10, { excludeIds, excludeTexts });
      const ids = retrieved.map((q) => q.id);
      expect(ids).not.toContain('q1');
      expect(ids).not.toContain('q2');
      expect(retrieved.length).toBe(2);
    });

    test('evicts expired questions according to TTL', () => {
      const cache = new MemoryQuestionCache({ ttlMs: 1000 });
      const expiredItem: CachedQuestionItem = {
        ...mockQuestions[0],
        provider: 'test',
        cachedAt: Date.now() - 5000,
        servedCount: 0,
        lastServedAt: 0
      };
      cache.put('SCIENCE', [expiredItem], 'test');
      expect(cache.has('SCIENCE', 1)).toBe(false);
      const retrieved = cache.get('SCIENCE', 2);
      expect(retrieved.length).toBe(0);
    });

    test('prunes oldest questions when capacity limit is reached', () => {
      // Max capacity 2
      const cache = new MemoryQuestionCache({ maxCapacityPerCategory: 2 });
      cache.put('SCIENCE', mockQuestions, 'test');

      const stats = cache.getStats();
      expect(stats.inMemoryCounts.SCIENCE).toBe(2);
    });

    test('tracks hit, miss, and hitRate accurately', () => {
      const cache = new MemoryQuestionCache();
      // Miss on empty cache
      cache.get('SCIENCE', 2);
      expect(cache.getStats().misses).toBe(1);
      expect(cache.getStats().hits).toBe(0);
      expect(cache.getStats().hitRate).toBe('0.0%');

      // Put questions and hit
      cache.put('SCIENCE', mockQuestions, 'test');
      cache.get('SCIENCE', 2);
      expect(cache.getStats().hits).toBe(1);
      expect(cache.getStats().misses).toBe(1);
      expect(cache.getStats().hitRate).toBe('50.0%');

      // Clear resets stats
      cache.clear();
      expect(cache.getStats().hits).toBe(0);
      expect(cache.getStats().misses).toBe(0);
      expect(cache.getStats().inMemoryCounts.SCIENCE).toBe(0);
    });
  });

  describe('Database Persistent Cache Layer', () => {
    test('persists questions and queries least-served items', async () => {
      const inserted = await persistDbCachedQuestions(db, mockQuestions, 'db-provider');
      expect(inserted).toBe(4);

      const queried = await queryDbCachedQuestions(db, 'SCIENCE', 2);
      expect(queried.length).toBe(2);
      expect(queried[0].category).toBe('SCIENCE');
      expect(queried[0].incorrectAnswers.length).toBe(3);

      // Increment served count for the first question
      await incrementDbServedCount(db, [queried[0].id]);

      // Next query should prefer least-served questions first
      const nextQueried = await queryDbCachedQuestions(db, 'SCIENCE', 1);
      expect(nextQueried.length).toBe(1);
      expect(nextQueried[0].id).not.toBe(queried[0].id);
    });

    test('exclusions do not hide eligible questions beyond the initial cache window', async () => {
      const questions = Array.from({ length: 100 }, (_, i) => ({
        ...mockQuestions[0], id: `large_${i}`, question: `Unique science question ${i}?`
      }));
      await persistDbCachedQuestions(db, questions, 'test');
      const eligible = await queryDbCachedQuestions(db, 'SCIENCE', 1, {
        excludeIds: new Set(questions.slice(0, 99).map(q => q.id))
      });
      expect(eligible.map(q => q.id)).toEqual(['large_99']);
    });

    test('deduplicates questions on duplicate question text', async () => {
      await persistDbCachedQuestions(db, [mockQuestions[0]], 'provider1');
      // Attempt insert of duplicate question text with different id
      const duplicate: QuestionData = {
        ...mockQuestions[0],
        id: 'different_id'
      };
      const inserted = await persistDbCachedQuestions(db, [duplicate], 'provider2');
      expect(inserted).toBe(0);

      const rows = await db.query('SELECT COUNT(*) as count FROM cached_questions');
      expect(rows[0]).toEqual({ count: 1 });
    });

    test('countDbCachedQuestionsByCategory returns per-category counts', async () => {
      await persistDbCachedQuestions(db, mockQuestions, 'test');
      const counts = await countDbCachedQuestionsByCategory(db);
      expect(counts.SCIENCE).toBe(4);
      expect(counts.GEOGRAPHY).toBe(0);
    });
  });

  describe('Integrated Multi-Tier Retrieval', () => {
    test('cache-first flow: external refill -> memory cache hit -> db cache hit', async () => {
      // Pre-seed DB with cached questions
      await persistDbCachedQuestions(db, mockQuestions, 'opentdb');
      memoryCache.clear();

      // First fetch with empty memory cache should pull from DB and warm memory cache
      const result1 = await fetchTriviaQuestionsWithFallback({
        category: 'SCIENCE',
        amount: 2,
        db
      });

      expect(result1.provider).toBe('cache:db');
      expect(result1.questions.length).toBe(2);

      // Second fetch should hit the now-warmed in-memory cache
      const result2 = await fetchTriviaQuestionsWithFallback({
        category: 'SCIENCE',
        amount: 2,
        db
      });

      expect(result2.provider).toBe('cache:memory');
      expect(result2.questions.length).toBe(2);

      // Fetch with forceRefresh should bypass cache
      const resultRefresh = await fetchTriviaQuestionsWithFallback({
        category: 'SCIENCE',
        amount: 2,
        db,
        forceRefresh: true
      });

      // Provider should be an external API or curated fallback, not cache
      expect(resultRefresh.provider.startsWith('cache:')).toBe(false);
    });

    test('fetchLiveQuestions integrates with cache', async () => {
      memoryCache.put('SPORTS', [
        {
          id: 'sp1',
          packId: 'default',
          category: 'SPORTS',
          question: 'How many players are on a soccer team on the field?',
          correctAnswer: '11',
          incorrectAnswers: ['9', '10', '12'],
          difficulty: 'easy'
        },
        {
          id: 'sp2',
          packId: 'default',
          category: 'SPORTS',
          question: 'In bowling, what is three strikes in a row called?',
          correctAnswer: 'Turkey',
          incorrectAnswers: ['Eagle', 'Hat trick', 'Triple'],
          difficulty: 'medium'
        }
      ], 'test-sports');

      const res = await fetchLiveQuestions('SPORTS', 2, 'default', db);
      expect(res.provider).toBe('cache:memory');
      expect(res.questions.length).toBe(2);
    });
  });

  describe('REST API Endpoints & Headers', () => {
    test('GET /api/questions/fetch returns Cache-Control and X-Cache-Status headers', async () => {
      // Warm memory cache
      memoryCache.put('GEOGRAPHY', [
        {
          id: 'geo1',
          packId: 'default',
          category: 'GEOGRAPHY',
          question: 'What is the capital of France?',
          correctAnswer: 'Paris',
          incorrectAnswers: ['Lyon', 'Marseille', 'Nice'],
          difficulty: 'easy'
        }
      ], 'test');

      const resHit = await request('/api/questions/fetch?category=GEOGRAPHY&amount=1');
      expect(resHit.status).toBe(200);
      expect(resHit.headers.get('Cache-Control')).toBe('private, max-age=60, stale-while-revalidate=300');
      expect(resHit.headers.get('X-Cache-Status')).toBe('HIT');

      const bodyHit = (await resHit.json()) as { questions: unknown[]; provider: string; cached: boolean };
      expect(bodyHit.cached).toBe(true);
      expect(bodyHit.provider).toBe('cache:memory');

      // Request with refresh=true forces MISS
      const resRefresh = await request('/api/questions/fetch?category=GEOGRAPHY&amount=1&refresh=true');
      expect(resRefresh.status).toBe(200);
      expect(resRefresh.headers.get('X-Cache-Status')).toBe('MISS');
      const bodyRefresh = (await resRefresh.json()) as { cached: boolean };
      expect(bodyRefresh.cached).toBe(false);
    });

    test('GET /api/questions/cache/stats returns comprehensive statistics', async () => {
      memoryCache.put('SCIENCE', mockQuestions, 'test');
      memoryCache.get('SCIENCE', 2);

      const res = await request('/api/questions/cache/stats');
      expect(res.status).toBe(200);

      const stats = (await res.json()) as {
        inMemory: Record<string, number>;
        db: Record<string, number>;
        hits: number;
        misses: number;
        hitRate: string;
      };

      expect(typeof stats.inMemory).toBe('object');
      expect(stats.inMemory.SCIENCE).toBe(4);
      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
      expect(typeof stats.hitRate).toBe('string');
    });

    test('POST /api/questions/cache/clear invalidates in-memory cache', async () => {
      memoryCache.put('SCIENCE', mockQuestions, 'test');
      expect(memoryCache.has('SCIENCE', 1)).toBe(true);

      const res = await request('/api/questions/cache/clear', { method: 'POST' });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { cleared: boolean };
      expect(body.cleared).toBe(true);

      expect(memoryCache.has('SCIENCE', 1)).toBe(false);
    });

    test('user pack expansion remains retired even with forceRefresh', async () => {
      await ensureDefaultPackSeeded(db);

      const res = await request('/api/packs/default/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countPerCategory: 1,
          categories: ['SCIENCE'],
          forceRefresh: true
        })
      });

      expect(res.status).toBe(410);
    });
  });
});
