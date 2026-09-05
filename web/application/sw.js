const CACHE = 'smotri-app-__CACHE_VERSION__';
const PRECACHE = __PRECACHE__;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    await cache.addAll(PRECACHE);
    // Repair the previous worker even when failed navigation hides the update UI
    // and Telegram launch parameters. Activate only after the full shell is cached.
    await self.skipWaiting();
  }));
});
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Geocoding and other external responses must never be silently frozen in the cache.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const navigation = event.request.mode === 'navigate';
  if (navigation && url.pathname !== '/' && url.pathname !== '/index.html') return;
  const key = navigation ? '/index.html' : url.pathname;
  if (!PRECACHE.includes(key)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const response = await cache.match(key);
    if (!response) return fetch(event.request);
    // Sites redirects /index.html to /. A followed Response cannot satisfy a
    // navigation request with redirect=manual. Copy the body, clearing URL history.
    if (navigation && response.redirected)
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers });
    return response;
  }));
});
