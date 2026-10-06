import type { AppDatabase } from './database';

/** Request-local statement accounting. Batches are charged in full before submission. */
export function queryBudget(source: AppDatabase, limit = 45) {
  let used = 0;
  const charge = (count: number) => {
    if (used + count > limit) throw new Error('Database query budget exhausted');
    used += count;
  };
  const db: AppDatabase = {
    query: (sql, params) => { charge(1); return source.query(sql, params); },
    queryFirst: (sql, params) => { charge(1); return source.queryFirst(sql, params); },
    execute: (sql, params) => { charge(1); return source.execute(sql, params); },
    // Runtime SSE never executes SQL scripts; their statement count is ambiguous.
    exec: async () => { throw new Error('SQL scripts are not allowed in budgeted requests'); },
    batch: statements => { charge(statements.length); return source.batch(statements); }
  };
  return { db, get used() { return used; }, fits: (count: number) => used + count <= limit };
}
