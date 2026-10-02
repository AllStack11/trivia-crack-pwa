import type { AppDatabase } from '../db/database';

export interface GameStatement { sql: string; params?: unknown[] }

/** Optimistic concurrency check and all effects commit or roll back together. */
export async function commitGameMutation(
  db: AppDatabase, gameId: string, revision: number, statements: GameStatement[]
): Promise<void> {
  await db.batch([
    { sql: 'INSERT INTO game_mutation_guards (game_id, expected_revision) VALUES (?, ?)', params: [gameId, revision] },
    ...statements,
    { sql: 'UPDATE games SET revision = revision + 1 WHERE id = ?', params: [gameId] },
    { sql: 'DELETE FROM game_mutation_guards WHERE game_id = ?', params: [gameId] }
  ]);
}
