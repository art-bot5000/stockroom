const CACHE_NAME = 'stockroom-v1';

// Files to cache for offline use
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
        console.warn('SW cache failed for some files:', e);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache, fall back to network ────────────
self.addEventListener('fetch', event => {
  // Only handle same-origin and CDN font requests
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // Network-first for API calls (Drive, Dropbox, Worker)
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('dropboxapi.com') ||
    url.hostname.includes('dropbox.com') ||
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('resend.com') ||
    url.hostname.includes('openfoodfacts.org') ||
    url.hostname.includes('openbeautyfacts.org')
  ) {
    return; // let browser handle API requests normally
  }

  // Cache-first for app shell
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        // Cache successful same-origin responses
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── Notification click: open the app ─────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes('stockroom') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
