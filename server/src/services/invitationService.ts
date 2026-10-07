import type { AccountSummary, InvitationSummary, MatchSummary } from '../../../shared/src/index';
import { selectGameCategories } from './gameCategories';
import type { AppDatabase } from '../db/database';

interface InvitationRow {
  id: string;
  sender_id: string;
  sender_username: string;
  recipient_id: string;
  recipient_username: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  created_at: number;
  game_id: string | null;
  pack_ids_json: string;
}

function toInvitation(row: InvitationRow): InvitationSummary {
  return {
    id: row.id,
    sender: { id: row.sender_id, username: row.sender_username },
    recipient: { id: row.recipient_id, username: row.recipient_username },
    status: row.status,
    createdAt: row.created_at,
    gameId: row.game_id
  };
}

const invitationSelect = `SELECT i.id, i.sender_id, su.username AS sender_username,
  i.recipient_id, ru.username AS recipient_username, i.status, i.created_at, i.game_id, i.pack_ids_json
  FROM game_invitations i JOIN users su ON su.id = i.sender_id JOIN users ru ON ru.id = i.recipient_id`;

export async function listInvitations(db: AppDatabase, userId: string): Promise<InvitationSummary[]> {
  const rows = await db.query<InvitationRow>(
    `${invitationSelect} WHERE i.recipient_id = ? AND i.status = 'PENDING' ORDER BY i.created_at DESC, i.id`, [userId]
  );
  return rows.map(toInvitation);
}

export async function sendInvitation(db: AppDatabase, senderId: string, recipientId: string, packIds: string[] = ['default']): Promise<void> {
  if (!recipientId || senderId === recipientId) throw new Error('Choose another player to invite');
  const recipient = await db.queryFirst<{ user_id: string }>('SELECT user_id FROM accounts WHERE user_id = ?', [recipientId]);
  if (!recipient) throw new Error('Player not found');
  const pending = await db.queryFirst<{ id: string }>(
    `SELECT id FROM game_invitations WHERE sender_id = ? AND recipient_id = ? AND status = 'PENDING'`,
    [senderId, recipientId]
  );
  if (pending) throw new Error('You already have a pending invitation for this player');
  const activeGame = await db.queryFirst<{ id: string }>(
    `SELECT id FROM games WHERE status != 'COMPLETED'
     AND ((player1_id = ? AND player2_id = ?) OR (player1_id = ? AND player2_id = ?))`,
    [senderId, recipientId, recipientId, senderId]
  );
  if (activeGame) throw new Error('You already have an active game with this player');
  const cleanPacks = Array.isArray(packIds) && packIds.length ? [...new Set(packIds.filter((id) => typeof id === 'string' && id.length <= 128))] : ['default'];
  try {
    await db.execute(
      `INSERT INTO game_invitations (id, sender_id, recipient_id, status, pack_ids_json, created_at, updated_at)
       VALUES (?, ?, ?, 'PENDING', ?, ?, ?)`,
      [`invite_${crypto.randomUUID()}`, senderId, recipientId, JSON.stringify(cleanPacks.length ? cleanPacks : ['default']), Date.now(), Date.now()]
    );
  } catch (error) {
    if (error instanceof Error && /unique|constraint/i.test(error.message)) {
      throw new Error('You already have a pending invitation for this player');
    }
    throw error;
  }
}

export async function respondToInvitation(
  db: AppDatabase,
  invitationId: string,
  recipientId: string,
  decision: 'accept' | 'decline'
): Promise<{ gameId?: string }> {
  const row = await db.queryFirst<InvitationRow>(`${invitationSelect} WHERE i.id = ?`, [invitationId]);
  if (!row) throw new Error('Invitation not found');
  if (row.recipient_id !== recipientId) throw new Error('Only the recipient can respond to this invitation');
  if (row.status !== 'PENDING') throw new Error('Invitation is no longer pending');
  const now = Date.now();
  if (decision === 'decline') {
    const result = await db.execute(
      `UPDATE game_invitations SET status = 'DECLINED', updated_at = ? WHERE id = ? AND recipient_id = ? AND status = 'PENDING'`,
      [now, invitationId, recipientId]
    );
    if (result.rowsAffected !== 1) throw new Error('Invitation is no longer pending');
    return {};
  }
  const gameId = `game_${crypto.randomUUID()}`;
  const packIds = JSON.parse(row.pack_ids_json) as string[];
  const legacyCode = `LEGACY-${crypto.randomUUID()}`;
  const activeCategories = await selectGameCategories(db);
  await db.batch([
    {
      sql: `INSERT INTO games (id, invite_code, player1_id, player2_id, status, current_turn_player_id,
        crown_gauge, round_number, max_rounds, active_question_json, active_mode, winner_id, win_reason,
        pack_ids_json, active_categories_json, last_result_json, created_at, updated_at)
        SELECT ?, ?, ?, ?, 'IN_PROGRESS', ?, 0, 1, 25, NULL, 'SPIN', NULL, NULL, ?, ?, NULL, ?, ?
        WHERE EXISTS (SELECT 1 FROM game_invitations WHERE id = ? AND recipient_id = ? AND status = 'PENDING')`,
      params: [gameId, legacyCode, row.sender_id, row.recipient_id, row.sender_id, JSON.stringify(packIds), JSON.stringify(activeCategories), now, now, invitationId, recipientId]
    },
    {
      sql: `UPDATE game_invitations SET status = 'ACCEPTED', game_id = ?, updated_at = ?
        WHERE id = ? AND recipient_id = ? AND status = 'PENDING'`,
      params: [gameId, now, invitationId, recipientId]
    }
  ]);
  const final = await db.queryFirst<{ status: string; game_id: string }>(
    'SELECT status, game_id FROM game_invitations WHERE id = ?', [invitationId]
  );
  if (!final || final.status !== 'ACCEPTED' || final.game_id !== gameId) {
    await db.execute('DELETE FROM games WHERE id = ?', [gameId]);
    throw new Error('Invitation is no longer pending');
  }
  return { gameId };
}

export async function listMatches(db: AppDatabase, userId: string): Promise<MatchSummary[]> {
  const rows = await db.query<{
    game_id: string; opponent_id: string; opponent_username: string; status: MatchSummary['status'];
    turn_id: string; turn_username: string; updated_at: number;
  }>(
    `SELECT g.id AS game_id, opponent.id AS opponent_id, opponent.username AS opponent_username,
      g.status, current_user.id AS turn_id, current_user.username AS turn_username, g.updated_at
     FROM games g
     JOIN users opponent ON opponent.id = CASE WHEN g.player1_id = ? THEN g.player2_id ELSE g.player1_id END
     JOIN users current_user ON current_user.id = g.current_turn_player_id
     WHERE (g.player1_id = ? OR g.player2_id = ?) AND EXISTS (
       SELECT 1 FROM accounts a WHERE a.user_id = opponent.id
     )
     ORDER BY g.updated_at DESC, g.id`, [userId, userId, userId]
  );
  return rows.map((row) => ({
    gameId: row.game_id,
    opponent: { id: row.opponent_id, username: row.opponent_username } satisfies AccountSummary,
    status: row.status,
    currentTurn: { id: row.turn_id, username: row.turn_username },
    updatedAt: row.updated_at
  }));
}

export async function isGameParticipant(db: AppDatabase, gameId: string, userId: string): Promise<boolean> {
  const row = await db.queryFirst<{ id: string }>(
    'SELECT id FROM games WHERE id = ? AND (player1_id = ? OR player2_id = ?)', [gameId, userId, userId]
  );
  return row !== null;
}
