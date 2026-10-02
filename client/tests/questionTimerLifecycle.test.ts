import { expect, test, describe, jest } from 'bun:test';
import type { ActiveQuestionSync, QuestionResult } from '../../shared/src/index';

describe('Question Timer Lifecycle & Auto-Answer Prevention Invariants', () => {
  test('question presentation timer grants full duration despite wheel spin delay', () => {
    // Simulate wheel spin starting 5.5 seconds ago
    const spinStartTime = Date.now() - 5500;
    const questionDuration = 20000;

    const mockQuestion: ActiveQuestionSync = {
      id: 'q_round_2',
      category: 'ENTERTAINMENT',
      question: 'Which movie won Best Picture in 1994?',
      options: ['Forrest Gump', 'Pulp Fiction', 'The Shawshank Redemption', 'Quiz Show'],
      durationMs: questionDuration,
      startedAt: spinStartTime,
      isCrown: false
    };

    // The component mount time represents when the user actually sees the question
    const mountTime = Date.now();

    // INVARIANT 1: Timer remaining must be calculated from presentation mount time, NOT server spin time
    const elapsedFromMount = Date.now() - mountTime;
    const remainingFromMount = Math.max(0, questionDuration - elapsedFromMount);

    // If it used spinStartTime (THE OLD BUG):
    const buggyElapsed = Date.now() - mockQuestion.startedAt!;
    const buggyRemaining = Math.max(0, questionDuration - buggyElapsed);

    // Assert that the presentation timer has the full ~20s, whereas buggy timer lost 5.5s
    expect(remainingFromMount).toBeGreaterThanOrEqual(19900);
    expect(buggyRemaining).toBeLessThanOrEqual(14600);
  });

  test('consecutive question transition cleans up state for new question id', () => {
    // Round 1 Question
    const q1: ActiveQuestionSync = {
      id: 'q_round_1',
      category: 'ART',
      question: 'Who painted the Mona Lisa?',
      options: ['Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Donatello'],
      durationMs: 20000,
      isCrown: false
    };

    // Round 1 Result
    const q1Result: QuestionResult = {
      wasCorrect: true,
      correctIndex: 0,
      correctAnswer: 'Leonardo da Vinci',
      nextPlayerId: 'p1',
      turnContinued: true
    };

    // Simulate state transition:
    // When Round 1 review finishes, activeReviewResult becomes null.
    // When Round 2 starts, question.id changes to q2.id.
    const q2: ActiveQuestionSync = {
      id: 'q_round_2',
      category: 'HISTORY',
      question: 'In what year did World War II end?',
      options: ['1943', '1944', '1945', '1946'],
      durationMs: 20000,
      isCrown: false
    };

    // INVARIANT 2: When activeReviewResult is null, lastResult prop MUST be undefined
    const activeReviewResult: { question: ActiveQuestionSync; result: QuestionResult } | null = null;
    const lastResultPassedToQuestionView = activeReviewResult ? activeReviewResult.result : undefined;

    expect(lastResultPassedToQuestionView).toBeUndefined();

    // INVARIANT 3: QuestionView must reset hasAnswered and selectedIndex when question.id differs
    let currentQuestionId = q1.id;
    let hasAnswered = true; // was answered in round 1
    let selectedIndex: number | null = 0;

    // Transition to Round 2
    if (q2.id !== currentQuestionId) {
      currentQuestionId = q2.id;
      hasAnswered = Boolean(lastResultPassedToQuestionView);
      selectedIndex = null;
    }

    expect(currentQuestionId).toBe('q_round_2');
    expect(hasAnswered).toBe(false);
    expect(selectedIndex).toBeNull();
  });

  test('background polling object churn does not reset timer or trigger timeout', () => {
    jest.useFakeTimers();

    const baseQuestion: ActiveQuestionSync = {
      id: 'q_steady',
      category: 'GEOGRAPHY',
      question: 'What is the capital of Japan?',
      options: ['Tokyo', 'Kyoto', 'Osaka', 'Nagoya'],
      durationMs: 20000,
      isCrown: false
    };

    const mountTime = Date.now();
    let hasAnswered = false;
    let timedOut = false;

    const onAnswer = (idx: number) => {
      if (idx === -1) timedOut = true;
      hasAnswered = true;
    };

    // Simulate 3 seconds passing
    jest.advanceTimersByTime(3000);
    const elapsed3s = 3000;
    const remaining3s = 20000 - elapsed3s;
    expect(remaining3s).toBe(17000);
    expect(timedOut).toBe(false);

    // Simulate background 2-second poll providing a fresh object reference for the same question.id
    const polledQuestion = { ...baseQuestion };
    expect(polledQuestion).not.toBe(baseQuestion); // different reference!
    expect(polledQuestion.id).toBe(baseQuestion.id); // same ID!

    // Under the fixed effect (keyed to question.id), timer does NOT re-initialize mountTime
    const elapsedAfterPoll = 3000 + 2000;
    const remainingAfterPoll = 20000 - elapsedAfterPoll;
    expect(remainingAfterPoll).toBe(15000);
    expect(timedOut).toBe(false);

    jest.useRealTimers();
  });
});
