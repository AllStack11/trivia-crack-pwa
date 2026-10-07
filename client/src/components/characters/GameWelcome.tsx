import CategoryCharacter from './CategoryCharacter';
import { Crown } from 'lucide-react';
import { CATEGORIES, type Category } from '../../../../shared/src/index';

const categoryOrder: Category[] = ['ART', 'SCIENCE', 'SPORTS', 'ENTERTAINMENT', 'GEOGRAPHY', 'HISTORY', 'MEMES', 'CUSTOM', 'MOVIES_TV', 'VIDEO_GAMES'];
export default function GameWelcome({compact=false}:{compact?:boolean}) {
 return <section className={`game-welcome ${compact ? 'compact' : ''}`} aria-label="Welcome to Trivia Clash">
  <div className="welcome-kicker"><Crown size={15} /> SIX CROWNS. ONE CHAMPION.</div>
  <h2>Big brains.<br /><span>Bigger fun.</span></h2>
  <p>Spin. Answer. Collect all six crowns!</p>
  <div className="mascot-party">
   <CategoryCharacter category="ART" size="lg" mood="happy" className="party-side" />
   <CategoryCharacter category="SCIENCE" size="2xl" mood="happy" className="party-lead" />
   <CategoryCharacter category="ENTERTAINMENT" size="xl" mood="happy" className="party-right" />
  </div>
  <div className="category-confetti" role="img" aria-label={`Trivia categories: ${categoryOrder.map(category => CATEGORIES[category].name).join(', ')}`}>
   <div className="category-confetti-track" aria-hidden="true">
    {[0, 1].map(copy => <div className="category-confetti-group" key={copy}>
     {categoryOrder.map(category => <span key={category} style={{ backgroundColor: CATEGORIES[category].accentColor }}>{CATEGORIES[category].name}</span>)}
    </div>)}
   </div>
  </div>
 </section>;
}
