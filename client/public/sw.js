const CACHE_NAME = 'trivia-clash-v8';
const CACHE_PREFIX = 'trivia-clash-';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/icons/app-192-crown-v1.png', '/icons/app-512-crown-v1.png',
  '/icons/app-maskable-512-crown-v1.png', '/icons/apple-touch-icon-crown-v1.png', '/icons/favicon-32-crown-v1.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(STATIC_ASSETS);
    const html = await (await cache.match('/index.html')).text();
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(match => match[1]);
    await cache.addAll([...new Set(assets)]);
    // Updates wait for an explicit action, never interrupting a question.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = (await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX));
    const previous = keys.filter(key => key !== CACHE_NAME).slice(-1)[0];
    await Promise.all(keys.filter(key => key !== CACHE_NAME && key !== previous).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Authenticated APIs, SSE, other origins, and mutations always use the network.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok || response.status < 500) return response;
      } catch { /* Open the app shell at any cached deep link. */ }
      return await (await caches.open(CACHE_NAME)).match('/index.html') || new Response('Trivia Clash needs a connection for its first launch.', { status: 503 });
    })());
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await (await caches.open(CACHE_NAME)).put(request, response.clone());
      return response;
    })());
  } else if (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/art/')) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) await (await caches.open(CACHE_NAME)).put(request, response.clone());
        return response;
      } catch { return await caches.match(request) || new Response('', { status: 503 }); }
    })());
  }
});

function ownerStore(write, value) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('trivia-clash-push', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('settings');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('settings', write ? 'readwrite' : 'readonly');
      const store = tx.objectStore('settings');
      const request = write ? store.put(value, 'owner') : store.get('owner');
      let result = null;
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') { event.waitUntil(self.skipWaiting()); return; }
  if (event.data?.type === 'PUSH_OWNER') {
    event.waitUntil((async () => {
      const owner = typeof event.data.accountId === 'string' ? event.data.accountId : null;
      const previous = await ownerStore(false);
      await ownerStore(true, owner);
      if (previous !== owner) {
        for (const notification of await self.registration.getNotifications()) notification.close();
        await self.navigator.clearAppBadge?.().catch(() => {});
      }
      event.ports[0]?.postMessage({ ok: true });
    })());
  }
});

function safeUrl(value) {
  try {
    const url = new URL(typeof value === 'string' ? value : '/', self.location.origin);
    const valid = url.origin === self.location.origin && (
      url.pathname === '/' ||
      url.pathname === '/invites' ||
      url.pathname === '/invitations' ||
      /^\/game\/[A-Za-z0-9_%.-]+$/.test(url.pathname)
    );
    return valid ? url.href : self.location.origin + '/';
  } catch { return self.location.origin + '/'; }
}

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data?.json() || {}; } catch { /* Always display a visible fallback. */ }
    const owner = await ownerStore(false).catch(() => null);
    const belongs = owner && payload?.accountId === owner;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }).catch(() => []);
    if (belongs && windows.some(client => client.visibilityState === 'visible')) return;
    const count = belongs && Number.isSafeInteger(payload.badgeCount) ? Math.max(0, payload.badgeCount) : 0;
    await self.registration.showNotification(belongs && typeof payload.title === 'string' ? payload.title : 'Trivia Clash', {
      body: belongs && typeof payload.body === 'string' ? payload.body : 'Open the app to check your matches.',
      icon: '/icons/app-192-crown-v1.png',
      tag: belongs && typeof payload.tag === 'string' ? payload.tag : 'trivia-clash',
      data: { url: belongs ? safeUrl(payload.url) : self.location.origin + '/', accountId: belongs ? owner : null }
    });
    if (count > 0) await self.navigator.setAppBadge?.(count).catch(() => {});
    else await self.navigator.clearAppBadge?.().catch(() => {});
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const owner = await ownerStore(false).catch(() => null);
    const data = event.notification.data;
    const url = owner && data?.accountId === owner ? safeUrl(data.url) : self.location.origin + '/';
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      try { await existing.navigate(url); } catch { /* Ignore navigate rejection */ }
      try { existing.postMessage?.({ type: 'NAVIGATE', url }); } catch { /* Ignore postMessage error */ }
      await existing.focus();
    } else {
      await self.clients.openWindow(url);
    }
  })());
});
