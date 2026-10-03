import { beforeEach, expect, test } from 'bun:test';
import { createBunDatabase, SCHEMA_SQL, type AppDatabase } from '../src/db/database';
import { digest, login, logout, register } from '../src/services/authService';
import { sendInvitation, respondToInvitation } from '../src/services/invitationService';
import { commitGameMutation } from '../src/services/gameMutation';
import { drainPushOutbox, enqueueTest, hasSubscription, removeSubscription, saveSubscription, sendWebPush, validatePushEndpoint } from '../src/services/pushService';
import app from '../src/index';
import { asD1 } from './helpers/d1';
import type { AuthResponse, PushNotificationPayload, PushSubscriptionRequest } from '../../shared/src/index';

let db: AppDatabase;
let alice: AuthResponse;
let bob: AuthResponse;
const configured = { VAPID_PUBLIC_KEY: 'test', VAPID_PRIVATE_KEY: 'test', VAPID_SUBJECT: 'mailto:test@example.com' };
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const unb64 = (value: string) => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
async function subscription(name: string): Promise<PushSubscriptionRequest> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  return { endpoint: `https://fcm.googleapis.com/fcm/send/${name}`, keys: {
    p256dh: b64(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))), auth: b64(crypto.getRandomValues(new Uint8Array(16)))
  } };
}
const outbox = () => db.query<{ kind: string; resource_id: string; event_key: string }>('SELECT * FROM push_outbox ORDER BY kind');
async function match() {
  await sendInvitation(db, alice.account.id, bob.account.id);
  const invitation = await db.queryFirst<{ id: string }>('SELECT id FROM game_invitations');
  return (await respondToInvitation(db, invitation!.id, bob.account.id, 'accept')).gameId!;
}
beforeEach(async () => {
  db = await createBunDatabase(':memory:'); await db.exec(SCHEMA_SQL);
  alice = await register(db, { username: 'Alice' }); bob = await register(db, { username: 'Bob' });
});

test('every push route requires a session; caller identity is ignored and deletion is session-owned', async () => {
  const env = { DB: asD1(db), ...configured };
  for (const [path, method] of [['config', 'GET'], ['subscription', 'GET'], ['subscription', 'POST'], ['subscription', 'DELETE'], ['test', 'POST']]) {
    expect((await app.request(`/api/push/${path}`, { method }, env)).status).toBe(401);
  }
  const sub = await subscription('owned');
  const post = await app.request('/api/push/subscription', { method: 'POST', headers: { Authorization: `Bearer ${alice.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sub, userId: bob.account.id }) }, env);
  expect(post.status).toBe(200);
  expect(await hasSubscription(db, alice.account.id, alice.token)).toBe(true);
  await app.request('/api/push/subscription', { method: 'DELETE', headers: { Authorization: `Bearer ${bob.token}` }, body: JSON.stringify({ endpoint: sub.endpoint }) }, env);
  expect(await hasSubscription(db, alice.account.id, alice.token)).toBe(true);
  expect((await app.request('/api/push/test', { method: 'POST', headers: { Authorization: `Bearer ${bob.token}` } }, env)).status).toBe(409);
  expect((await app.request('/api/push/config', { headers: { Authorization: `Bearer ${alice.token}` } }, { DB: asD1(db) })).status).toBe(200);
  await removeSubscription(db, alice.account.id, alice.token);
  expect(await hasSubscription(db, alice.account.id, alice.token)).toBe(false);
});

test('rejects arbitrary endpoints, credential URLs and malformed encryption keys', async () => {
  for (const url of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://fcm.googleapis.com.evil.test/x', 'https://u:p@fcm.googleapis.com/x', 'https://fcm.googleapis.com:444/x']) {
    expect(() => validatePushEndpoint(url)).toThrow();
  }
  expect(validatePushEndpoint('https://web.push.apple.com/token')).toContain('apple.com');
  const sub = await subscription('bad');
  await expect(saveSubscription(db, alice.account.id, alice.token, { ...sub, keys: { ...sub.keys, auth: 'bad' } })).rejects.toThrow();
  const invalid = new Uint8Array(65); invalid[0] = 4;
  await expect(saveSubscription(db, alice.account.id, alice.token, { ...sub, keys: { ...sub.keys, p256dh: b64(invalid) } })).rejects.toThrow();
  expect(await db.query('SELECT * FROM push_subscriptions')).toHaveLength(0);
});

test('multiple devices, repeated registration, account switching and logout discard old deliveries', async () => {
  const first = await subscription('device1');
  await saveSubscription(db, alice.account.id, alice.token, first);
  await saveSubscription(db, alice.account.id, alice.token, first);
  const secondSession = await login(db, 'Alice');
  await saveSubscription(db, alice.account.id, secondSession.token, await subscription('device2'));
  await enqueueTest(db, alice.account.id, alice.token);
  await saveSubscription(db, bob.account.id, bob.token, first);
  expect(await outbox()).toHaveLength(0);
  expect(await db.query('SELECT * FROM push_subscriptions')).toHaveLength(2);
  await enqueueTest(db, bob.account.id, bob.token);
  await logout(db, bob.token);
  expect(await outbox()).toHaveLength(0);
  expect(await db.query('SELECT * FROM push_subscriptions')).toHaveLength(1);
  expect(await hasSubscription(db, alice.account.id, secondSession.token)).toBe(true);
});

test('invitation acceptance, turn changes and completion create only committed events', async () => {
  await saveSubscription(db, alice.account.id, alice.token, await subscription('alice'));
  await saveSubscription(db, bob.account.id, bob.token, await subscription('bob'));
  const gameId = await match();
  expect((await outbox()).map(row => row.kind)).toEqual(['accepted', 'invitation']);
  await db.execute('DELETE FROM push_outbox');
  await expect(commitGameMutation(db, gameId, 0, [
    { sql: 'UPDATE games SET current_turn_player_id = ? WHERE id = ?', params: [bob.account.id, gameId] },
    { sql: 'INSERT INTO table_that_does_not_exist VALUES (1)' }
  ])).rejects.toThrow();
  expect(await outbox()).toHaveLength(0);
  await commitGameMutation(db, gameId, 0, [{ sql: 'UPDATE games SET current_turn_player_id = ?, updated_at = ? WHERE id = ?', params: [bob.account.id, Date.now(), gameId] }]);
  expect((await outbox()).map(row => row.kind)).toEqual(['turn']);
  await expect(commitGameMutation(db, gameId, 0, [{ sql: 'UPDATE games SET current_turn_player_id = ? WHERE id = ?', params: [alice.account.id, gameId] }])).rejects.toThrow();
  expect(await outbox()).toHaveLength(1);
  await commitGameMutation(db, gameId, 1, [{ sql: "UPDATE games SET status = 'COMPLETED', updated_at = ? WHERE id = ?", params: [Date.now(), gameId] }]);
  expect((await outbox()).map(row => row.kind)).toEqual(['completed', 'completed']);
});

test('delivery filters stale invites and turns, collapses turn alerts, and sends badge/deep link data', async () => {
  await saveSubscription(db, alice.account.id, alice.token, await subscription('a'));
  await saveSubscription(db, bob.account.id, bob.token, await subscription('b'));
  const gameId = await match();
  const sent: PushNotificationPayload[] = [];
  await drainPushOutbox(db, configured, async (_endpoint, payload) => { sent.push(payload); return 201; });
  expect(sent).toHaveLength(1); expect(sent[0].title).toBe('Invitation accepted');
  expect(sent[0].url).toBe(`/game/${gameId}`); expect(sent[0].badgeCount).toBe(1);
  await commitGameMutation(db, gameId, 0, [{ sql: 'UPDATE games SET current_turn_player_id = ? WHERE id = ?', params: [bob.account.id, gameId] }]);
  await commitGameMutation(db, gameId, 1, [{ sql: 'UPDATE games SET current_turn_player_id = ? WHERE id = ?', params: [alice.account.id, gameId] }]);
  expect(await outbox()).toHaveLength(1);
  await drainPushOutbox(db, configured, async (_endpoint, payload) => { expect(payload.accountId).toBe(alice.account.id); return 201; });
  expect(await outbox()).toHaveLength(0);
});

test('failed delivery retries without changing gameplay, test taps deduplicate, concurrent drains lease one send', async () => {
  await saveSubscription(db, alice.account.id, alice.token, await subscription('a'));
  await enqueueTest(db, alice.account.id, alice.token); await enqueueTest(db, alice.account.id, alice.token);
  expect(await outbox()).toHaveLength(1);
  const now = Date.now(); let calls = 0;
  const failed = async () => { calls++; return 503; };
  await Promise.all([drainPushOutbox(db, configured, failed, now), drainPushOutbox(db, configured, failed, now)]);
  expect(calls).toBe(1);
  await drainPushOutbox(db, configured, failed, now + 1000); expect(calls).toBe(1);
  await drainPushOutbox(db, configured, async () => { calls++; return 201; }, now + 31000);
  expect(calls).toBe(2); expect(await outbox()).toHaveLength(0);
});

test('expired sessions, expired alerts, dead endpoints and retry caps are removed', async () => {
  await saveSubscription(db, alice.account.id, alice.token, await subscription('a'));
  await enqueueTest(db, alice.account.id, alice.token);
  await drainPushOutbox(db, configured, async () => 410);
  expect(await db.query('SELECT * FROM push_subscriptions')).toHaveLength(0);
  await saveSubscription(db, alice.account.id, alice.token, await subscription('a2'));
  await enqueueTest(db, alice.account.id, alice.token);
  await db.execute('UPDATE push_outbox SET attempts = 5');
  await drainPushOutbox(db, configured, async () => { throw new Error('Should not send'); });
  expect(await outbox()).toHaveLength(0);
  await enqueueTest(db, alice.account.id, alice.token);
  await db.execute('UPDATE push_outbox SET expires_at = 1');
  await drainPushOutbox(db, configured, async () => { throw new Error('Should not send'); });
  expect(await outbox()).toHaveLength(0);
  await enqueueTest(db, alice.account.id, alice.token);
  await db.execute('UPDATE auth_sessions SET expires_at = 1 WHERE token_hash = ?', [await digest(alice.token)]);
  await drainPushOutbox(db, configured, async () => { throw new Error('Should not send'); });
  expect(await outbox()).toHaveLength(0); expect(await db.query('SELECT * FROM push_subscriptions')).toHaveLength(0);
});

test('sender uses RFC8291 aes128gcm; ciphertext decrypts and VAPID signature verifies', async () => {
  const client = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const clientPublic = new Uint8Array(await crypto.subtle.exportKey('raw', client.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const signing = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const rawSigning = new Uint8Array(await crypto.subtle.exportKey('raw', signing.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', signing.privateKey);
  const env = { VAPID_PUBLIC_KEY: b64(rawSigning), VAPID_PRIVATE_KEY: jwk.d!, VAPID_SUBJECT: 'mailto:test@example.com' };
  const sub = { endpoint: 'https://web.push.apple.com/test', keys: { p256dh: b64(clientPublic), auth: b64(auth) } };
  const data = { accountId: alice.account.id, title: 'Your turn', body: 'Open the app', url: '/', tag: 'game:a', badgeCount: 1 };
  const originalFetch = globalThis.fetch;
  let encrypted: Uint8Array<ArrayBuffer> | undefined; let headers: Headers | undefined;
  globalThis.fetch = (async (_url, init) => { encrypted = new Uint8Array(init!.body as Uint8Array<ArrayBuffer>); headers = new Headers(init!.headers); return new Response(null, { status: 201 }); }) as typeof fetch;
  try { expect(await sendWebPush(sub.endpoint, data, sub, env, 60, 'topic')).toBe(201); }
  finally { globalThis.fetch = originalFetch; }
  expect(headers!.get('content-encoding')).toBe('aes128gcm');
  expect(encrypted!.length).toBe(4096);
  const jwt = headers!.get('authorization')!.match(/t=([^,]+)/)![1];
  const parts = jwt.split('.');
  expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, signing.publicKey, unb64(parts[2]), new TextEncoder().encode(parts.slice(0, 2).join('.')))).toBe(true);
  const salt = encrypted!.slice(0, 16); const senderRaw = encrypted!.slice(21, 86);
  const sender = await crypto.subtle.importKey('raw', senderRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: sender }, client.privateKey, 256);
  const derive = async (ikm: BufferSource, salt: BufferSource, info: Uint8Array<ArrayBuffer>, length: number) => {
    const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
  };
  const encoder = new TextEncoder();
  const info = new Uint8Array([...encoder.encode('WebPush: info\0'), ...clientPublic, ...senderRaw]);
  const ikm = await derive(secret, auth, info, 32);
  const cek = await derive(ikm, salt, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await derive(ikm, salt, encoder.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, encrypted!.slice(86)));
  let end = plain.length - 1; while (plain[end] === 0) end--;
  expect(plain[end]).toBe(2);
  expect(JSON.parse(new TextDecoder().decode(plain.slice(0, end)))).toEqual(data);
});
