import { expect, test } from 'bun:test';
import { createBunDatabase } from '../src/db/database';

test('answer claim migration preserves legacy answer rows and backfills duplicate questions once', async () => {
  const db = await createBunDatabase(':memory:');
  await db.exec(`CREATE TABLE game_answers (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    question_id TEXT NOT NULL
  )`);
  await db.execute('INSERT INTO game_answers (id, game_id, question_id) VALUES (?, ?, ?)', ['answer-1', 'game-1', 'question-1']);
  await db.execute('INSERT INTO game_answers (id, game_id, question_id) VALUES (?, ?, ?)', ['answer-2', 'game-1', 'question-1']);

  const migration = await Bun.file(new URL('../src/db/migrations/0002_answer_claims.sql', import.meta.url)).text();
  await db.exec(migration);

  const answers = await db.queryFirst<{ count: number }>('SELECT COUNT(*) as count FROM game_answers');
  const claims = await db.queryFirst<{ count: number }>('SELECT COUNT(*) as count FROM game_answer_claims');
  expect(answers?.count).toBe(2);
  expect(claims?.count).toBe(1);
  await expect(db.execute(
    'INSERT INTO game_answer_claims (game_id, question_id) VALUES (?, ?)',
    ['game-1', 'question-1']
  )).rejects.toThrow();
});
