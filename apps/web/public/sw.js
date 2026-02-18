const CACHE_NAME = 'ikea-alerts-v4';
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
        data: {
          url: payload.url || '/',
          alertId: payload.alertId || null,
          newCount: Number(payload.newCount) || 0,
          notificationId: payload.notificationId || null
        }
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
  const rawData = event.notification.data;
  const data = typeof rawData === 'string' ? { url: rawData } : (rawData || {});
  let target = data.url || '/';

  try {
    const url = new URL(target, self.location.origin);
    if (data.alertId && !url.searchParams.get('alertId')) {
      url.searchParams.set('alertId', data.alertId);
    }
    if (Number(data.newCount) > 0 && !url.searchParams.get('newCount')) {
      url.searchParams.set('newCount', String(Number(data.newCount)));
    }
    if (data.notificationId && !url.searchParams.get('notificationId')) {
      url.searchParams.set('notificationId', data.notificationId);
    }
    target = `${url.pathname}${url.search}${url.hash}`;
  } catch (err) {
    target = '/';
  }

  event.waitUntil(
    (async () => {
      const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      const sameOriginClient = clientList.find((client) => {
        try {
          return new URL(client.url).origin === self.location.origin;
        } catch (err) {
          return false;
        }
      });

      if (sameOriginClient) {
        if ('navigate' in sameOriginClient) {
          await sameOriginClient.navigate(target);
        }
        if ('focus' in sameOriginClient) {
          return sameOriginClient.focus();
        }
      }

      if (clients.openWindow) return clients.openWindow(target);
      return undefined;
    })()
  );
});
