import type { Category, QuestionResult } from '../../../../shared/src/index';

export const RESULT_REVIEW_MS = 6000;
export const SIDEKICK_MS = 4000;
export type ReactionEvent = 'correct' | 'incorrect' | 'crown' | 'steal';
export const DIALOGUE: Record<Category, Record<ReactionEvent, string[]>> = {
  ENTERTAINMENT: {
    correct: ['Standing ovation, darling!', 'You understood the assignment. And the sequel.', 'Someone get this brain an agent.'],
    incorrect: ['We’ll fix that in post.', 'A plot twist! Unfortunately, the wrong one.', 'The audition continues, darling.'],
    crown: ['A crown? Finally, wardrobe gets me.', 'Move over, awards season.'],
    steal: ['I borrowed the spotlight. Forever.', 'Best supporting crown? I’ll take it.'],
  },
  SCIENCE: {
    correct: ['Excellent! My calculator can retire.', 'Peer reviewed by yours truly.', 'Eureka! No explosions this time.'],
    incorrect: ['The hypothesis had… personality.', 'A useful discovery of what it isn’t!', 'Back to the lab. Bring snacks.'],
    crown: ['A crowning breakthrough!', 'This crown is scientifically fabulous.'],
    steal: ['Crown successfully relocated. For science.', 'Conservation of crowns in action!'],
  },
  SPORTS: {
    correct: ['That brain deserves a victory lap!', 'Nothing but net! And neurons.', 'Put that answer on the highlight reel!'],
    incorrect: ['That was a warm-up. Obviously.', 'Shake it off! Brains need practice too.', 'We’ll call that a strategic fumble.'],
    crown: ['Podium time! Flex those brain muscles!', 'Championship hardware acquired!'],
    steal: ['Intercepted! What a play!', 'That crown just changed teams!'],
  },
  ART: {
    correct: ['A masterpiece. I’ll allow it.', 'Your brain belongs in a gallery.', 'Magnifique! No notes.'],
    incorrect: ['A bold interpretation of “correct.”', 'Let’s call it an abstract answer.', 'Even masterpieces need a sketch first.'],
    crown: ['The finishing touch: a crown.', 'A new jewel for the collection.'],
    steal: ['Acquired for my private collection.', 'A most daring change of curator.'],
  },
  GEOGRAPHY: {
    correct: ['Right on the map!', 'You found it without asking for directions!', 'Adventure looks good on you.'],
    incorrect: ['Scenic route. Happens to the best of us.', 'A small detour. Pack extra snacks.', 'Recalculating! My compass does this too.'],
    crown: ['Summit reached! Crown secured!', 'Another treasure on the map!'],
    steal: ['New territory, excellent headwear!', 'This expedition took a royal turn.'],
  },
  HISTORY: {
    correct: ['The archives approve. Rare occasion.', 'A historic triumph. Modest trumpet, please.', 'I shall record this in very fancy ink.'],
    incorrect: ['I’ve seen empires recover from worse.', 'An answer ahead of its time. Or behind it.', 'The scrolls request a second draft.'],
    crown: ['A reign worth remembering.', 'Bring forth the ceremonial headwear!'],
    steal: ['A peaceful transfer of fabulous hats.', 'History has a new crown holder.'],
  },
};

/** One selector per mounted match: stable for a result, no immediate line repeats. */
export function createDialogueSelector() {
  const previous = new Map<string, number>();
  const selected = new Map<string, string>();
  return (resultId: string, category: Category, event: ReactionEvent) => {
    const poolKey = `${category}:${event}`;
    const key = `${resultId}:${poolKey}`;
    const cached = selected.get(key);
    if (cached) return cached;
    const lines = DIALOGUE[category][event];
    const index = ((previous.get(poolKey) ?? -1) + 1) % lines.length;
    previous.set(poolKey, index);
    selected.set(key, lines[index]);
    if (selected.size > 100) selected.delete(selected.keys().next().value!);
    return lines[index];
  };
}

export function crownReaction(result: QuestionResult): { category: Category; event: ReactionEvent } | null {
  if (result.stolenCrown) return { category: result.stolenCrown, event: 'steal' };
  if (result.awardedCrown) return { category: result.awardedCrown, event: 'crown' };
  return null;
}

export const CHARACTER_ENTRANCES = {
  ENTERTAINMENT: { x: [-45, 8, 0], rotate: [-18, 8, 0], scale: [0.7, 1.08, 1] },
  SCIENCE: { rotate: [-14, 14, -8, 0], y: [12, -4, 0] },
  SPORTS: { y: [32, -14, 5, 0], scale: [0.8, 1.08, 1] },
  ART: { rotate: [-24, 10, 0], x: [-20, 0] },
  GEOGRAPHY: { x: [-28, 5, 0], y: [18, -12, 0] },
  HISTORY: { y: [24, 0], scale: [0.9, 1] },
};
