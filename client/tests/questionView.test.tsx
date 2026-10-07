import { expect, test, describe } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import QuestionView from '../src/components/QuestionView';
import type { ActiveQuestionSync, QuestionResult } from '../../shared/src/index';

const mockQuestion: ActiveQuestionSync = {
  id: 'q_test_1',
  category: 'SCIENCE',
  question: 'What is the chemical formula for water?',
  options: ['H2O', 'CO2', 'NaCl', 'O2'],
  durationMs: 20000,
  startedAt: Date.now() - 10000, // Started 10 seconds ago in past (e.g. during wheel spin)
  isCrown: false
};

describe('QuestionView Component Rendering & Contract Tests', () => {
  test('renders active question with enabled options and no result banner when lastResult is undefined', () => {
    const html = renderToStaticMarkup(
      <QuestionView
        question={mockQuestion}
        isMyTurn={true}
        onAnswer={() => {}}
        lastResult={undefined}
      />
    );

    // Question prompt must be rendered
    expect(html).toContain('What is the chemical formula for water?');
    expect(html).toContain('H2O');
    expect(html).toContain('CO2');
    expect(html).toContain('NaCl');
    expect(html).toContain('O2');

    // Banners for correct/incorrect must NOT be present
    expect(html).not.toContain('CORRECT ANSWER!');
    expect(html).not.toContain('INCORRECT!');

    // Option cards must not be disabled when active
    // Notice: motion.button renders <button> with options
    expect(html).not.toContain('disabled=""');
  });

  test('renders result review banner and disables options when lastResult is provided', () => {
    const mockResult: QuestionResult = {
      wasCorrect: true,
      correctIndex: 0,
      correctAnswer: 'H2O',
      selectedOption: 'H2O',
      nextPlayerId: 'p1',
      turnContinued: true
    };

    const html = renderToStaticMarkup(
      <QuestionView
        question={mockQuestion}
        isMyTurn={true}
        onAnswer={() => {}}
        lastResult={mockResult}
        onDismissResult={() => {}}
      />
    );

    // Result banner must be present
    expect(html).toContain('CORRECT ANSWER!');
    expect(html).toContain('result-banner-correct');
    expect(html).toContain('result-quote');
    expect(html).toContain('result-title');
    expect(html).toContain('text-emerald-800');
    expect(html).toContain('Answer: H2O');
    expect(html.indexOf('result-banner')).toBeLessThan(html.indexOf('What is the chemical formula'));
    expect(html).toContain('result-continue-btn');
    // Options must be disabled when lastResult is shown
    expect(html).toContain('disabled=""');
  });

  test('renders incorrect announcement when lastResult wasCorrect is false', () => {
    const mockResult: QuestionResult = {
      wasCorrect: false,
      correctIndex: 0,
      correctAnswer: 'H2O',
      selectedOption: 'CO2',
      nextPlayerId: 'p2',
      turnContinued: false
    };

    const html = renderToStaticMarkup(
      <QuestionView
        question={mockQuestion}
        isMyTurn={false}
        onAnswer={() => {}}
        lastResult={mockResult}
        onDismissResult={() => {}}
      />
    );

    expect(html).toContain('INCORRECT!');
    expect(html).toContain('result-banner-incorrect');
    expect(html).toContain('result-quote');
    expect(html).toContain('result-title');
    expect(html).toContain('text-rose-900');
    expect(html).toContain('Answer: H2O');
    expect(html).toContain('result-continue-btn');
  });
});
