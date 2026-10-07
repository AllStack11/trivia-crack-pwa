import { Crown, Sparkles, Zap, Check } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import type { GameStateSync, Category } from '../../../shared/src/index';
import { CATEGORIES } from '../../../shared/src/index';
import CategoryCharacter from './characters/CategoryCharacter';
const TITLE_POOLS = [
  [
    'CONFIDENCE SOLD SEPARATELY',
    'BIG SPIN ENERGY',
    'EGO CHECK INCOMING',
    'NO SEARCH BAR. NO MERCY.',
    'YOUR VILLAIN ARC STARTS HERE',
    'WILDLY UNQUALIFIED ROYALTY',
    'FACTS BEFORE FEELINGS',
    'CERTIFIED GUESSING CHAMPIONS',
    'HUMILITY IS THE CONSOLATION PRIZE',
    'ALL EGO. NO REFUNDS.',
    'THE WHEEL KNOWS YOUR WEAKNESS',
    'REPUTATIONS MAY BE DAMAGED',
    'OVERCONFIDENCE WELCOME',
    'BRAGGING RIGHTS UNDER REVIEW',
    'A ROYAL MESS IN THE MAKING',
    'YOUR GROUP CHAT IS WATCHING',
    'UNSUPERVISED BRAIN ACTIVITY',
    'MAIN CHARACTER SYNDROME',
  ],
  [
    'Spin. Talk trash.',
    'Feeling smug?',
    'Prove the hype.',
    'Brains or bluff?',
    'Choose chaos.',
    'Crown yourself.',
    'Risk the ego.',
    'Guess responsibly.',
    'Smug looks good.',
    'Bring the audacity.',
    'Facts or fiction?',
    'Royalty or regret?',
    'Flex that brain.',
    'Let the ego cook.',
    'Make it awkward.',
    'Outsmart the room.',
    'Talk is cheap.',
    'Who let you cook?',
  ],
  [
    'Your brain called. It wants a chance to embarrass you.',
    'The wheel loves a confident wrong answer.',
    'Being the loudest at pub trivia is not a qualification.',
    'The wheel is about to fact-check that confidence.',
    'A crown would look better on you. Allegedly.',
    'The kingdom has very questionable hiring standards.',
    'Your fun facts are about to face a hostile audience.',
    'Someone is leaving with a crown. Someone needs a nap.',
    'No pressure. Just your entire imaginary reputation.',
    'That podcast you half-listened to might finally pay off.',
    'Your opponent also thinks they are the smart one. Cute.',
    'The wheel accepts neither excuses nor lengthy appeals.',
    'A bold guess is still a guess. We respect the theatre.',
    'Your school report said potential. Time to collect.',
    'One correct answer away from being insufferable.',
    'Knowing every meme counts as education here.',
    'Your last brain cell has requested hazard pay.',
    'History remembers winners. Screenshots remember everyone.',
  ],
] as const;

// Independent base-18 choices from the random match ID allow every combination.
// Both players keep the same three lines through navigation, turns, and reloads.
function titlesForMatch(matchId: string) {
  let hash = 2166136261;
  for (const character of matchId) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  let selection = hash >>> 0;
  return TITLE_POOLS.map(pool => {
    const title = pool[selection % pool.length];
    selection = Math.floor(selection / pool.length);
    return title;
  });
}

export default function SpinArena({ state, playerId, spinning, children }: { state: GameStateSync; playerId: string; spinning: boolean; children: ReactNode }) {
  const mine = state.players.p1.id === playerId ? state.players.p1 : state.players.p2;
  const active = state.currentTurnPlayerId === state.players.p1.id ? state.players.p1 : state.players.p2;
  const myTurn = state.currentTurnPlayerId === playerId;
  const copy = titlesForMatch(state.id);
  return <section className="spin-arena">
    <div className="arena-heading">
      <span className="sr-only" role="status">{spinning ? 'Wheel spinning.' : myTurn ? 'Your turn to spin.' : `${active?.username ?? 'Your opponent'} is choosing a category.`}</span>
      <span className="arena-eyebrow"><Sparkles size={14} /> {copy[0]}</span>
      <h1>{copy[1]}</h1>
      <p>{copy[2]}</p>
    </div>
    <div className="arena-wheel-stage">
      <div className="arena-orbit orbit-one" aria-hidden="true" /><div className="arena-orbit orbit-two" aria-hidden="true" />
      <span className="arena-star star-one" aria-hidden="true">✦</span><span className="arena-star star-two" aria-hidden="true">✧</span>
      {children}
    </div>
    <div className="arena-collection">
      <div className="collection-heading"><span><Crown size={16} /> YOUR CROWNS</span><strong>{mine?.crowns.length ?? 0}<small> / 6</small></strong></div>
      <div className="collection-characters">{(Object.keys(CATEGORIES) as Category[]).map(category => {
        const earned = mine?.crowns.includes(category);
        return <div key={category} className={`collection-character ${earned ? 'is-earned' : ''}`} style={{ '--category-color': CATEGORIES[category].color } as CSSProperties} title={CATEGORIES[category].name}>
          <CategoryCharacter category={category} size="md" mood={earned ? 'happy' : 'idle'} />
          <span>{({ ART: 'Art', SCIENCE: 'Science', SPORTS: 'Sports', ENTERTAINMENT: 'Pop culture', GEOGRAPHY: 'World', HISTORY: 'History' })[category]}</span>
          <div className="collection-slot">{earned ? <Check size={12} aria-label="Collected" /> : <Crown size={12} aria-label="Not collected" />}</div>
        </div>;
      })}</div>
      <p><Zap size={13} /> Collect all six crowns to win the clash.</p>
    </div>
  </section>;
}
