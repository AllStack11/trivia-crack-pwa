import type { Category } from '../../../../shared/src/index';
import { CATEGORIES } from '../../../../shared/src/index';
import matchWorldUrl from '../../assets/match-world.webp';
interface AnimatedBackgroundProps { activeCategory?: Category | null; intensity?: 'subtle' | 'vibrant'; scene?: 'lobby' | 'match'; }
export default function AnimatedBackground({ activeCategory, scene = 'lobby' }: AnimatedBackgroundProps) {
 return <div className="game-world" aria-hidden="true">
   <div className="game-world-art" style={{ backgroundImage: `url('${scene === 'match' ? matchWorldUrl : '/art/world.webp'}')` }} />
   <div className="category-wash" style={{ background: activeCategory ? CATEGORIES[activeCategory].color : 'transparent' }} />
 </div>;
}
