import { buildPushPayload } from '@block65/webcrypto-web-push';
import type { PushNotificationPayload, PushSubscriptionRequest } from '../../../shared/src/index';
import type { AppDatabase } from '../db/database';
import { digest } from './authService';

export interface PushEnvironment {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

export function pushConfigured(env: PushEnvironment): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY &&
    /^(mailto:|https:\/\/)/.test(env.VAPID_SUBJECT || ''));
}

function bytes(value: unknown, length: number): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value) || value.length > 100) throw new Error('Invalid subscription key');
  const result = Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
  if (result.length !== length) throw new Error('Invalid subscription key');
  return result;
}

// Only browser push services are accepted, never arbitrary caller-selected URLs.
export function validatePushEndpoint(endpoint: unknown): string {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) throw new Error('Invalid push endpoint');
  const url = new URL(endpoint);
  const host = url.hostname;
  const allowed = host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' ||
    host === 'web.push.apple.com' || host.endsWith('.notify.windows.com');
  if (!allowed || url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) throw new Error('Unsupported push endpoint');
  return url.href;
}

export async function saveSubscription(db: AppDatabase, userId: string, token: string, input: PushSubscriptionRequest): Promise<void> {
  const endpoint = validatePushEndpoint(input?.endpoint);
  const publicBytes = bytes(input?.keys?.p256dh, 65);
  bytes(input?.keys?.auth, 16);
  await crypto.subtle.importKey('raw', publicBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sessionHash = await digest(token);
  const count = await db.queryFirst<{ n: number }>('SELECT count(*) AS n FROM push_subscriptions WHERE user_id = ? AND endpoint <> ?', [userId, endpoint]);
  if ((count?.n || 0) >= 10) throw new Error('Too many notification devices');
  await db.batch([
    { sql: 'DELETE FROM push_subscriptions WHERE endpoint = ? AND (user_id <> ? OR session_hash <> ?)', params: [endpoint, userId, sessionHash] },
    { sql: `INSERT INTO push_subscriptions(id, user_id, session_hash, endpoint, p256dh, auth, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM auth_sessions WHERE token_hash = ? AND user_id = ? AND expires_at > ?)
      ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
      params: [crypto.randomUUID(), userId, sessionHash, endpoint, input.keys.p256dh, input.keys.auth, Date.now(), sessionHash, userId, Date.now()] }
  ]);
}

export async function removeSubscription(db: AppDatabase, userId: string, token: string): Promise<void> {
  await db.execute('DELETE FROM push_subscriptions WHERE user_id = ? AND session_hash = ?', [userId, await digest(token)]);
}

export async function hasSubscription(db: AppDatabase, userId: string, token: string): Promise<boolean> {
  return Boolean(await db.queryFirst('SELECT id FROM push_subscriptions WHERE user_id = ? AND session_hash = ?', [userId, await digest(token)]));
}

export async function enqueueTest(db: AppDatabase, userId: string, token: string): Promise<void> {
  const sessionHash = await digest(token);
  const now = Date.now();
  // One test per device per minute; repeat taps cannot grow the outbox unboundedly.
  await db.execute(`INSERT OR IGNORE INTO push_outbox(event_key, subscription_id, kind, resource_id, created_at, expires_at)
    SELECT ?, id, 'test', '', ?, ? FROM push_subscriptions WHERE user_id = ? AND session_hash = ?`,
    [`test:${Math.floor(now / 60000)}`, now, now + 300000, userId, sessionHash]);
}

interface Delivery {
  event_key: string; subscription_id: string; kind: string; resource_id: string;
  endpoint: string; p256dh: string; auth: string; user_id: string; attempts: number; expires_at: number;
}

async function notification(db: AppDatabase, row: Delivery): Promise<PushNotificationPayload | null> {
  if (row.kind === 'invitation') {
    if (!await db.queryFirst("SELECT id FROM game_invitations WHERE id = ? AND recipient_id = ? AND status = 'PENDING'", [row.resource_id, row.user_id])) return null;
  } else if (row.kind !== 'test') {
    const game = await db.queryFirst<{ status: string; current_turn_player_id: string }>(
      'SELECT status, current_turn_player_id FROM games WHERE id = ? AND (player1_id = ? OR player2_id = ?)', [row.resource_id, row.user_id, row.user_id]);
    if (!game || (row.kind === 'completed' ? game.status !== 'COMPLETED' : game.status !== 'IN_PROGRESS' || game.current_turn_player_id !== row.user_id)) return null;
  }
  const count = await db.queryFirst<{ n: number }>(`SELECT
    (SELECT count(*) FROM game_invitations WHERE recipient_id = ? AND status = 'PENDING') +
    (SELECT count(*) FROM games WHERE status = 'IN_PROGRESS' AND current_turn_player_id = ? AND (player1_id = ? OR player2_id = ?)) AS n`,
    [row.user_id, row.user_id, row.user_id, row.user_id]);
  const messages: Record<string, [string, string]> = {
    invitation: ['New invitation', 'Open Trivia Clash to accept or decline.'],
    accepted: ['Invitation accepted', 'Your match is ready. You play first!'],
    turn: ['Your turn!', 'Your Trivia Clash match is waiting for you.'],
    completed: ['Match complete', 'Open Trivia Clash to see the result.'],
    test: ['Notifications are working', 'This is your Trivia Clash test notification.']
  };
  const [title, body] = messages[row.kind];
  return { accountId: row.user_id, title, body, url: row.kind === 'invitation' || row.kind === 'test' ? '/' : `/game/${encodeURIComponent(row.resource_id)}`,
    tag: row.kind === 'test' ? 'test' : `${row.kind === 'invitation' ? 'invite' : 'game'}:${row.resource_id}`, badgeCount: count?.n || 0 };
}

export type PushTransport = (endpoint: string, payload: PushNotificationPayload, subscription: PushSubscriptionRequest, env: PushEnvironment, ttl: number, topic: string) => Promise<number>;
export const sendWebPush: PushTransport = async (endpoint, data, subscription, env, ttl, topic) => {
  validatePushEndpoint(endpoint);
  const request = await buildPushPayload({ data: { ...data }, options: { ttl, urgency: 'normal', topic } }, { ...subscription, expirationTime: null },
    { publicKey: env.VAPID_PUBLIC_KEY!, privateKey: env.VAPID_PRIVATE_KEY!, subject: env.VAPID_SUBJECT! });
  const response = await fetch(endpoint, { ...request, redirect: 'error', signal: AbortSignal.timeout(10000) });
  await response.body?.cancel();
  return response.status;
};

/** Bounded, leased work shared by request waitUntil and scheduled recovery. */
export async function drainPushOutbox(db: AppDatabase, env: PushEnvironment, transport: PushTransport = sendWebPush, now = Date.now()): Promise<void> {
  if (!pushConfigured(env)) return;
  await db.batch([
    { sql: 'DELETE FROM auth_sessions WHERE expires_at <= ?', params: [now] },
    { sql: 'DELETE FROM push_outbox WHERE expires_at <= ? OR attempts >= 5', params: [now] }
  ]);
  const candidates = await db.query<{ event_key: string; subscription_id: string }>(
    'SELECT event_key, subscription_id FROM push_outbox WHERE next_attempt_at <= ? AND lease_until <= ? ORDER BY created_at LIMIT 20', [now, now]);
  // At most four network requests at a time; do not monopolize the Worker.
  for (let start = 0; start < candidates.length; start += 4) {
    await Promise.all(candidates.slice(start, start + 4).map(async candidate => {
      const lease = crypto.randomUUID();
      const claimed = await db.execute(`UPDATE push_outbox SET lease_id = ?, lease_until = ?, attempts = attempts + 1
        WHERE event_key = ? AND subscription_id = ? AND lease_until <= ? AND next_attempt_at <= ?`,
        [lease, now + 60000, candidate.event_key, candidate.subscription_id, now, now]);
      if (!claimed.rowsAffected) return;
      const row = await db.queryFirst<Delivery>(`SELECT o.*, s.endpoint, s.p256dh, s.auth, s.user_id FROM push_outbox o
        JOIN push_subscriptions s ON s.id = o.subscription_id JOIN auth_sessions a ON a.token_hash = s.session_hash
        WHERE o.event_key = ? AND o.subscription_id = ? AND o.lease_id = ? AND a.expires_at > ?`,
        [candidate.event_key, candidate.subscription_id, lease, now]);
      if (!row) return;
      let status = 0;
      try {
        const payload = await notification(db, row);
        if (!payload) status = 204;
        else {
          const topic = (await digest(payload.tag)).slice(0, 32);
          // Recheck ownership after crypto/database work; a detached device must not receive queued alerts.
          if (await db.queryFirst('SELECT id FROM push_subscriptions WHERE id = ?', [row.subscription_id])) {
            status = await transport(row.endpoint, payload, { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, env,
              Math.max(1, Math.min(3600, Math.floor((row.expires_at - Date.now()) / 1000))), topic);
          } else status = 204;
        }
      } catch { /* Never log endpoints, payloads, keys, or sender errors containing credentials. */ }
      if (status === 404 || status === 410) {
        await db.execute('DELETE FROM push_subscriptions WHERE id = ?', [row.subscription_id]);
      } else if ((status >= 200 && status < 300) || (status >= 400 && status < 500 && status !== 408 && status !== 429) || row.attempts >= 5) {
        await db.execute('DELETE FROM push_outbox WHERE event_key = ? AND subscription_id = ? AND lease_id = ?', [row.event_key, row.subscription_id, lease]);
      } else {
        await db.execute('UPDATE push_outbox SET lease_id = NULL, lease_until = 0, next_attempt_at = ? WHERE event_key = ? AND subscription_id = ? AND lease_id = ?',
          [now + Math.min(900000, 30000 * 2 ** (row.attempts - 1)), row.event_key, row.subscription_id, lease]);
      }
    }));
  }
}
