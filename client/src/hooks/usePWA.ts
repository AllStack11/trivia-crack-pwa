import { useState, useEffect, useCallback, useRef } from 'react';

export type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'error';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface WakeLockSentinelLike extends EventTarget {
  readonly released: boolean;
  release(): Promise<void>;
}

interface NavigatorWithExtras {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>;
  };
  setAppBadge?(count?: number): Promise<void>;
  clearAppBadge?(): Promise<void>;
  standalone?: boolean;
}

interface WindowWithExtras {
  MSStream?: unknown;
}

/**
 * Triggers native haptic vibration if supported.
 */
export function triggerHaptic(type: HapticType = 'light'): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    switch (type) {
      case 'selection':
        navigator.vibrate(6);
        break;
      case 'light':
        navigator.vibrate(12);
        break;
      case 'medium':
        navigator.vibrate(25);
        break;
      case 'heavy':
        navigator.vibrate(45);
        break;
      case 'success':
        navigator.vibrate([15, 50, 20]);
        break;
      case 'error':
        navigator.vibrate([35, 60, 35]);
        break;
    }
  } catch {
    // Vibration blocked or unsupported
  }
}

let wakeLockSentinel: WakeLockSentinelLike | null = null;

export async function requestWakeLock(): Promise<void> {
  if (typeof navigator === 'undefined') return;
  const nav = navigator as unknown as NavigatorWithExtras;
  if (!nav.wakeLock?.request) return;
  try {
    if (!wakeLockSentinel || wakeLockSentinel.released) {
      wakeLockSentinel = await nav.wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
      });
    }
  } catch {
    // Screen Wake Lock blocked or unsupported
  }
}

export async function releaseWakeLock(): Promise<void> {
  try {
    if (wakeLockSentinel && !wakeLockSentinel.released) {
      await wakeLockSentinel.release();
    }
    wakeLockSentinel = null;
  } catch {
    wakeLockSentinel = null;
  }
}

export async function setAppBadge(count: number): Promise<void> {
  if (typeof navigator === 'undefined') return;
  const nav = navigator as unknown as NavigatorWithExtras;
  try {
    if (count > 0 && typeof nav.setAppBadge === 'function') {
      await nav.setAppBadge(count);
    } else if (count <= 0 && typeof nav.clearAppBadge === 'function') {
      await nav.clearAppBadge();
    }
  } catch {
    // Badge API blocked or unsupported
  }
}

export async function shareApp(opts: { title: string; text: string; url?: string }): Promise<boolean> {
  const url = opts.url || (typeof window !== 'undefined' ? window.location.href : '');
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({
        title: opts.title,
        text: opts.text,
        url,
      });
      return true;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return false;
    }
  }

  // Fallback to clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(`${opts.title} - ${opts.text} ${url}`.trim());
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function usePWA() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    const nav = navigator as unknown as NavigatorWithExtras;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      nav.standalone === true ||
      document.referrer.includes('android-app://')
    );
  });
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  const isIOS = typeof window !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as WindowWithExtras).MSStream
  );

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      deferredPromptRef.current = null;
      setIsInstallable(false);
      setIsInstalled(true);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Re-check display-mode in case it changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsInstalled(true);
    };
    mediaQuery.addEventListener?.('change', handleMediaChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      mediaQuery.removeEventListener?.('change', handleMediaChange);
    };
  }, []);

  const installApp = useCallback(async (): Promise<boolean> => {
    if (!deferredPromptRef.current) return false;
    try {
      await deferredPromptRef.current.prompt();
      const choiceResult = await deferredPromptRef.current.userChoice;
      deferredPromptRef.current = null;
      setIsInstallable(false);
      return choiceResult.outcome === 'accepted';
    } catch {
      return false;
    }
  }, []);

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isOnline,
    installApp,
    requestWakeLock,
    releaseWakeLock,
    setAppBadge,
    triggerHaptic,
    shareApp,
  };
}
