import CategoryCharacter from './CategoryCharacter';
import { Crown } from 'lucide-react';
export default function GameWelcome({compact=false}:{compact?:boolean}) {
 return <section className={`game-welcome ${compact ? 'compact' : ''}`} aria-label="Welcome to Trivia Clash">
  <div className="welcome-kicker"><Crown size={15} /> SIX CROWNS. ONE CHAMPION.</div>
  <h2>Big brains.<br /><span>Bigger fun.</span></h2>
  <p>Spin. Answer. Collect them all!</p>
  <div className="mascot-party">
   <CategoryCharacter category="ART" size="lg" mood="happy" className="party-side" />
   <CategoryCharacter category="SCIENCE" size="2xl" mood="happy" className="party-lead" />
   <CategoryCharacter category="ENTERTAINMENT" size="xl" mood="happy" className="party-right" />
  </div>
  <div className="category-confetti" aria-label="Six trivia categories"><span>Art</span><span>Science</span><span>Sports</span><span>Movies</span><span>World</span><span>History</span></div>
 </section>;
}
