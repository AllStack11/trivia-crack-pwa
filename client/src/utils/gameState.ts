import type { ActiveQuestionSync, GameStateSync } from '../../../shared/src/index';

export function questionTimeRemaining(question: Pick<ActiveQuestionSync, 'startedAt' | 'durationMs'>, now = Date.now()): number {
  return Math.max(0, Math.min(question.durationMs, question.startedAt + question.durationMs - now));
}

export function isNewGameState(previous: GameStateSync | null, next: GameStateSync, gameId: string | null): boolean {
  return next.id === gameId && (!previous || next.revision > previous.revision);
}
