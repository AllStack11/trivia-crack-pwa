import type { Category, QuestionData } from '../../../shared/src/index';
import type { AppDatabase } from '../db/database';
import { CURATED_QUESTIONS } from './curatedQuestions';

const CATEGORY_MAP: Record<Category, number[]> = {
  ART: [25],
  SCIENCE: [17, 18, 19],
  SPORTS: [21],
  ENTERTAINMENT: [11, 12, 14, 15],
  GEOGRAPHY: [22],
  HISTORY: [23]
};

interface OpenTdbQuestionItem {
  category: string;
  type: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

interface OpenTdbApiResponse {
  response_code: number;
  results: OpenTdbQuestionItem[];
}

/**
 * Fast HTML entity decoder for OpenTDB responses
 */
export function decodeHtmlEntities(text: string): string {
  if (!text.includes('&')) return text;
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

/**
 * Fetch questions from OpenTDB with graceful fallback
 */
export async function fetchOpenTdbQuestions(
  category: Category,
  amount: number = 5,
  db?: AppDatabase
): Promise<QuestionData[]> {
  const catIds = CATEGORY_MAP[category];
  const catId = catIds[Math.floor(Math.random() * catIds.length)];
  const url = `https://opentdb.com/api.php?amount=${amount}&category=${catId}&type=multiple`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = (await response.json()) as OpenTdbApiResponse;
      if (data.response_code === 0 && data.results && data.results.length > 0) {
        const parsedQuestions: QuestionData[] = data.results.map((item, idx) => ({
          id: `opentdb_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          packId: 'default',
          category,
          question: decodeHtmlEntities(item.question),
          correctAnswer: decodeHtmlEntities(item.correct_answer),
          incorrectAnswers: item.incorrect_answers.map((ans) => decodeHtmlEntities(ans)),
          difficulty: item.difficulty
        }));

        // Persist to database cache if db provided
        if (db) {
          for (const q of parsedQuestions) {
            await db.execute(
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
            ).catch(() => {
              // Silently ignore insert conflict
            });
          }
        }

        return parsedQuestions;
      }
    }
  } catch {
    // Network or rate-limit failure; fallback safely
  }

  // Fallback to local curated questions pool
  const matching = CURATED_QUESTIONS.filter((q) => q.category === category);
  return matching.slice(0, amount).map((q) => ({
    ...q,
    packId: 'default'
  }));
}
