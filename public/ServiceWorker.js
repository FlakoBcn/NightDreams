/* NightDreams – Service Worker v35.5.2 (online‑only, sin FCM) */
const CACHE = 'nd-v35.5.2-offline';
const OFFLINE = '/offline.html';

/* install */
self.addEventListener('install', e =>
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll([OFFLINE]))
      .then(() => self.skipWaiting())
  )
);

/* activate */
self.addEventListener('activate', e =>
  e.waitUntil(
    caches.keys().then(all =>
      Promise.all(all.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
);

/* fetch – sólo documentos */
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});

/* mensaje “SKIP_WAITING” */
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

console.info('[SW] NightDreams v35.5.2 listo (online‑only)');
