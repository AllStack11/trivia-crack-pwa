import type { AppDatabase } from '../db/database';
import type { MatchPresenceResponse } from '../../../shared/src/index';

export const PRESENCE_TTL_MS = 30_000;

export async function updateMatchPresence(db: AppDatabase, gameId: string, playerId: string, connectionId: string, active: boolean, now = Date.now()): Promise<MatchPresenceResponse | null> {
  const game = await db.queryFirst<{ player1_id: string; player2_id: string | null; status: string }>('SELECT player1_id, player2_id, status FROM games WHERE id = ? AND (player1_id = ? OR player2_id = ?)', [gameId, playerId, playerId]);
  if (!game) return null;
  // Each tab owns its own lease; closing one tab cannot disconnect another.
  await db.batch([
    { sql: 'DELETE FROM game_presence WHERE game_id = ? AND seen_at <= ?', params: [gameId, now - PRESENCE_TTL_MS] },
    active && game.status !== 'COMPLETED'
      ? { sql: 'INSERT INTO game_presence (game_id, player_id, connection_id, seen_at) VALUES (?, ?, ?, ?) ON CONFLICT(game_id, player_id, connection_id) DO UPDATE SET seen_at = excluded.seen_at', params: [gameId, playerId, connectionId, now] }
      : { sql: 'DELETE FROM game_presence WHERE game_id = ? AND player_id = ? AND connection_id = ?', params: [gameId, playerId, connectionId] }
  ]);
  const live = await db.query<{ player_id: string }>('SELECT DISTINCT player_id FROM game_presence WHERE game_id = ? AND seen_at > ?', [gameId, now - PRESENCE_TTL_MS]);
  const players: MatchPresenceResponse['players'] = {};
  for (const id of [game.player1_id, game.player2_id]) if (id) players[id] = game.status !== 'COMPLETED' && live.some(row => row.player_id === id) ? 'live' : 'offline';
  return { gameId, players, expiresInMs: PRESENCE_TTL_MS };
}
