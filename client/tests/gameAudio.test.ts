import { expect, test } from 'bun:test';
import type { GameStateSync, QuestionResult } from '../../shared/src/index';
import { CountdownAudioTracker, GameAudioTracker, resultCue } from '../src/utils/gameAudio';
const state = (revision: number, extra: Partial<GameStateSync> = {}): GameStateSync => ({
  id: 'game', revision, status: 'IN_PROGRESS', mode: 'SPIN', updatedAt: revision,
  players: { p1: { id: 'p1', username: 'One', crowns: [], crownGauge: 0, score: 0, isConnected: true }, p2: null },
  currentTurnPlayerId: 'p1', roundNumber: 1, maxRounds: 25, ...extra,
});
const result = (id = 'occurrence'): QuestionResult => ({
  wasCorrect: true, correctIndex: 0, correctAnswer: 'Yes', selectedOption: 'Yes',
  nextPlayerId: 'p1', turnContinued: true,
  question: { id, category: 'SCIENCE', question: '?', options: ['Yes'], startedAt: 1000, durationMs: 20000, isCrown: false },
});
test('initial restoration is silent, including old results and completed matches', () => {
  const tracker = new GameAudioTracker();
  expect(tracker.observe(state(10, { lastResult: result(), status: 'COMPLETED', winnerId: 'p1' }), 'p1')).toEqual([]);
  expect(tracker.observe(state(11, { lastResult: result(), status: 'COMPLETED', winnerId: 'p1' }), 'p1')).toEqual([]);
});
test('REST/SSE repetition and reordered snapshots play one result per occurrence', () => {
  const tracker = new GameAudioTracker(); tracker.observe(state(1), 'p1');
  expect(tracker.observe(state(2, { lastResult: result() }), 'p1')).toEqual(['correct']);
  expect(tracker.observe(state(2, { lastResult: result() }), 'p1')).toEqual([]);
  expect(tracker.observe(state(1), 'p1')).toEqual([]);
  expect(tracker.observe(state(3, { lastResult: result() }), 'p1')).toEqual([]);
  expect(tracker.observe(state(4, { lastResult: result('replay-occurrence') }), 'p1')).toEqual(['correct']);
});
test('completion supersedes crown and answer cues, and plays once', () => {
  const tracker = new GameAudioTracker(); tracker.observe(state(1), 'p1');
  const complete = state(2, { status: 'COMPLETED', winnerId: 'p1', lastResult: { ...result(), awardedCrown: 'SCIENCE' } });
  expect(tracker.observe(complete, 'p1')).toEqual(['victory']);
  expect(tracker.observe({ ...complete, revision: 3 }, 'p1')).toEqual([]);
  const loser = new GameAudioTracker(); loser.observe(state(1), 'p2');
  expect(loser.observe(complete, 'p2')).toEqual(['defeat']);
});
test('crown and steal replace success; confirmed timeout differs from wrong answer', () => {
  expect(resultCue({ ...result(), awardedCrown: 'SCIENCE' })).toBe('crown');
  expect(resultCue({ ...result(), stolenCrown: 'ART' })).toBe('steal');
  expect(resultCue({ ...result(), wasCorrect: false })).toBe('incorrect');
  expect(resultCue({ ...result(), wasCorrect: false, selectedOption: undefined })).toBe('timeout');
});
test('navigation resets the baseline and turn prompts only notify the incoming player', () => {
  const tracker = new GameAudioTracker(); tracker.observe(state(1), 'p2');
  expect(tracker.observe(state(2, { currentTurnPlayerId: 'p2' }), 'p2')).toEqual(['turn']);
  expect(tracker.observe(state(3, { currentTurnPlayerId: 'p1' }), 'p2')).toEqual([]);
  expect(tracker.observe(state(20, { id: 'other', lastResult: result() }), 'p2')).toEqual([]);
  tracker.reset(); expect(tracker.observe(state(30, { lastResult: result() }), 'p2')).toEqual([]);
});
test('countdown uses current persisted time without repeats or a delayed backlog', () => {
  const tracker = new CountdownAudioTracker();
  expect(tracker.pulse(6000, true)).toBeNull();
  expect(tracker.pulse(4990, true)).toBe(5);
  expect(tracker.pulse(4900, true)).toBeNull();
  expect(tracker.pulse(2100, true)).toBe(3);
  expect(tracker.pulse(900, false)).toBeNull();
  expect(tracker.pulse(900, true)).toBe(1);
  expect(tracker.pulse(0, true)).toBeNull();
});
test('failed-answer retry resumes remaining pulses without replaying prior pulses', () => {
  const tracker = new CountdownAudioTracker();
  expect(tracker.pulse(4500, true)).toBe(5);
  expect(tracker.pulse(4300, false)).toBeNull();
  expect(tracker.pulse(4100, true)).toBeNull();
  expect(tracker.pulse(3500, true)).toBe(4);
});
