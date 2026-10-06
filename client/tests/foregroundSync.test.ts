import { expect, test } from 'bun:test';
import { foregroundSync } from '../src/utils/foregroundSync';

const tick = () => new Promise(resolve => setTimeout(resolve, 10));
function fixture() {
  let visible = false;
  let reads = 0, streams = 0, cancellations = 0;
  let reader: ReadableStreamDefaultController<Uint8Array>;
  const signals: AbortSignal[] = [];
  const sync = foregroundSync({
    eligible: () => visible,
    fetchState: async signal => { reads++; signals.push(signal); },
    fetchEvents: async () => {
      streams++;
      return new Response(new ReadableStream<Uint8Array>({ start(c) { reader = c; }, cancel() { cancellations++; } }));
    },
    event: event => { if (event === 'unauthorized' || event === 'sync') visible = false; },
    connected: () => {}, terminal: res => res.status === 401 || res.status === 404
  });
  return { sync, show: () => { visible = true; }, hide: () => { visible = false; },
    send: (event: string, data = '{}') => reader.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${data}\n\n`)),
    get reads() { return reads; }, get streams() { return streams; }, get cancellations() { return cancellations; } };
}

test('hidden initial load is silent; repeated resume coalesces and pause cancels readers', async () => {
  const f = fixture();
  try {
    await f.sync.resume(); expect(f.reads).toBe(0); expect(f.streams).toBe(0);
    f.show(); await Promise.all([f.sync.resume(), f.sync.resume(), f.sync.resume()]); await tick();
    expect(f.reads).toBe(1); expect(f.streams).toBe(1);
    f.hide(); await f.sync.resume(); await tick();
    expect(f.cancellations).toBe(1);
    await new Promise(resolve => setTimeout(resolve, 5200));
    expect(f.reads).toBe(1); expect(f.streams).toBe(1);
    f.show(); await f.sync.resume(); await tick();
    expect(f.reads).toBe(2); expect(f.streams).toBe(2);
  } finally { f.sync.dispose(); }
}, 10000);

test('planned rotation uses initial SSE snapshot without another REST read', async () => {
  const f = fixture();
  try {
    f.show(); await f.sync.resume(); await tick();
    f.send('reconnect', '{"refresh":false}');
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(f.streams).toBe(2); expect(f.reads).toBe(1);
    f.send('reconnect', '{"refresh":true}');
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(f.streams).toBe(3); expect(f.reads).toBe(2);
  } finally { f.sync.dispose(); }
});

test('terminal events cancel readers and never retry', async () => {
  const f = fixture();
  try {
    f.show(); await f.sync.resume(); await tick(); f.send('unauthorized');
    await new Promise(resolve => setTimeout(resolve, 1200));
    expect(f.cancellations).toBe(1); expect(f.streams).toBe(1); expect(f.reads).toBe(1);
  } finally { f.sync.dispose(); }
});

test('pause aborts a pending resume read and obsolete continuations cannot open streams', async () => {
  let release!: () => void; let signal!: AbortSignal; let streams = 0;
  const sync = foregroundSync({ eligible: () => true,
    fetchState: s => { signal = s; return new Promise<void>(resolve => { release = resolve; }); },
    fetchEvents: async () => { streams++; return new Response(); }, event: () => {}, connected: () => {}, terminal: () => false });
  const pending = sync.resume(); sync.pause(); expect(signal.aborted).toBe(true);
  release(); await pending; expect(streams).toBe(0); sync.dispose();
});

test('a transient resume failure still opens SSE; unexpected closure refreshes and backs off', async () => {
  let reads = 0, streams = 0;
  const sync = foregroundSync({ eligible: () => true,
    fetchState: async () => { reads++; if (reads === 1) throw new Error('Offline transition'); },
    fetchEvents: async () => { streams++; return new Response(''); },
    event: () => {}, connected: () => {}, terminal: () => false });
  try {
    await sync.resume(); await tick();
    expect(streams).toBe(1); expect(reads).toBe(2);
    await new Promise(resolve => setTimeout(resolve, 1400));
    expect(streams).toBe(2); expect(reads).toBe(3);
    sync.pause(); await new Promise(resolve => setTimeout(resolve, 1700));
    expect(streams).toBe(2);
  } finally { sync.dispose(); }
});

test.each([401, 404])('terminal HTTP %i stops retry and fallback', async status => {
  let eligible = true, streams = 0;
  const sync = foregroundSync({ eligible: () => eligible, fetchState: async () => {},
    fetchEvents: async () => { streams++; return new Response(null, { status }); },
    event: () => {}, connected: () => {}, terminal: res => { if (res.status === status) { eligible = false; return true; } return false; } });
  try {
    await sync.resume(); await tick(); await new Promise(resolve => setTimeout(resolve, 1300));
    expect(streams).toBe(1);
  } finally { sync.dispose(); }
});

test('late stream response from a disposed lifecycle is cancelled without callbacks', async () => {
  let resolve!: (res: Response) => void, cancelled = false, events = 0;
  const sync = foregroundSync({ eligible: () => true, fetchState: async () => {},
    fetchEvents: () => new Promise(res => { resolve = res; }), event: () => { events++; }, connected: () => {}, terminal: () => false });
  await sync.resume(); sync.dispose();
  resolve(new Response(new ReadableStream({ cancel() { cancelled = true; } })));
  await tick(); expect(cancelled).toBe(true); expect(events).toBe(0);
});

test('REST fallback continues while SSE is stalled waiting for headers', async () => {
  let reads = 0, streams = 0;
  const sync = foregroundSync({ eligible: () => true, fetchState: async () => { reads++; },
    fetchEvents: signal => {
      streams++;
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Paused')), { once: true }));
    }, event: () => {}, connected: () => {}, terminal: () => false });
  try {
    await sync.resume(); await new Promise(resolve => setTimeout(resolve, 5200));
    expect(reads).toBe(2); expect(streams).toBe(1);
    await Promise.all([sync.refresh(), sync.refresh()]);
    expect(reads).toBe(3);
  } finally { sync.dispose(); }
}, 10000);
