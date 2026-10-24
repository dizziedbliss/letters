// Service worker: only here for push notifications (no offline caching).
// A push wakes it even when the site is closed; tapping the notification opens the right page.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'something new :3', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/badge-96.png', // Android's status bar icon: white on transparent
      tag: data.tag,
      data: { url: data.url || '/home' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/home', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const tab = open.find((c) => new URL(c.url).origin === self.location.origin);
      if (tab) {
        await tab.focus();
        try {
          await tab.navigate(url);
          return;
        } catch {
          // a tab this worker doesn't control yet can't be steered; open a fresh one
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
