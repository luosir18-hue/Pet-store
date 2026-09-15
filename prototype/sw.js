// Build replaces this marker with a hash of all release assets.
const VERSION = 'BUILD_VERSION';
const PREFIX = 'pet-store-phone-demo:' + self.registration.scope + ':';
const CACHE = PREFIX + VERSION;
const FILES = ['index.html','style.css','app.mjs','model.mjs','demo-storage.mjs','mobile.mjs',
  'manifest.webmanifest','icon.svg','icon-180.png','icon-192.png','icon-512.png','phone-guide.html'];
const urls = FILES.map(file => new URL(file, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(urls)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_DEMO_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const index = new URL('index.html', self.registration.scope).href;
  const isRoot = url.origin + url.pathname === self.registration.scope;
  const key = isRoot ? index : url.origin + url.pathname;
  // No caching of arbitrary routes, APIs, third-party resources or query strings.
  if (url.search || !urls.includes(key)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(key)) || fetch(event.request)));
});
