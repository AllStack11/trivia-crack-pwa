import type { AppDatabase } from '../db/database';
import { ensureDefaultPackSeeded } from './packService';
import { CATEGORY_IDS, fetchTriviaQuestionsWithFallback } from './triviaApiService';
import { normalizeQuestionText } from './questionCache';

const COOLDOWN_MS = 5 * 60 * 1000;

/** A persisted lease coalesces app opens across independent Worker instances. */
export async function ingestQuestions(db: AppDatabase): Promise<void> {
  const token = crypto.randomUUID();
  const now = Date.now();
  const claim = await db.execute(`INSERT INTO question_ingestion(id, lease_token, next_allowed_at)
    VALUES ('default', ?, ?)
    ON CONFLICT(id) DO UPDATE SET lease_token = excluded.lease_token,
      next_allowed_at = excluded.next_allowed_at
    WHERE question_ingestion.next_allowed_at <= ?`, [token, now + COOLDOWN_MS, now]);
  if (!claim.rowsAffected) return;

  try {
    await ensureDefaultPackSeeded(db);
    const existing = await db.query<{ question: string }>("SELECT question FROM questions WHERE pack_id = 'default'");
    const texts = new Set(existing.map(q => normalizeQuestionText(q.question)));
    // Refill all nine built-in categories in parallel; Custom accepts user contributions only.
    // No cache reads: every eligible refresh asks providers for new content.
    const results = await Promise.all(CATEGORY_IDS.map(category =>
      fetchTriviaQuestionsWithFallback({ category, amount: 10, forceRefresh: true, excludeTexts: texts })
    ));
    let added = 0;
    for (const result of results) {
      const questions = result.questions.filter(q => {
        const text = normalizeQuestionText(q.question);
        if (texts.has(text)) return false;
        texts.add(text);
        return true;
      });
      if (!questions.length) continue;
      const params: unknown[] = [];
      for (const q of questions) {
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeQuestionText(q.question)));
        const id = 'bank_' + Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
        params.push(id, q.category, q.question, q.imageUrl || null, q.correctAnswer,
          JSON.stringify(q.incorrectAnswers), q.difficulty);
      }
      // One bounded insert per category; stable content IDs prevent duplicates after retries.
      const inserted = await db.execute(`INSERT OR IGNORE INTO questions
        (id, pack_id, category, question, image_url, correct_answer, incorrect_answers_json, difficulty)
        VALUES ${questions.map(() => "(?, 'default', ?, ?, ?, ?, ?, ?)").join(',')}`, params);
      added += inserted.rowsAffected;
    }
    await db.execute(`UPDATE question_ingestion SET last_completed_at = ?, last_added = ?
      WHERE id = 'default' AND lease_token = ?`, [Date.now(), added, token]);
  } catch {
    // Preserve existing content and allow another app open to retry shortly.
    await db.execute(`UPDATE question_ingestion SET next_allowed_at = ?
      WHERE id = 'default' AND lease_token = ?`, [Date.now() + 60_000, token]);
  }
}
