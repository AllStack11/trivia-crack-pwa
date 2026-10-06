import { beforeEach, describe, expect, test } from 'bun:test';
import type { MatchSummary } from '../../shared/src/index';
import { detectAcceptedMatches, resetMatchAcceptedTracking } from '../src/utils/matchAccepted';

const me = { id: 'me', username: 'Me' };
const them = { id: 'them', username: 'Them' };
const match = (gameId: string, currentTurn = me, status: MatchSummary['status'] = 'IN_PROGRESS'): MatchSummary =>
  ({ gameId, opponent: them, status, currentTurn, updatedAt: 1 });

describe('detectAcceptedMatches', () => {
  beforeEach(() => resetMatchAcceptedTracking());

  test('first observation is a baseline and never notifies', () => {
    expect(detectAcceptedMatches('me', [match('g1')])).toEqual([]);
  });

  test('notifies when a new match appears where the account moves first', () => {
    detectAcceptedMatches('me', []);
    const result = detectAcceptedMatches('me', [match('g1')]);
    expect(result.map((m) => m.gameId)).toEqual(['g1']);
    expect(detectAcceptedMatches('me', [match('g1')])).toEqual([]);
  });

  test('does not notify the accepting player, whose opponent moves first', () => {
    detectAcceptedMatches('me', []);
    expect(detectAcceptedMatches('me', [match('g1', them)])).toEqual([]);
  });

  test('ignores known matches whose turn later changes to the account', () => {
    detectAcceptedMatches('me', [match('g1', them)]);
    expect(detectAcceptedMatches('me', [match('g1', me)])).toEqual([]);
  });
});
