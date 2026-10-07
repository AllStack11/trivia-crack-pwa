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
  other_crown_gauge INTEGER NOT NULL DEFAULT 0,
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
  updated_at INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0
);


-- The guard and all game writes share one D1 batch / SQLite transaction.
-- A stale revision aborts the entire batch before any answer or crown is changed.
CREATE TABLE IF NOT EXISTS game_presence (
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  seen_at INTEGER NOT NULL,
  PRIMARY KEY(game_id, player_id, connection_id)
);

CREATE TABLE IF NOT EXISTS game_mutation_guards (
  game_id TEXT PRIMARY KEY,
  expected_revision INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS validate_game_mutation
BEFORE INSERT ON game_mutation_guards
WHEN NOT EXISTS (SELECT 1 FROM games WHERE id = NEW.game_id AND revision = NEW.expected_revision)
BEGIN
  SELECT RAISE(ABORT, 'Game changed, refresh and try again');
END;

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


CREATE TABLE IF NOT EXISTS question_ingestion (
  id TEXT PRIMARY KEY,
  lease_token TEXT NOT NULL,
  next_allowed_at INTEGER NOT NULL,
  last_completed_at INTEGER,
  last_added INTEGER NOT NULL DEFAULT 0
);

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

-- Outbox rows are created by the same transaction as the underlying game change.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  session_hash TEXT NOT NULL REFERENCES auth_sessions(token_hash) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS push_outbox (
  event_key TEXT NOT NULL,
  subscription_id TEXT NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('invitation', 'accepted', 'turn', 'completed', 'test')),
  resource_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  lease_id TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(event_key, subscription_id)
);
CREATE INDEX IF NOT EXISTS idx_push_due ON push_outbox(next_attempt_at, lease_until);

CREATE TRIGGER IF NOT EXISTS push_invitation
AFTER INSERT ON game_invitations WHEN NEW.status = 'PENDING'
BEGIN
  INSERT OR IGNORE INTO push_outbox(event_key, subscription_id, kind, resource_id, created_at, expires_at)
  SELECT 'invite:' || NEW.id, id, 'invitation', NEW.id, NEW.created_at, NEW.created_at + 86400000
  FROM push_subscriptions WHERE user_id = NEW.recipient_id;
END;

CREATE TRIGGER IF NOT EXISTS push_accepted
AFTER UPDATE OF status ON game_invitations WHEN OLD.status = 'PENDING' AND NEW.status = 'ACCEPTED'
BEGIN
  INSERT OR IGNORE INTO push_outbox(event_key, subscription_id, kind, resource_id, created_at, expires_at)
  SELECT 'accepted:' || NEW.id, id, 'accepted', NEW.game_id, NEW.updated_at, NEW.updated_at + 3600000
  FROM push_subscriptions WHERE user_id = NEW.sender_id;
END;

CREATE TRIGGER IF NOT EXISTS push_turn
AFTER UPDATE OF current_turn_player_id ON games
WHEN NEW.status = 'IN_PROGRESS' AND OLD.current_turn_player_id <> NEW.current_turn_player_id
BEGIN
  DELETE FROM push_outbox WHERE kind = 'turn' AND resource_id = NEW.id;
  INSERT OR IGNORE INTO push_outbox(event_key, subscription_id, kind, resource_id, created_at, expires_at)
  SELECT 'turn:' || NEW.id || ':' || (NEW.revision + 1), id, 'turn', NEW.id, NEW.updated_at, NEW.updated_at + 3600000
  FROM push_subscriptions WHERE user_id = NEW.current_turn_player_id;
END;

CREATE TRIGGER IF NOT EXISTS push_completed
AFTER UPDATE OF status ON games WHEN OLD.status <> 'COMPLETED' AND NEW.status = 'COMPLETED'
BEGIN
  DELETE FROM push_outbox WHERE kind IN ('turn', 'accepted') AND resource_id = NEW.id;
  INSERT OR IGNORE INTO push_outbox(event_key, subscription_id, kind, resource_id, created_at, expires_at)
  SELECT 'completed:' || NEW.id, id, 'completed', NEW.id, NEW.updated_at, NEW.updated_at + 86400000
  FROM push_subscriptions WHERE user_id IN (NEW.player1_id, NEW.player2_id);
END;
