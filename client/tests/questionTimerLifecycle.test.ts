import { expect, test } from 'bun:test';
import { WHEEL_SPIN_DURATION_MS, SPIN_RESULT_HOLD_MS } from '../../shared/src/index';
import { questionTimeRemaining } from '../src/utils/gameState';

test('reloading or receiving a new object preserves the persisted deadline', () => {
  const question = { startedAt: 10000, durationMs: 20000 };
  expect(questionTimeRemaining(question, 15500)).toBe(14500);
  expect(questionTimeRemaining({ ...question }, 20000)).toBe(10000);
  expect(questionTimeRemaining(question, 30000)).toBe(0);
  expect(questionTimeRemaining(question, 3600000)).toBe(0);
});

test('the server presentation delay keeps the countdown full during wheel animation', () => {
  const startedAt = 10000 + WHEEL_SPIN_DURATION_MS + SPIN_RESULT_HOLD_MS;
  const question = { startedAt, durationMs: 20000 };
  expect(questionTimeRemaining(question, 10000)).toBe(20000);
  expect(questionTimeRemaining(question, 10000 + WHEEL_SPIN_DURATION_MS)).toBe(20000);
  expect(questionTimeRemaining(question, startedAt)).toBe(20000);
  expect(questionTimeRemaining(question, startedAt + 1000)).toBe(19000);
});
