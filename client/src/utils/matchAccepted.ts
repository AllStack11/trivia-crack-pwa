import type { MatchSummary } from '../../../shared/src/index';

/**
 * Per-account set of match IDs already seen by this tab. Module-level so it survives
 * Lobby remounts (e.g. returning from a game) without notifying about old matches.
 */
const knownMatchIds = new Map<string, Set<string>>();

export function resetMatchAcceptedTracking(accountId?: string) {
  if (accountId) knownMatchIds.delete(accountId);
  else knownMatchIds.clear();
}

/**
 * Returns matches that appeared since the last observation in which the account is the
 * one to move first, i.e. an invitation this account sent was just accepted. The first
 * observation only establishes a baseline so existing matches never trigger a modal.
 */
export function detectAcceptedMatches(accountId: string, matches: MatchSummary[]): MatchSummary[] {
  const known = knownMatchIds.get(accountId);
  knownMatchIds.set(accountId, new Set(matches.map((match) => match.gameId)));
  if (!known) return [];
  return matches.filter(
    (match) =>
      !known.has(match.gameId) &&
      match.status !== 'COMPLETED' &&
      match.currentTurn.id === accountId
  );
}
