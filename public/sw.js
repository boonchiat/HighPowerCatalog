const CACHE_NAME = 'flipbook-pwa-v1';
const RUNTIME_CACHE = 'flipbook-runtime-v1';
const ASSET_CACHE = 'flipbook-assets-v1';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
];

// Install event: cache essential assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE && cacheName !== ASSET_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: implement caching strategies
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-HTTP requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Strategy for manifest.json files: network first, fallback to cache
  if (url.pathname.includes('/manifest.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (!response.ok) {
            return response;
          }
          // Clone response: one for cache, one to return
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cached => {
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
      caches.match(event.request).then(cached => {
        if (cached) {
          return cached;
        }
        return fetch(event.request)
          .then(response => {
            if (!response.ok || event.request.method !== 'GET') {
              return response;
            }
            // Clone response: one for cache, one to return
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(event.request, responseToCache);
            });
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
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        if (!response.ok || event.request.method !== 'GET') {
          return response;
        }
        // Clone response: one for cache, one to return
        const responseToCache = response.clone();
        caches.open(ASSET_CACHE).then(cache => {
          cache.put(event.request, responseToCache);
        });
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

  if (event.data && event.data.type === 'CACHE_BOOK') {
    const { bookId, pages } = event.data;
    cacheBook(bookId, pages, event.ports[0]);
  }
});

// Cache a book for offline use
async function cacheBook(bookId, pages, port) {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const baseUrl = self.location.origin + self.location.pathname.replace(/\/$/, '');

    // Cache manifest
    const manifestUrl = `${baseUrl}/books/${bookId}/manifest.json`;
    try {
      const manifestResponse = await fetch(manifestUrl);
      if (manifestResponse.ok) {
        await cache.put(manifestUrl, manifestResponse.clone());
      }
    } catch (err) {
      console.error('Failed to cache manifest:', err);
    }

    // Cache all pages and thumbnails
    let cached = 0;
    for (const page of pages) {
      try {
        const pageUrl = `${baseUrl}/${page.image}`;
        const thumbUrl = `${baseUrl}/${page.thumbnail}`;

        const [pageResponse, thumbResponse] = await Promise.all([
          fetch(pageUrl),
          fetch(thumbUrl),
        ]);

        if (pageResponse.ok) {
          await cache.put(pageUrl, pageResponse.clone());
        }
        if (thumbResponse.ok) {
          await cache.put(thumbUrl, thumbResponse.clone());
        }

        cached++;
        port.postMessage({ type: 'CACHE_PROGRESS', cached, total: pages.length * 2 });
      } catch (err) {
        console.error(`Failed to cache page ${page.pageNumber}:`, err);
      }
    }

    port.postMessage({ type: 'CACHE_COMPLETE', success: true });
  } catch (error) {
    console.error('Error caching book:', error);
    port.postMessage({ type: 'CACHE_COMPLETE', success: false, error: error.message });
  }
}
