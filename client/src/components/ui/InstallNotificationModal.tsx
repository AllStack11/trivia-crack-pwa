import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import BottomSheet from './BottomSheet';
import type { usePushNotifications } from '../../hooks/usePushNotifications';

const DISMISSED_KEY = 'trivia-install-notifications-dismissed';

export default function InstallNotificationModal({ installed, signedIn, push }: {
  installed: boolean;
  signedIn: boolean;
  push: ReturnType<typeof usePushNotifications>;
}) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISSED_KEY) === '1'; }
    catch { return false; }
  });
  const [opened, setOpened] = useState(false);
  const dismiss = () => {
    if (push.busy) return;
    setDismissed(true);
    setOpened(false);
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* storage unavailable */ }
  };

  useEffect(() => {
    if (installed && signedIn && !dismissed && push.state === 'disabled') setOpened(true);
    if (!signedIn || push.state === 'enabled') setOpened(false);
  }, [installed, signedIn, dismissed, push.state]);

  return <BottomSheet isOpen={opened} onClose={dismiss} title="Enable notifications"
    subtitle="Stay ready for your next turn" icon={<Bell className="w-5 h-5" />} showCloseButton={!push.busy}>
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-300 leading-relaxed">
        Get alerts for invitations, your turn, and match results. Tap Enable notifications to choose Allow in your device's permission prompt.
      </p>
      {push.state === 'denied' && <p className="text-sm text-amber-300" role="status">
        Notifications are blocked. You can allow them in your browser or device settings.
      </p>}
      {push.error && <p className="text-sm text-red-300" role="alert">{push.error}</p>}
      {push.state === 'disabled' && <button type="button" disabled={push.busy}
        onClick={() => void push.enable()}
        className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-4 py-3 font-bold text-white disabled:opacity-50">
        {push.busy ? 'Enabling notifications...' : 'Enable notifications'}
      </button>}
      <button type="button" disabled={push.busy} onClick={dismiss}
        className="w-full rounded-2xl border border-slate-600 px-4 py-3 text-sm text-slate-300 disabled:opacity-50">
        Not now
      </button>
    </div>
  </BottomSheet>;
}
