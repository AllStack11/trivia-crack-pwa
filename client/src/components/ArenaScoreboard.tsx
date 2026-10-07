import { Crown, Zap } from 'lucide-react';
import type { GameStateSync } from '../../../shared/src/index';

export default function ArenaScoreboard({ state, playerId }: { state: GameStateSync; playerId: string }) {
  const active = state.players.p1.id === state.currentTurnPlayerId ? state.players.p1 : state.players.p2;
  return <div className="arena-scoreboard">
    <div className="arena-contenders">
      {[state.players.p1, state.players.p2].map((player, index) => player && <div key={player.id} className={`arena-player player-${index} ${player.id === state.currentTurnPlayerId ? 'player-active' : ''}`}>
        <div className="arena-avatar">{player.username.slice(0, 1).toUpperCase()}<span /></div>
        <div className="arena-player-name"><strong>{player.username}</strong><small>{player.id === playerId ? 'YOU' : 'OPPONENT'}</small></div>
        <span className="arena-player-score"><Crown size={15} />{player.crowns.length}<small>/6</small></span>
      </div>)}
      <span className="arena-versus">VS</span>
    </div>
    <div className="arena-gauge"><span><Zap size={13} /> Crown charge</span><div role="meter" aria-label={`${active?.username ?? 'Active player'} crown charge`} aria-valuemin={0} aria-valuemax={3} aria-valuenow={active?.crownGauge ?? 0}>{[1,2,3].map(step => <i key={step} className={(active?.crownGauge ?? 0) >= step ? 'charged' : ''} />)}</div><strong>{(active?.crownGauge ?? 0) >= 3 ? 'Crown ready!' : `${3 - (active?.crownGauge ?? 0)} correct to a crown`}</strong></div>
  </div>;
}
