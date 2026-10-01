export interface AppDatabase {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  queryFirst<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }>;
  exec(sql: string): Promise<void>;
}

// Minimal interface for Cloudflare D1 Database binding
export interface CloudflareD1Database {
  prepare(query: string): {
    bind(...values: unknown[]): {
      all<T = unknown>(): Promise<{ results?: T[] }>;
      first<T = unknown>(): Promise<T | null>;
      run(): Promise<{ meta?: { changes?: number } }>;
    };
    all<T = unknown>(): Promise<{ results?: T[] }>;
    first<T = unknown>(): Promise<T | null>;
    run(): Promise<{ meta?: { changes?: number } }>;
  };
  exec(query: string): Promise<unknown>;
}

// In-memory or shared instance for local dev
let localDbInstance: AppDatabase | null = null;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  invite_code TEXT UNIQUE NOT NULL,
  player1_id TEXT NOT NULL,
  player2_id TEXT,
  status TEXT NOT NULL DEFAULT 'WAITING',
  current_turn_player_id TEXT NOT NULL,
  crown_gauge INTEGER NOT NULL DEFAULT 0,
  round_number INTEGER NOT NULL DEFAULT 1,
  max_rounds INTEGER NOT NULL DEFAULT 25,
  active_question_json TEXT,
  active_mode TEXT NOT NULL DEFAULT 'SPIN',
  winner_id TEXT,
  win_reason TEXT,
  pack_ids_json TEXT NOT NULL DEFAULT '["default"]',
  last_result_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS game_crowns (
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(game_id, player_id, category)
);

CREATE TABLE IF NOT EXISTS question_packs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  image_url TEXT,
  correct_answer TEXT NOT NULL,
  incorrect_answers_json TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  FOREIGN KEY(pack_id) REFERENCES question_packs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS game_answers (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  time_spent_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_games_invite ON games(invite_code);
CREATE INDEX IF NOT EXISTS idx_questions_pack_cat ON questions(pack_id, category);
CREATE INDEX IF NOT EXISTS idx_game_crowns_lookup ON game_crowns(game_id, player_id);
CREATE INDEX IF NOT EXISTS idx_game_answers_lookup ON game_answers(game_id, player_id);
`;

/**
 * Cloudflare D1 Adapter
 */
export function createD1Database(d1: CloudflareD1Database): AppDatabase {
  return {
    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
      const stmt = d1.prepare(sql);
      const res = await (params.length > 0 ? stmt.bind(...params) : stmt).all<T>();
      return res.results || [];
    },
    async queryFirst<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
      const stmt = d1.prepare(sql);
      const res = await (params.length > 0 ? stmt.bind(...params) : stmt).first<T>();
      return res;
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number }> {
      const stmt = d1.prepare(sql);
      const res = await (params.length > 0 ? stmt.bind(...params) : stmt).run();
      return { rowsAffected: res.meta?.changes ?? 0 };
    },
    async exec(sql: string): Promise<void> {
      await d1.exec(sql);
    }
  };
}

/**
 * Bun SQLite Adapter (bun:sqlite)
 * Platform-specific module imported dynamically at runtime boundary to support dual Cloudflare/Bun runtimes.
 */
export async function createBunDatabase(filename: string = 'trivia-clash.sqlite'): Promise<AppDatabase> {
  // Platform exception: bun:sqlite is only present in Bun runtime
  interface BunSqliteModule {
    Database: new (filename: string) => {
      run: (sql: string) => void;
      exec: (sql: string) => void;
      query: (sql: string) => {
        all: (...params: (string | number | boolean | null)[]) => unknown[];
        get: (...params: (string | number | boolean | null)[]) => unknown;
        run: (...params: (string | number | boolean | null)[]) => { changes?: number };
      };
    };
  }
  const modLoader = new Function('return import("bun:sqlite")') as () => Promise<BunSqliteModule>;
  const { Database } = await modLoader();
  const db = new Database(filename);
  db.run('PRAGMA foreign_keys = ON;');
  db.run('PRAGMA journal_mode = WAL;');

  return {
    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
      const stmt = db.query(sql);
      return stmt.all(...(params as (string | number | boolean | null)[])) as T[];
    },
    async queryFirst<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
      const stmt = db.query(sql);
      return (stmt.get(...(params as (string | number | boolean | null)[])) as T) || null;
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number }> {
      const stmt = db.query(sql);
      const res = stmt.run(...(params as (string | number | boolean | null)[]));
      return { rowsAffected: res.changes ?? 0 };
    },
    async exec(sql: string): Promise<void> {
      db.exec(sql);
    }
  };
}

/**
 * Factory function to retrieve or create the active database instance.
 */
export async function getDatabase(env?: { DB?: CloudflareD1Database }): Promise<AppDatabase> {
  if (env?.DB) {
    return createD1Database(env.DB);
  }

  if (localDbInstance) {
    return localDbInstance;
  }

  localDbInstance = await createBunDatabase('trivia-clash.sqlite');

  // Auto-migrate schema on local startup
  await localDbInstance.exec(SCHEMA_SQL);
  return localDbInstance;
}
