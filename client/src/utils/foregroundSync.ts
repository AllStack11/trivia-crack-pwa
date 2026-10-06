import { readGameEvents } from './gameEvents';
import type { GameReconnectEvent } from '../../../shared/src/index';

interface Options {
  eligible(): boolean;
  fetchState(signal: AbortSignal): Promise<void>;
  fetchEvents(signal: AbortSignal): Promise<Response>;
  event(event: string, data: string): void;
  connected(value: boolean): void;
  terminal(response: Response): boolean;
}

/** One lifecycle owns requests, readers and timers. Pause invalidates every callback. */
export function foregroundSync(options: Options) {
  let disposed = false;
  let epoch = 0;
  let active = false;
  let connected = false;
  let stream: AbortController | undefined;
  let read: { controller: AbortController; promise: Promise<void> } | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let fallback: ReturnType<typeof setInterval> | undefined;
  let backoff = 1000;
  const eligible = () => !disposed && options.eligible();
  const refresh = (): Promise<void> => {
    if (!eligible()) return Promise.resolve();
    if (read) return read.promise;
    const controller = new AbortController();
    const pending = { controller, promise: Promise.resolve() };
    read = pending;
    pending.promise = options.fetchState(controller.signal).catch(() => {}).finally(() => {
      if (read === pending) read = undefined;
    });
    return pending.promise;
  };
  const pause = () => {
    epoch++;
    active = false;
    connected = false;
    stream?.abort(); stream = undefined;
    read?.controller.abort(); read = undefined;
    clearTimeout(retry); retry = undefined;
    clearInterval(fallback); fallback = undefined;
    options.connected(false);
  };
  const connect = async (version: number) => {
    if (!eligible() || epoch !== version || stream) return;
    const controller = new AbortController();
    stream = controller;
    let planned = false;
    let needsRefresh = false;
    try {
      const response = await options.fetchEvents(controller.signal);
      if (epoch !== version || !eligible()) { await response.body?.cancel(); return; }
      if (options.terminal(response)) { pause(); return; }
      if (!response.ok) throw new Error('Stream unavailable');
      connected = true;
      options.connected(true);
      await readGameEvents(response, (event, data) => {
        if (epoch !== version || !eligible()) return;
        if (event === 'reconnect') {
          planned = true;
          needsRefresh = (JSON.parse(data) as GameReconnectEvent).refresh;
          controller.abort();
        } else {
          options.event(event, data);
          if (event === 'sync') backoff = 1000;
          if (!eligible()) pause();
        }
      }, controller.signal);
    } catch { /* Visible fallback recovers transport errors. */ }
    finally {
      if (stream === controller) { stream = undefined; connected = false; options.connected(false); }
    }
    if (!eligible() || epoch !== version) return;
    if (!planned || needsRefresh) await refresh();
    if (!eligible() || epoch !== version) return;
    const delay = planned ? 100 + Math.random() * 200 : backoff + Math.random() * 250;
    if (!planned) backoff = Math.min(backoff * 1.5, 10000);
    retry = setTimeout(() => { retry = undefined; void connect(version); }, delay);
  };
  const resume = async () => {
    if (!eligible()) { pause(); return; }
    if (active) return;
    active = true;
    const version = epoch;
    fallback = setInterval(() => { if (eligible() && !connected) void refresh(); }, 5000);
    await refresh();
    if (epoch === version && eligible()) void connect(version);
  };
  return { refresh, resume, pause, dispose: () => { disposed = true; pause(); } };
}
