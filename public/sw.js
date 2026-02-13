// Service Worker for Arcellite PWA
const CACHE_NAME = 'arcellite-v1';
const RUNTIME_CACHE = 'arcellite-runtime-v1';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/index.tsx',
  '/assets/icons/app_registration_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg',
  '/assets/apps/google-drive.svg',
  '/assets/apps/microsoft-onedrive.svg',
  '/assets/apps/slack.svg',
  '/assets/apps/google-docs.svg',
  '/assets/apps/google-sheets.svg',
  '/assets/apps/google-slides.svg',
  '/assets/models/gemini-color.svg',
  '/assets/models/openai.svg',
  '/assets/models/anthropic.svg',
  '/assets/models/meta-color.svg',
  '/assets/models/grok.svg',
  '/assets/models/ollama.svg',
  '/assets/models/qwen-color.svg',
  '/assets/models/deepseek-color.svg'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
          })
          .map((cacheName) => {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the fetched response
            caches.open(RUNTIME_CACHE)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If network fails and no cache, return offline page
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Background sync for offline actions (optional)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Add your background sync logic here
      console.log('[Service Worker] Background sync triggered')
    );
  }
});

// Push notifications (optional)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'arcellite-notification',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification('Arcellite', options)
  );
});

