import type { AppDatabase, CloudflareD1Database } from '../../src/db/database';

/** D1 test binding with the same all-or-nothing batch semantics as production. */
export function asD1(db: AppDatabase): CloudflareD1Database {
  const statements = new WeakMap<object, { sql: string; params: unknown[] }>();
  return {
    prepare(sql) {
      const bind = (...params: unknown[]) => {
        const statement = {
          all: async <T = unknown>() => ({ results: await db.query<T>(sql, params) }),
          first: async <T = unknown>() => db.queryFirst<T>(sql, params),
          run: async () => ({ meta: { changes: (await db.execute(sql, params)).rowsAffected } })
        };
        statements.set(statement, { sql, params });
        return statement;
      };
      const statement = { ...bind(), bind };
      statements.set(statement, { sql, params: [] });
      return statement;
    },
    exec: (sql) => db.exec(sql),
    batch: async (batch) => db.batch(batch.map((statement) => {
      const original = statements.get(statement);
      if (!original) throw new Error('Unknown D1 statement');
      return original;
    }))
  };
}
