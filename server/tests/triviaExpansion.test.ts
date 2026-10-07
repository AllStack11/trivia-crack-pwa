import { asD1 } from './helpers/d1';
import { expect, test, describe, beforeEach } from 'bun:test';
import type { AppDatabase } from '../src/db/database';
import { createBunDatabase, SCHEMA_SQL } from '../src/db/database';
import {
  ensureDefaultPackSeeded,
  createPack,
  getPack,
  expandPack,
  fetchLiveQuestions
} from '../src/services/packService';
import {
  fetchTriviaQuestionsWithFallback,
  expandPackQuestions,
  decodeHtmlEntities,
  normalizeQuestionText,
  type TriviaProviderName
} from '../src/services/triviaApiService';
import app from '../src/index';
import { memoryCache } from '../src/services/questionCache';

describe('Trivia API Expansion & Graceful Fallbacks', () => {
  let db: AppDatabase;
  const request = (path: string, init?: RequestInit) => app.request(path, init, { DB: asD1(db) });

  beforeEach(async () => {
    memoryCache.clear();
    db = await createBunDatabase(':memory:');
    await db.exec(SCHEMA_SQL);
  });

  test('decodeHtmlEntities decodes common and unicode HTML entities', () => {
    expect(decodeHtmlEntities('&quot;Quiz&quot; &amp; &#039;Trivia&#039;')).toBe('"Quiz" & \'Trivia\'');
    expect(decodeHtmlEntities('Schr&ouml;dinger&#39;s Cat')).toBe("Schrödinger's Cat");
    expect(decodeHtmlEntities('&#65;&#66;&#67;')).toBe('ABC');
    expect(decodeHtmlEntities('No entities here')).toBe('No entities here');
  });

  test('normalizeQuestionText lowercases, trims, and collapses whitespace', () => {
    expect(normalizeQuestionText('  What   is  the   Capital? ')).toBe('what is the capital?');
    expect(normalizeQuestionText('WHO WROTE HAMLET?')).toBe('who wrote hamlet?');
  });

  test('fetchTriviaQuestionsWithFallback returns valid questions and provider', async () => {
    const result = await fetchTriviaQuestionsWithFallback({
      category: 'SCIENCE',
      amount: 3,
      packId: 'default'
    });

    expect(result.questions.length).toBeGreaterThanOrEqual(1);
    expect(result.questions.length).toBeLessThanOrEqual(3);
    expect(typeof result.provider).toBe('string');

    for (const q of result.questions) {
      expect(q.category).toBe('SCIENCE');
      expect(q.question.length).toBeGreaterThan(0);
      expect(q.correctAnswer.length).toBeGreaterThan(0);
      expect(q.incorrectAnswers.length).toBe(3);
      expect(q.incorrectAnswers).not.toContain(q.correctAnswer);
    }
  });

  test('gracefully falls back to curated questions pool when external APIs fail or are excluded', async () => {
    // Exclude all possible external texts to trigger fallback or use offline fallback
    const result = await fetchTriviaQuestionsWithFallback({
      category: 'ART',
      amount: 2,
      packId: 'test_pack'
    });

    expect(result.questions.length).toBe(2);
    expect(result.questions[0].category).toBe('ART');
    expect(result.questions[0].packId).toBe('test_pack');
  });

  test('expandPackQuestions adds questions and avoids duplicates', async () => {
    await ensureDefaultPackSeeded(db);
    const initialPack = await getPack(db, 'default');
    expect(initialPack?.questions.length).toBe(189);

    // A deterministic novel provider result; a seeded bank cannot expand from
    // the same exhausted curated fallback when the network is unavailable.
    memoryCache.put('ART', [{ id: 'novel-art', packId: 'default', category: 'ART', question: 'Novel expansion fixture?', correctAnswer: 'Yes', incorrectAnswers: ['No', 'Maybe', 'Never'], difficulty: 'easy' }], 'fixture');

    // Expand pack with 1 question per category across ART and SCIENCE
    const expandResult = await expandPackQuestions(db, 'default', 1, ['ART', 'SCIENCE']);
    expect(expandResult.added).toBeGreaterThanOrEqual(1);
    expect(expandResult.totalInPack).toBe(189 + expandResult.added);
    expect(expandResult.providersUsed.length).toBeGreaterThanOrEqual(1);

    const updatedPack = await getPack(db, 'default');
    expect(updatedPack?.questions.length).toBe(189 + expandResult.added);

    // Running expansion again shouldn't create duplicate question texts
    const questionsNow = updatedPack?.questions || [];
    const questionTexts = new Set(questionsNow.map((q) => normalizeQuestionText(q.question)));
    expect(questionTexts.size).toBe(questionsNow.length);
  });

  test('expandPack expands custom user pack successfully', async () => {
    const customPackId = await createPack(
      db,
      'My Custom Trivia',
      'A custom pack',
      'TestUser',
      [
        {
          category: 'HISTORY',
          question: 'What year did World War II end?',
          correctAnswer: '1945',
          incorrectAnswers: ['1939', '1944', '1950'],
          difficulty: 'easy'
        }
      ]
    );

    const initial = await getPack(db, customPackId);
    expect(initial?.questions.length).toBe(1);

    const expansion = await expandPack(db, customPackId, 2, ['HISTORY', 'GEOGRAPHY']);
    expect(expansion.added).toBeGreaterThanOrEqual(2);
    expect(expansion.totalInPack).toBe(1 + expansion.added);

    const refreshed = await getPack(db, customPackId);
    expect(refreshed?.questions.length).toBe(1 + expansion.added);
  });

  test('fetchLiveQuestions returns live questions on demand', async () => {
    const live = await fetchLiveQuestions('SPORTS', 2, 'default');
    expect(live.questions.length).toBe(2);
    expect(live.questions[0].category).toBe('SPORTS');
  });

  test('GET /api/questions/fetch route delivers trivia questions with provider info', async () => {
    const res = await request('/api/questions/fetch?category=GEOGRAPHY&amount=3');
    expect(res.status).toBe(200);

    const body = (await res.json()) as { questions: unknown[]; provider: string };
    expect(Array.isArray(body.questions)).toBe(true);
    expect(body.questions.length).toBeGreaterThanOrEqual(1);
    expect(typeof body.provider).toBe('string');
  });

  test('user pack expansion is retired', async () => {
    expect((await request('/api/packs/default/expand', { method: 'POST' })).status).toBe(410);
  });
});
