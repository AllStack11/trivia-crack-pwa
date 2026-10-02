import { expect, test } from 'bun:test';
import { readGameEvents } from '../src/utils/gameEvents';
import { isNewGameState } from '../src/utils/gameState';
import type { GameStateSync } from '../../shared/src/index';

const state = (id: string, revision: number): GameStateSync => ({
  id, revision, status: 'IN_PROGRESS', players: { p1: { id: 'p1', username: 'Alice', crowns: [], crownGauge: 0, score: 0, isConnected: true }, p2: null },
  currentTurnPlayerId: 'p1', roundNumber: 1, maxRounds: 25, mode: 'SPIN', updatedAt: 1
});

test('delayed polls and SSE cannot overwrite newer revisions or a different match', () => {
  const newest = state('current-game', 8);
  expect(isNewGameState(newest, state('current-game', 7), 'current-game')).toBe(false);
  expect(isNewGameState(newest, state('current-game', 8), 'current-game')).toBe(false);
  expect(isNewGameState(newest, state('previous-game', 100), 'current-game')).toBe(false);
  expect(isNewGameState(newest, state('current-game', 9), 'current-game')).toBe(true);
});

test('fetch SSE parser handles fragmented UTF-8, CRLF, multiline data and heartbeat frames', async () => {
  const encoded = new TextEncoder().encode('event: sync\r\ndata: {"name":"é"}\r\n\r\nevent: ping\ndata: {}\n\nevent: custom\ndata: first\ndata: second\n\n');
  const stream = new ReadableStream<Uint8Array>({ start(controller) {
    for (const byte of encoded) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } });
  const events: Array<[string, string]> = [];
  await readGameEvents(new Response(stream), (event, data) => events.push([event, data]));
  expect(events).toEqual([['sync', '{"name":"é"}'], ['ping', '{}'], ['custom', 'first\nsecond']]);
});


test('a failed event handler cancels the transport and releases its reader', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new TextEncoder().encode('event: sync\ndata: invalid JSON\n\n')); },
    cancel() { cancelled = true; }
  });
  await expect(readGameEvents(new Response(stream), (_event, data) => { JSON.parse(data); })).rejects.toThrow();
  expect(cancelled).toBe(true);
  expect(stream.locked).toBe(false);
});
