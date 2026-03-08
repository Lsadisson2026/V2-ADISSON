// public/sw.js — Service Worker para Push Notifications PWA
// Coloque este arquivo em /public/sw.js no seu projeto

const CACHE_NAME = 'cobrafacil-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Recebe push notification do servidor
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'CobraFácil';
  const options = {
    body:    data.body  || '',
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    vibrate: [200, 100, 200],
    data:    data.data  || {},
    actions: data.actions || [],
    tag:     data.tag   || 'cobrafacil-notification',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Clique na notificação — abre o app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
