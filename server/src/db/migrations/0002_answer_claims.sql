CREATE TABLE IF NOT EXISTS game_answer_claims (
  game_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  PRIMARY KEY (game_id, question_id)
);
INSERT OR IGNORE INTO game_answer_claims (game_id, question_id)
  SELECT game_id, question_id FROM game_answers;
