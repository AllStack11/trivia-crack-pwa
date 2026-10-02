import type { Category, QuestionData } from '../../../shared/src/index';
import type { AppDatabase } from '../db/database';
import {
  decodeHtmlEntities,
  fetchTriviaQuestionsWithFallback
} from './triviaApiService';

export { decodeHtmlEntities };

/**
 * Fetch questions with graceful fallback across free trivia APIs
 */
export async function fetchOpenTdbQuestions(
  category: Category,
  amount: number = 5,
  db?: AppDatabase
): Promise<QuestionData[]> {
  const result = await fetchTriviaQuestionsWithFallback({
    category,
    amount,
    db,
    packId: 'default'
  });
  return result.questions;
}
