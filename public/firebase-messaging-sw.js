/* ────────────────────────────── NightDreams PWA — SW v37.0.0 ───────────────────────────── */
/* Scope  : /        (todos los sub‑paths)                                                  */
/* Función: ① Offline fallback (solo página)  ② Push FCM + acciones + broadcast a clientes  */
/* ---------------------------------------------------------------------------------------- */

/* ---------- 1. Cache offline (online‑only salvo /offline.html) -------------------------- */
const CACHE = 'nd-v11.0.0';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', event => {
  console.log('[SW] Install event triggered for version:', CACHE);
  event.waitUntil(
    caches.open(CACHE)
      .then(c => {
        console.log('[SW] Caching offline page:', OFFLINE_URL);
        return c.addAll([OFFLINE_URL]);
      })
      .then(() => {
        console.log('[SW] Skip waiting called.');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activate event triggered for version:', CACHE);
  event.waitUntil(
    caches.keys().then(keys => {
      console.log('[SW] Existing caches:', keys);
      return Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      );
    }).then(() => {
      console.log('[SW] Claiming clients.');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  // Sólo interceptamos navegaciones (documentos HTML)
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});

/* ---------- 2. Mensaje interno: forzar actualización inmediata --------------------------- */
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

/* ---------- 3. Firebase Messaging ------------------------------------------------------- */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

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

/* Utilidad: broadcast a pestañas abiertas */
const broadcast = (type, payload = {}) =>
  self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(cs => cs.forEach(c => c.postMessage({ type, payload })));

/* ---------- 3.1 Push (data‑only) recibido ----------------------------------------------- */
messaging.onBackgroundMessage(payload => {
  const { data = {}, notification = {} } = payload;

  // 🔇 Elimina notificación duplicada generada por Firebase
  delete payload.notification;
  // ① Si hay una ventana visible → solo broadcast (sin notificación)
  self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(clientsArr => {
      const visible = clientsArr.some(c => c.visibilityState === 'visible');
      if (visible) {
        broadcast('PUSH_IN_APP', { data, notification });
        return;
      }

      // ② Mostrar notificación
      const title = notification.title || data.title || 'NightDreams';
      const options = {
        body  : notification.body  || data.body  || '',
        icon  : notification.icon  || data.icon  || '/icon-192.png',
        badge : '/icon-192.png',
        tag   : data.tag || 'nightdreams-push',
        data,                           // se re‑envía todo el objeto
        actions: JSON.parse(data.actions || '[]'),
        renotify: true                  // sustituye si tag coincide
      };
      self.registration.showNotification(title, options);
    });
});

/* ---------- 3.2 Acciones de la notificación --------------------------------------------- */
self.addEventListener('notificationclick', event => {
  const { notification } = event;
  const { link = '/' } = notification.data || {};
  notification.close();

  event.waitUntil((async () => {
    // No usamos GAS ni llamadas externas, sólo foco o abrir la ventana
    const url = new URL(link, self.location.origin).href;
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of allClients) {
      // Si la ventana ya está abierta en ese link, enfoca
      if (c.url === url && 'focus' in c) return c.focus();
    }
    // Si no, abre nueva ventana/tab
    return clients.openWindow(url);
  })());
});

console.info('[SW] NightDreams v37.0.0 activo (offline + FCM)');
