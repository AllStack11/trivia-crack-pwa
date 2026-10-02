-- Trivia Clash SQLite / Cloudflare D1 Schema

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
  last_spin_json TEXT,
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

CREATE TABLE IF NOT EXISTS game_answer_claims (
  game_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  PRIMARY KEY (game_id, question_id)
);
INSERT OR IGNORE INTO game_answer_claims (game_id, question_id)
  SELECT game_id, question_id FROM game_answers;

CREATE INDEX IF NOT EXISTS idx_games_invite ON games(invite_code);
CREATE INDEX IF NOT EXISTS idx_questions_pack_cat ON questions(pack_id, category);
CREATE INDEX IF NOT EXISTS idx_game_crowns_lookup ON game_crowns(game_id, player_id);
CREATE INDEX IF NOT EXISTS idx_game_answers_lookup ON game_answers(game_id, player_id);

CREATE TABLE IF NOT EXISTS accounts (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL UNIQUE,
  normalized_username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS game_invitations (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES accounts(user_id),
  recipient_id TEXT NOT NULL REFERENCES accounts(user_id),
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
  pack_ids_json TEXT NOT NULL DEFAULT '["default"]',
  game_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(normalized_username);
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(normalized_email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry ON auth_sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_invitations_recipient_status ON game_invitations(recipient_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_invitations_pair_status ON game_invitations(sender_id, recipient_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_pending_pair ON game_invitations(sender_id, recipient_id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_games_players_updated ON games(player1_id, player2_id, updated_at);
