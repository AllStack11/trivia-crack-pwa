import { expect, test } from 'bun:test';
import { createBunDatabase, SCHEMA_SQL } from '../src/db/database';

test('the full migration chain initializes an empty database and matches the local schema', async () => {
  const migrated = await createBunDatabase(':memory:');
  const local = await createBunDatabase(':memory:');
  await migrated.exec(await Bun.file(new URL('../src/db/migrations/0001_initial_schema.sql', import.meta.url)).text());
  await local.exec(SCHEMA_SQL);
  const objects = "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name";
  expect(await migrated.query(objects)).toEqual(await local.query(objects));
  const canonical = await createBunDatabase(':memory:');
  await canonical.exec(await Bun.file(new URL('../src/db/schema.sql', import.meta.url)).text());
  expect(await migrated.query(objects)).toEqual(await canonical.query(objects));
  await migrated.execute('INSERT INTO users VALUES (?, ?, ?)', ['p1', 'Player', 1]);
  await migrated.execute("INSERT INTO accounts VALUES (?, ?, ?, ?, '')", ['p1', 'player@trivia.local', 'player@trivia.local', 'player']);
  expect(await migrated.queryFirst('SELECT normalized_username FROM accounts')).toEqual({ normalized_username: 'player' });
});
