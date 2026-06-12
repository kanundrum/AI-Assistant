// Bump this version on every deploy — it triggers cache refresh for installed users.
const CACHE = 'adhd-brain-os-v2';

// Relative paths resolve against this file's location, so they survive a repo rename.
const SHELL = [
  'home.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

// Install — cache the app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Activate — clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Only handle same-origin GETs. Everything else (AI APIs, CDNs, POSTs)
  // goes straight to the network untouched.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // HTML/navigations: network first, cache fallback.
  // Users always get the latest deploy when online; offline still works.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() =>
        caches.match(e.request).then(cached => cached || caches.match('home.html'))
      )
    );
    return;
  }

  // Static assets: cache first, network fallback. Only cache good responses.
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => Response.error());
    })
  );
});
