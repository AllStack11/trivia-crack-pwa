import { expect, test } from 'bun:test';
import { createDialogueSelector, crownReaction, DIALOGUE } from '../src/components/characters/reactions';
import { createReviewTimer } from '../src/utils/reviewTimer';
import type { Category, QuestionResult } from '../../shared/src/index';

test('dialogue is stable for repeated results and rotates without immediate repeats', () => {
  const select = createDialogueSelector();
  for (const category of Object.keys(DIALOGUE) as Category[]) {
    for (const event of ['correct', 'incorrect', 'crown', 'steal'] as const) {
      const first = select('one', category, event);
      const second = select('two', category, event);
      expect(first).not.toBe(second);
      expect(select('one', category, event)).toBe(first);
      expect(select('two', category, event)).toBe(second);
    }
  }
});

test('milestones use the crowned category, with steal taking priority', () => {
  const result: QuestionResult = { wasCorrect: true, correctIndex: 0, correctAnswer: 'Yes', nextPlayerId: 'p1', turnContinued: true };
  expect(crownReaction(result)).toBeNull();
  expect(crownReaction({ ...result, awardedCrown: 'ART' })).toEqual({ category: 'ART', event: 'crown' });
  expect(crownReaction({ ...result, awardedCrown: 'ART', stolenCrown: 'SCIENCE' })).toEqual({ category: 'SCIENCE', event: 'steal' });
});

test('review expires at six seconds; Continue finishes immediately and cancelled queued callbacks cannot cross navigation', () => {
  let now = 0;
  const jobs: { callback: () => void; at: number }[] = [];
  const timer = createReviewTimer((callback, ms) => { jobs.push({ callback, at: now + ms }); return jobs.length as unknown as ReturnType<typeof setTimeout>; }, () => {});
  let finishes = 0;
  timer.start(() => finishes++);
  expect(jobs[0].at).toBe(6000);
  now = 5999;
  expect(finishes).toBe(0);
  now = 6000; jobs[0].callback();
  expect(finishes).toBe(1);
  timer.start(() => finishes++);
  timer.dismiss();
  expect(finishes).toBe(2);
  jobs[1].callback();
  expect(finishes).toBe(2);
  timer.start(() => finishes++);
  timer.cancel();
  jobs[2].callback();
  expect(finishes).toBe(2);
  timer.start(() => finishes++);
  timer.start(() => finishes += 10);
  jobs[3].callback(); jobs[4].callback();
  expect(finishes).toBe(12);
});
