import { useEffect, useState } from 'react';

export function useAppUpdate() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    const check = () => { if (!disposed && registration?.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting); };
    const track = () => { installing?.removeEventListener('statechange', check); installing = registration?.installing || null; installing?.addEventListener('statechange', check); check(); };
    void navigator.serviceWorker.ready.then(value => {
      if (disposed) return;
      registration = value;
      registration.addEventListener('updatefound', track);
      track();
      void registration.update().catch(() => {});
    });
    const resume = () => { if (document.visibilityState === 'visible') { check(); void registration?.update().catch(() => {}); } };
    document.addEventListener('visibilitychange', resume);
    return () => {
      disposed = true;
      registration?.removeEventListener('updatefound', track);
      installing?.removeEventListener('statechange', check);
      document.removeEventListener('visibilitychange', resume);
    };
  }, []);
  const update = () => {
    if (!waiting) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    waiting.postMessage({ type: 'SKIP_WAITING' });
  };
  return { available: Boolean(waiting), update };
}
