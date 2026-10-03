import { useCallback, useEffect, useRef, useState } from 'react';
import type { PushConfigResponse } from '../../../shared/src/index';
import type { AccountSession } from '../components/Lobby';
import { applicationServerKey, detachPush, PUSH_PREFERENCE_KEY, pushOwner, pushRequest, serializePush, setPushOwner } from '../utils/push';

export type PushState = 'checking' | 'unsupported' | 'install-required' | 'unavailable' | 'denied' | 'disabled' | 'enabled';

export function usePushNotifications(account: AccountSession | null) {
  const [state, setState] = useState<PushState>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const config = useRef<PushConfigResponse | null>(null);
  const current = useRef(account);
  current.current = account;

  const reconcile = useCallback(async () => {
    if (!account) return;
    const stillCurrent = () => current.current?.token === account.token;
    try {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
      if (ios && !standalone) { if (stillCurrent()) setState('install-required'); return; }
      if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        if (stillCurrent()) setState('unsupported'); return;
      }
      if (pushOwner() && pushOwner() !== account.id) await detachPush();
      const result: PushConfigResponse = await pushRequest(account.token, '/api/push/config');
      if (!stillCurrent()) return;
      config.current = result;
      if (!result.available) { setState('unavailable'); return; }
      if (Notification.permission === 'denied') { await detachPush(account.token); if (stillCurrent()) setState('denied'); return; }
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (!stillCurrent()) return;
      if (subscription?.options.applicationServerKey && result.publicKey) {
        const existing = new Uint8Array(subscription.options.applicationServerKey);
        const expected = applicationServerKey(result.publicKey);
        if (existing.length !== expected.length || existing.some((byte, index) => byte !== expected[index])) {
          await detachPush(account.token);
          if (stillCurrent()) { setState('disabled'); setError('Notification setup changed. Enable notifications again on this device.'); }
          return;
        }
      }
      if (Notification.permission === 'granted' && subscription && pushOwner() === account.id) {
        if (subscription.expirationTime && subscription.expirationTime <= Date.now()) {
          await detachPush(account.token); if (stillCurrent()) setState('disabled'); return;
        }
        // Rebind after session restoration. Ownership is always derived by the API.
        await pushRequest(account.token, '/api/push/subscription', { method: 'POST', body: JSON.stringify(subscription.toJSON()) });
        if (!stillCurrent()) return;
        await setPushOwner(account.id);
        setState('enabled');
      } else {
        if (subscription) await detachPush(account.token);
        if (stillCurrent()) setState('disabled');
      }
      if (stillCurrent()) setError(null);
    } catch (reason) {
      if (stillCurrent()) { setState('unavailable'); setError(reason instanceof Error ? reason.message : 'Could not check notifications'); }
    }
  }, [account]);

  useEffect(() => {
    setState('checking');
    void serializePush(reconcile);
    const resume = () => { if (document.visibilityState === 'visible') void serializePush(reconcile); };
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => { window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); };
  }, [reconcile]);

  const enable = async () => {
    if (!account || !config.current?.publicKey || busy) return;
    setBusy(true); setError(null);
    // Call directly from the button handler, before awaiting network/SW work.
    try {
      const permission = Notification.requestPermission();
      if (await permission !== 'granted') { setState(Notification.permission === 'denied' ? 'denied' : 'disabled'); return; }
      await serializePush(async () => {
        if (current.current?.token !== account.token) return;
        const registration = await new Promise<ServiceWorkerRegistration>((resolve, reject) => {
          const timer = window.setTimeout(() => reject(new Error('App setup is still loading. Please retry.')), 10000);
          void navigator.serviceWorker.ready.then(value => { window.clearTimeout(timer); resolve(value); }, reason => { window.clearTimeout(timer); reject(reason); });
        });
        if (current.current?.token !== account.token) return;
        let subscription = await registration.pushManager.getSubscription();
        if (subscription && pushOwner() !== account.id) { await subscription.unsubscribe(); subscription = null; }
        subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(config.current!.publicKey!) });
        await pushRequest(account.token, '/api/push/subscription', { method: 'POST', body: JSON.stringify(subscription.toJSON()) });
        if (current.current?.token !== account.token) return;
        await setPushOwner(account.id);
        localStorage.setItem(PUSH_PREFERENCE_KEY, account.id);
        setState('enabled');
      });
    } catch (reason) { if (current.current?.token === account.token) setError(reason instanceof Error ? reason.message : 'Could not enable notifications'); }
    finally { setBusy(false); }
  };

  const disable = async () => {
    if (!account || busy) return;
    setBusy(true); setError(null);
    try { await serializePush(() => detachPush(account.token)); setState('disabled'); }
    catch (reason) { if (!pushOwner()) setState('disabled'); setError(reason instanceof Error ? reason.message : 'Could not disable notifications'); }
    finally { setBusy(false); }
  };

  const test = async () => {
    if (!account || busy) return;
    setBusy(true); setError(null);
    try { await pushRequest(account.token, '/api/push/test', { method: 'POST' }); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not send test notification'); return false; }
    finally { setBusy(false); }
  };
  return { state, busy, error, enable, disable, test, retry: () => serializePush(reconcile) };
}
