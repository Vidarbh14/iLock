// ==============================================================================
// iLock Progressive Web App Service Worker
// Network-first for dynamic API routes, cache-first for static shell assets
// Enhanced with Push Notifications & Interactive Lock Actions
// ==============================================================================

const CACHE_NAME = 'ilock-shell-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Never cache API routes or agent communication
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// ==============================================================================
// Push Notification Handlers
// ==============================================================================
self.addEventListener('push', (event) => {
  let data = {
    title: 'iLock Security Alert',
    body: 'Security status update received from your workstation.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'ilock-alert',
    deviceId: null,
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    tag: data.tag || 'ilock-alert',
    vibrate: [200, 100, 200, 100, 400],
    requireInteraction: true,
    data: {
      url: data.url || '/dashboard',
      deviceId: data.deviceId,
    },
    actions: [
      {
        action: 'lock',
        title: '🔒 Lock Workstation',
      },
      {
        action: 'view',
        title: '👁️ Open Live View',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const notifData = event.notification.data || {};
  const deviceId = notifData.deviceId;
  const targetUrl = notifData.url || '/dashboard';

  if (action === 'lock' && deviceId) {
    event.waitUntil(
      fetch(`/api/devices/${deviceId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'WebPush Quick Action: Emergency Lock' }),
      }).then(() => {
        return clients.openWindow(targetUrl);
      }).catch(() => {
        return clients.openWindow(targetUrl);
      })
    );
    return;
  }

  // Default click or 'view' action
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
