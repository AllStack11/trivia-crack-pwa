import { Bell } from 'lucide-react';
import type { usePushNotifications } from '../../hooks/usePushNotifications';
import { useToast } from './Toast';

export default function NotificationSettings({ push, onInstallGuide }: {
  push: ReturnType<typeof usePushNotifications>; onInstallGuide: () => void;
}) {
  const { showToast } = useToast();
  const copy = {
    checking: 'Checking notifications…',
    unsupported: 'Notifications are unavailable in this browser. Try an installed app in a supported browser.',
    'install-required': 'On iPhone or iPad, add Trivia Clash to your Home Screen, then open it to enable alerts.',
    unavailable: 'Notifications are temporarily unavailable. You can still play and check your matches here.',
    denied: 'Notifications are blocked. Allow them in your browser or device settings, then return here.',
    disabled: 'Get invitations, your turn alerts, and match results on this device.',
    enabled: 'Notifications are enabled on this device. Delivery follows your device notification settings.'
  };
  return <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4" aria-label="Notifications">
    <h3 className="font-bold text-sm flex items-center gap-2"><Bell size={18} /> Notifications</h3>
    <p className="text-xs text-slate-400 mt-2 leading-relaxed" role="status">{copy[push.state]}</p>
    {push.error && <p className="text-xs text-red-600 mt-2" role="alert">{push.error}</p>}
    <div className="flex flex-wrap gap-2 mt-3">
      {push.state === 'disabled' && <button type="button" disabled={push.busy} onClick={() => void push.enable()} className="rounded-xl bg-indigo-600 text-white px-3 text-sm font-bold">Enable notifications</button>}
      {push.state === 'enabled' && <>
        <button type="button" disabled={push.busy} onClick={() => void push.test().then(sent => { if (sent) showToast('Test queued. Look for a device notification; repeat tests are limited to once per minute.', 'info'); })} className="rounded-xl bg-indigo-600 text-white px-3 text-sm font-bold">Send test</button>
        <button type="button" disabled={push.busy} onClick={() => void push.disable()} className="rounded-xl border border-slate-600 px-3 text-sm">Turn off</button>
      </>}
      {push.state === 'install-required' && <button type="button" onClick={onInstallGuide} className="rounded-xl border border-slate-600 px-3 text-sm">Installation guide</button>}
      {(push.state === 'unavailable' || push.state === 'denied') && <button type="button" disabled={push.busy} onClick={() => void push.retry()} className="rounded-xl border border-slate-600 px-3 text-sm">Check again</button>}
      {push.busy && <span className="text-xs self-center" role="status">Updating…</span>}
    </div>
  </section>;
}
