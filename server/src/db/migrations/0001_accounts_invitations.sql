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
