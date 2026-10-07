import { motion, useReducedMotion } from 'motion/react';
import { Swords, Users, Trophy, BookOpen } from 'lucide-react';
import { playButtonPop, triggerHaptic } from '../../utils/audio';

export type LobbyTab = 'matches' | 'players' | 'champions' | 'packs';
export interface BottomNavProps { activeTab: LobbyTab; onChangeTab: (tab: LobbyTab) => void; myTurnCount?: number; invitationCount?: number }

export default function BottomNav({ activeTab, onChangeTab, myTurnCount = 0, invitationCount = 0 }: BottomNavProps) {
  const reduced = useReducedMotion();
  const items = [
    { id: 'matches', label: 'Play', icon: Swords, count: myTurnCount },
    { id: 'players', label: 'Friends', icon: Users, count: invitationCount },
    { id: 'champions', label: 'Heroes', icon: Trophy, count: 0 },
    { id: 'packs', label: 'Packs', icon: BookOpen, count: 0 },
  ] as const;
  return <nav className="game-dock" aria-label="Bottom Navigation"><div className="nav-dock-inner">
    {items.map(({ id, label, icon: Icon, count }) => <button key={id} type="button" aria-label={count ? label + ', ' + count + (id === 'matches' ? ' turns ready' : ' invitations') : label} aria-current={activeTab === id ? 'page' : undefined} onClick={() => { if (activeTab !== id) { playButtonPop(); triggerHaptic('selection'); onChangeTab(id); } }}>
      {activeTab === id && <motion.span aria-hidden="true" className="nav-active-line" layoutId="bottomNavIndicator" transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }} />}
      <span className="nav-dock-icon"><Icon size={18} strokeWidth={activeTab === id ? 2.2 : 1.8} />{count > 0 && <span className="nav-count" aria-hidden="true">{count > 99 ? '99+' : count}</span>}</span>
      <span className="nav-dock-label">{label}</span>
    </button>)}
  </div></nav>;
}

