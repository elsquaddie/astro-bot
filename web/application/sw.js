const CACHE = 'smotri-app-__CACHE_VERSION__';
const PRECACHE = __PRECACHE__;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)));
});
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Geocoding and other external responses must never be silently frozen in the cache.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const key = event.request.mode === 'navigate' ? '/index.html' : url.pathname;
  if (!PRECACHE.includes(key)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(key)) || fetch(event.request)));
});
