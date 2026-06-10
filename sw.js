const CACHE = 'adhd-brain-os-v1';
const SHELL = [
  '/AI-Assistant/home.html',
  '/AI-Assistant/manifest.json',
  '/AI-Assistant/icons/icon-192.png',
  '/AI-Assistant/icons/icon-512.png'
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

// Fetch — network first for API calls, cache first for app shell
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go network for AI API calls — they need live internet
  if (
    url.hostname.includes('groq.com') ||
    url.hostname.includes('openai.com') ||
    url.hostname.includes('anthropic.com') ||
    url.hostname.includes('openrouter.ai')
  ) {
    return; // let browser handle it normally
  }

  // App shell: cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Cache any same-origin GET responses
        if (e.request.method === 'GET' && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback — serve home.html for navigation requests
        if (e.request.mode === 'navigate') {
          return caches.match('/AI-Assistant/home.html');
        }
      });
    })
  );
});
