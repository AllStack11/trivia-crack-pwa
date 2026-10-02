import type { Category } from '../../../../shared/src/index';
import { CATEGORIES } from '../../../../shared/src/index';
interface AnimatedBackgroundProps { activeCategory?: Category | null; intensity?: 'subtle' | 'vibrant'; }
export default function AnimatedBackground({ activeCategory }: AnimatedBackgroundProps) {
 return <div className="game-world" aria-hidden="true">
   <div className="game-world-art" />
   <div className="category-wash" style={{ background: activeCategory ? CATEGORIES[activeCategory].color : 'transparent' }} />
 </div>;
}
