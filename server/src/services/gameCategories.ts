import { CATEGORIES, CLASSIC_CATEGORIES, type Category } from '../../../shared/src/index';
import type { AppDatabase } from '../db/database';
import { shuffled } from './questionSelection';

export async function selectGameCategories(db: AppDatabase): Promise<Category[]> {
  const custom = await db.queryFirst("SELECT id FROM questions WHERE pack_id = 'custom' AND category = 'CUSTOM' LIMIT 1");
  const available = (Object.keys(CATEGORIES) as Category[]).filter(category => category !== 'CUSTOM' || custom);
  return shuffled(available).slice(0, 6);
}

export function readGameCategories(json?: string): Category[] {
  return json ? validateGameCategories(JSON.parse(json)) : [...CLASSIC_CATEGORIES];
}

export function validateGameCategories(value: unknown): Category[] {
  if (!Array.isArray(value) || value.length !== 6 || new Set(value).size !== 6 ||
      value.some(category => typeof category !== 'string' || !Object.hasOwn(CATEGORIES, category))) {
    throw new Error('A match requires six distinct valid categories');
  }
  return value as Category[];
}
