import type { GameStateSync, QuestionResult } from '../../../shared/src/index';
import type { AudioCue } from './audio';

export function resultCue(result: QuestionResult): AudioCue {
  if (result.stolenCrown) return 'steal';
  if (result.awardedCrown) return 'crown';
  if (result.wasCorrect) return 'correct';
  return result.selectedOption === undefined ? 'timeout' : 'incorrect';
}

/** One owner for committed match events. Initial snapshots establish a silent baseline. */
export class GameAudioTracker {
  private previous: GameStateSync | null = null;
  private results = new Set<string>();
  reset(): void { this.previous = null; this.results.clear(); }
  observe(state: GameStateSync, accountId: string): AudioCue[] {
    const previous = this.previous;
    if (previous?.id === state.id && state.revision <= previous.revision) return [];
    const resultId = state.lastResult?.question?.id;
    const freshResult = Boolean(resultId && !this.results.has(resultId));
    if (!previous || previous.id !== state.id) {
      this.reset(); this.previous = state;
      if (resultId) this.results.add(resultId);
      return [];
    }
    this.previous = state;
    if (resultId) this.results.add(resultId);
    if (state.status === 'COMPLETED') {
      return previous.status !== 'COMPLETED' ? [state.winnerId === accountId ? 'victory' : 'defeat'] : [];
    }
    const cues: AudioCue[] = [];
    if (freshResult && state.lastResult) cues.push(resultCue(state.lastResult));
    if (state.currentTurnPlayerId !== previous.currentTurnPlayerId && state.currentTurnPlayerId === accountId) cues.push('turn');
    return cues;
  }
}

/** Emits only the current second, never a backlog after a delayed timer or retry. */
export class CountdownAudioTracker {
  private seconds = new Set<number>();
  pulse(remainingMs: number, active: boolean): number | null {
    const second = Math.ceil(remainingMs / 1000);
    if (!active || second < 1 || second > 5 || this.seconds.has(second)) return null;
    this.seconds.add(second);
    return second;
  }
}
