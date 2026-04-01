// ── INCREMENT THIS VERSION NUMBER EVERY TIME YOU DEPLOY ──────
// The browser detects a change in this file and triggers the update flow
const CACHE_VERSION = 'stockroom-v2';
const CACHE_NAME    = CACHE_VERSION;

const CACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
];

// ── Install: cache core files ─────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CACHE_URLS).catch(e => {
        console.warn('SW: cache failed for some files:', e);
      });
    })
  );
  // Don't auto-activate — wait for the app to send SKIP_WAITING
  // so the user can choose when to refresh
});

// ── Activate: clean up old caches ────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('SW: removing old cache', k);
        return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

// ── Message: handle SKIP_WAITING from the app ────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Fetch: cache-first for app shell, network-first for APIs ─
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Let API calls go straight to the network
  if (
    url.hostname.includes('googleapis.com')    ||
    url.hostname.includes('dropboxapi.com')    ||
    url.hostname.includes('dropbox.com')       ||
    url.hostname.includes('workers.dev')       ||
    url.hostname.includes('resend.com')        ||
    url.hostname.includes('openfoodfacts.org') ||
    url.hostname.includes('openbeautyfacts.org')
  ) {
    return;
  }

  // Cache-first for app shell
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── Notification click: focus or open app ────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('stockroom') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
