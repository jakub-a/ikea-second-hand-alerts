const CACHE_NAME = 'ikea-alerts-v3';
const API_BASE = 'https://ikea-second-hand-alerts.ikea-second-hand-alerts.workers.dev';
const CORE_ASSETS = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (request.mode === 'navigate' || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        return response;
      });
    })
  );
});

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let payload = {};
      if (event.data) {
        try {
          payload = event.data.json();
        } catch (err) {
          payload = {};
        }
      } else if (self.registration?.pushManager) {
        try {
          const sub = await self.registration.pushManager.getSubscription();
          if (sub?.endpoint) {
            const res = await fetch(`${API_BASE}/api/next-notification?endpoint=${encodeURIComponent(sub.endpoint)}`);
            if (res.ok) {
              const data = await res.json();
              payload = data?.payload || {};
            }
          }
        } catch (err) {
          payload = {};
        }
      }

      const title = payload.title || 'IKEA Second-Hand Alert';
      const options = {
        body: payload.body || 'New listing matches your keywords.',
        data: payload.url || '/'
      };
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((client) => {
        client.postMessage({ type: 'push', payload });
      });
      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === target && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
