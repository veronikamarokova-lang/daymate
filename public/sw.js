// Service worker DayMate: только обработка кликов по уведомлениям.
// Он ничего не кэширует и не отправляет данные в сеть.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  const message = {
    type: 'reminder-action',
    action: event.action || 'open',
    reminder: event.notification.data,
  };
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.length > 0) {
        const client = windows[0];
        client.postMessage(message);
        if ('focus' in client) await client.focus();
        return;
      }
      // Приложение закрыто: действие нельзя применить без него, поэтому просто открываем DayMate.
      await self.clients.openWindow('/');
    })(),
  );
});
