CREATE TABLE IF NOT EXISTS cached_questions (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  question TEXT NOT NULL UNIQUE,
  image_url TEXT,
  correct_answer TEXT NOT NULL,
  incorrect_answers_json TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  provider TEXT NOT NULL,
  cached_at INTEGER NOT NULL,
  served_count INTEGER NOT NULL DEFAULT 0,
  last_served_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cached_questions_cat ON cached_questions(category, served_count, last_served_at);
