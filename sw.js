const CACHE_VERSION = 'v1';
const RUNTIME_CACHE = `flipbook-runtime-${CACHE_VERSION}`;
const ASSET_CACHE = `flipbook-assets-${CACHE_VERSION}`;
const CACHE_PREFIX = 'flipbook-cache-';

const ASSETS_TO_CACHE = [
  '/HighPowerCatalog/',
  '/HighPowerCatalog/index.html',
];

// Install event: cache essential assets
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(ASSET_CACHE).then(cache => {
      console.log('[SW] Caching essential assets');
      return cache.addAll(ASSETS_TO_CACHE).catch(error => {
        console.warn('[SW] Some assets failed to cache:', error);
      });
    })
  );
  
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (
            cacheName !== RUNTIME_CACHE &&
            cacheName !== ASSET_CACHE &&
            !cacheName.startsWith(CACHE_PREFIX)
          ) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  self.clients.claim();
});

// Fetch event: implement caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Strategy for manifest.json files: network first, fallback to cache
  if (url.pathname.includes('/manifest.json')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const cache = caches.open(RUNTIME_CACHE);
            cache.then(c => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then(cached => {
            return cached || new Response('Offline - manifest not available', {
              status: 503,
              statusText: 'Service Unavailable',
            });
          });
        })
    );
    return;
  }

  // Strategy for book pages and thumbnails: cache first, fallback to network
  if (url.pathname.includes('/books/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          return cached;
        }
        return fetch(request)
          .then(response => {
            if (response.ok && request.method === 'GET') {
              const cache = caches.open(RUNTIME_CACHE);
              cache.then(c => c.put(request, response.clone()));
            }
            return response;
          })
          .catch(() => {
            return new Response('Offline - resource not available', {
              status: 503,
              statusText: 'Service Unavailable',
            });
          });
      })
    );
    return;
  }

  // Strategy for other assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(response => {
        if (response.ok && request.method === 'GET') {
          const cache = caches.open(ASSET_CACHE);
          cache.then(c => c.put(request, response.clone()));
        }
        return response;
      });

      return cached || fetchPromise;
    })
  );
});

// Handle messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_CACHE_STATUS') {
    caches.keys().then(cacheNames => {
      const offlineCaches = cacheNames.filter(name => name.startsWith(CACHE_PREFIX));
      event.ports[0].postMessage({
        type: 'CACHE_STATUS',
        offlineCaches,
      });
    });
  }
});
