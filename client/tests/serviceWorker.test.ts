import { expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { IDBFactory } from 'fake-indexeddb';

const source = await Bun.file(new URL('../public/sw.js', import.meta.url)).text();
function worker() {
  const handlers = new Map<string, (event: any) => void>();
  const stored = new Map<string, Response>();
  const shown: Array<{ title: string; options: any }> = [];
  const opened: string[] = [];
  const navigated: string[] = [];
  let skipped = 0; let closed = 0; let badge = 0;
  const key = (input: any) => typeof input === 'string' ? new URL(input, 'https://trivia.test').pathname : new URL(input.url).pathname;
  const cache = {
    addAll: async (paths: string[]) => { for (const path of paths) stored.set(path, new Response(path === '/index.html' ? '<script src="/assets/hashed.js"></script><link href="/assets/hashed.css" />' : path)); },
    match: async (input: any) => stored.get(key(input))?.clone(),
    put: async (input: any, response: Response) => { stored.set(key(input), response); }
  };
  let network = async (_input: any) => new Response('fresh');
  const windows: any[] = [];
  const self = {
    location: { origin: 'https://trivia.test' },
    addEventListener: (type: string, callback: (event: any) => void) => handlers.set(type, callback),
    skipWaiting: async () => { skipped++; },
    clients: { claim: async () => {}, matchAll: async () => windows, openWindow: async (url: string) => { opened.push(url); } },
    registration: { showNotification: async (title: string, options: any) => { shown.push({ title, options }); }, getNotifications: async () => [{ close: () => { closed++; } }] },
    navigator: { setAppBadge: async (n: number) => { badge = n; }, clearAppBadge: async () => { badge = 0; } }
  };
  runInNewContext(source, { self, caches: { open: async () => cache, match: cache.match, keys: async () => ['trivia-clash-v3', 'trivia-clash-v4'], delete: async () => true }, indexedDB: new IDBFactory(), URL, Response, fetch: (input: any) => network(input) });
  async function dispatch(type: string, fields: any = {}) {
    let pending: Promise<any> | undefined; let response: Promise<Response> | undefined;
    handlers.get(type)!({ ...fields, waitUntil: (work: Promise<any>) => { pending = work; }, respondWith: (work: Promise<Response>) => { response = work; } });
    await pending;
    return response ? await response : undefined;
  }
  const owner = (accountId: string | null) => dispatch('message', { data: { type: 'PUSH_OWNER', accountId }, ports: [{ postMessage: () => {} }] });
  return { dispatch, owner, shown, stored, opened, navigated, windows, stats: () => ({ skipped, closed, badge }), offline: () => { network = async () => { throw new Error('offline'); }; } };
}

test('updates wait for explicit activation and install caches the hashed app entry assets', async () => {
  const w = worker(); await w.dispatch('install');
  expect(w.stats().skipped).toBe(0);
  expect(w.stored.has('/assets/hashed.js')).toBe(true); expect(w.stored.has('/assets/hashed.css')).toBe(true);
  await w.dispatch('message', { data: { type: 'SKIP_WAITING' } });
  expect(w.stats().skipped).toBe(1);
});

test('navigation uses fresh HTML and offline deep links fall back to the installed shell', async () => {
  const w = worker(); await w.dispatch('install');
  const request = { url: 'https://trivia.test/game/game-123', method: 'GET', mode: 'navigate' };
  expect(await (await w.dispatch('fetch', { request }))!.text()).toBe('fresh');
  w.offline();
  expect(await (await w.dispatch('fetch', { request }))!.text()).toContain('/assets/hashed.js');
  expect(await (await w.dispatch('fetch', { request: { url: 'https://trivia.test/assets/hashed.js', method: 'GET' } }))!.text()).toBe('/assets/hashed.js');
});

test('authenticated APIs, SSE, mutations and cross-origin requests are never cached or intercepted', async () => {
  const w = worker(); await w.dispatch('install'); w.offline();
  for (const request of [
    { url: 'https://trivia.test/api/me', method: 'GET' },
    { url: 'https://trivia.test/api/games/game/events', method: 'GET' },
    { url: 'https://trivia.test/foo', method: 'POST' },
    { url: 'https://api.trivia.test/api/me', method: 'GET' }
  ]) expect(await w.dispatch('fetch', { request })).toBeUndefined();
});

test('push displays visible alerts, applies badges, and notification taps focus a same-origin match', async () => {
  const w = worker(); await w.owner('alice');
  const payload = { accountId: 'alice', title: 'Your turn!', body: 'Open the app.', url: '/game/game-123', tag: 'game:123', badgeCount: 2 };
  await w.dispatch('push', { data: { json: () => payload } });
  expect(w.shown[0].title).toBe('Your turn!'); expect(w.stats().badge).toBe(2);
  w.windows.push({ url: 'https://trivia.test/', navigate: async (url: string) => { w.navigated.push(url); }, focus: async () => {} });
  await w.dispatch('notificationclick', { notification: { data: w.shown[0].options.data, close: () => {} } });
  expect(w.navigated).toEqual(['https://trivia.test/game/game-123']);
});

test('logout and account switching suppress stale details, clear badges, and close old notifications', async () => {
  const w = worker(); await w.owner('alice'); const initialClosed = w.stats().closed;
  await w.owner('alice'); expect(w.stats().closed).toBe(initialClosed);
  await w.owner(null); expect(w.stats().closed).toBe(initialClosed + 1);
  await w.dispatch('push', { data: { json: () => ({ accountId: 'alice', title: 'Old profile match', url: '/game/old', badgeCount: 9 }) } });
  expect(w.shown[0].title).toBe('Trivia Clash'); expect(w.stats().badge).toBe(0);
  await w.owner('bob');
  await w.dispatch('notificationclick', { notification: { data: { accountId: 'alice', url: '/game/old' }, close: () => {} } });
  expect(w.opened).toEqual(['https://trivia.test/']);
});

test('malformed push payloads and external click destinations produce a safe visible fallback', async () => {
  const w = worker(); await w.owner('alice');
  await w.dispatch('push', { data: { json: () => { throw new Error('bad json'); } } });
  expect(w.shown[0].title).toBe('Trivia Clash');
  await w.dispatch('push', { data: { json: () => null } }); expect(w.shown).toHaveLength(2);
  await w.dispatch('notificationclick', { notification: { data: { accountId: 'alice', url: 'https://evil.test/token' }, close: () => {} } });
  expect(w.opened).toEqual(['https://trivia.test/']);
});
