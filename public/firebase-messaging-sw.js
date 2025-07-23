/* NightDreams – Firebase Messaging Service Worker (sólo push) */
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging-compat.js');

/* misma configuración que en app.js */
firebase.initializeApp({
  apiKey           : 'AIzaSyAojJehdlYbQjfpjaDPCh-59y0rZG-fM34',
  authDomain       : 'nightdreams-f90b0.firebaseapp.com',
  projectId        : 'nightdreams-f90b0',
  storageBucket    : 'nightdreams-f90b0.appspot.com',
  messagingSenderId: '1011859565794',
  appId            : '1:1011859565794:web:f9a5faa6ea2a10f47202bb',
  measurementId    : 'G-NHMYKW05DT'
});

const messaging = firebase.messaging();

/* ── Mensaje en segundo plano ─────────────────────────────────────────── */
messaging.onBackgroundMessage(({ notification = {}, data }) => {
  const title = notification.title || 'NightDreams';
  const options = {
    body : notification.body || 'Tienes una nueva notificación',
    icon : notification.icon || '/icon-192.png',
    badge: '/icon-192.png',
    data ,
    tag  : 'nightdreams-push'
  };
  self.registration.showNotification(title, options);
});

/* ── Click sobre la notificación ──────────────────────────────────────── */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        for (const client of list) {
          if (client.url.includes('nightdreams') && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow('/');
      })
  );
});

console.info('[firebase‑messaging-sw] activo');
