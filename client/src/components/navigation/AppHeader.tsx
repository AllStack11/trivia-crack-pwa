import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Crown, Download, LogOut, MoreHorizontal, Share2, Volume2, VolumeX } from 'lucide-react';
import type { AccountSummary } from '../../../../shared/src/index';
import { playButtonPop, triggerHaptic } from '../../utils/audio';

export interface AppHeaderProps {
  account: (AccountSummary & { token?: string }) | null;
  onLogout?: () => void;
  isOnline?: boolean;
  isInstallable?: boolean;
  onInstallApp?: () => void;
  onShareApp?: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
  currentView?: 'LOBBY' | 'GAME' | 'PACK_CREATOR';
  onBackToLobby?: () => void;
  title?: string;
}

export default function AppHeader({ account, onLogout, isOnline = true, isInstallable = false, onInstallApp, onShareApp, muted = false, onToggleMute, currentView = 'LOBBY', onBackToLobby, title }: AppHeaderProps) {
  const [open, setOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isLobby = currentView === 'LOBBY';
  const hasActions = Boolean(onShareApp || (isInstallable && onInstallApp) || (account && onLogout));
  useEffect(() => { setOpen(false); }, [currentView, account?.id]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!actionsRef.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const action = (callback: () => void) => { setOpen(false); playButtonPop(); triggerHaptic('light'); callback(); };

  return <header className="game-header">
    <div className="nav-header-inner">
      <div className="nav-identity">
        {!isLobby && onBackToLobby ? <button type="button" className="nav-icon" aria-label="Back to Lobby" onClick={() => action(onBackToLobby)}><ArrowLeft size={19} /></button>
          : <span className="nav-avatar" aria-label={account ? account.username + ', ' + (isOnline ? 'online' : 'offline') : 'Trivia Clash'}>{account ? account.username.slice(0, 1).toUpperCase() : <Crown size={16} />}<i className={isOnline ? 'online' : 'offline'} /></span>}
        {title ? <h1 className="nav-title">{title}</h1> : <span className="nav-brand">Trivia <strong>Clash</strong></span>}
      </div>
      <div className="nav-actions" ref={actionsRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
        {onToggleMute && <button type="button" className="nav-icon nav-audio" aria-label={muted ? 'Unmute sound' : 'Mute sound'} aria-pressed={muted} onClick={() => { triggerHaptic('selection'); onToggleMute(); }}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>}
        {hasActions && <button ref={triggerRef} type="button" className={'nav-icon' + (open ? ' is-open' : '')} aria-label="More actions" aria-expanded={open} aria-controls="header-actions" onClick={() => setOpen(value => !value)}><MoreHorizontal size={21} /></button>}
        {open && <div id="header-actions" className="nav-popover" aria-label="More actions">
          {account && <p className="nav-account-name">{account.username}</p>}
          {onShareApp && <button type="button" onClick={() => action(onShareApp)}><Share2 size={17} />Share duel link</button>}
          {isInstallable && onInstallApp && <button type="button" onClick={() => action(onInstallApp)}><Download size={17} />Install app</button>}
          {account && onLogout && <button type="button" onClick={() => action(onLogout)}><LogOut size={17} />Switch player / log out</button>}
        </div>}
      </div>
    </div>
  </header>;
}

