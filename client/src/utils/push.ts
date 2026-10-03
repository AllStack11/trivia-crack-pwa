import { apiUrl } from './api';

export const PUSH_PREFERENCE_KEY = 'trivia_clash_push';

export function pushOwner(): string | null {
  try { return localStorage.getItem(PUSH_PREFERENCE_KEY); } catch { return null; }
}

export async function pushRequest(token: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(apiUrl(path), { ...init, headers, signal: AbortSignal.timeout(10000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not update notifications');
  return data;
}

export function applicationServerKey(key: string): Uint8Array<ArrayBuffer> {
  const padded = key.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - key.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

export async function setPushOwner(accountId: string | null): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.active) return;
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => { channel.port1.close(); reject(new Error('Notification setup timed out')); }, 5000);
    channel.port1.onmessage = () => { window.clearTimeout(timer); channel.port1.close(); resolve(); };
    registration.active!.postMessage({ type: 'PUSH_OWNER', accountId }, [channel.port2]);
  });
}

// Serializes enable/reconcile/logout so a delayed registration cannot undo sign-out.
let pending: Promise<unknown> = Promise.resolve();
export function serializePush<T>(work: () => Promise<T>): Promise<T> {
  const next = pending.then(work, work);
  pending = next.catch(() => {});
  return next;
}

export async function detachPush(token?: string): Promise<void> {
  // Clearing ownership first makes any already-in-flight notification generic.
  try { localStorage.removeItem(PUSH_PREFERENCE_KEY); } catch { /* Storage unavailable. */ }
  await setPushOwner(null).catch(() => {});
  const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription && !await subscription.unsubscribe()) throw new Error('Could not disconnect notifications. Please retry.');
  if (token) await pushRequest(token, '/api/push/subscription', { method: 'DELETE' });
}
