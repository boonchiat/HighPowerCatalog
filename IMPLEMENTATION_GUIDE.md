# Implementation Guide - HighPower Flipbook PWA

This guide provides detailed explanations of the project architecture and key implementation decisions.

## Architecture Overview

The flipbook PWA is built with a modular TypeScript architecture that separates concerns into distinct layers:

1. **Entry Point** (`src/main.ts`): Initializes the app, registers service worker, and loads books
2. **Viewer** (`src/flipbook/viewer.ts`): Manages UI rendering and user interactions
3. **Cache Manager** (`src/flipbook/cache.ts`): Handles offline caching via Cache API
4. **Gesture Handler** (`src/flipbook/gestures.ts`): Processes touch events and swipe gestures
5. **Service Worker** (`public/sw.js`): Manages network requests and offline fallbacks

## Detailed Component Breakdown

### 1. Entry Point: `src/main.ts`

```typescript
import { FlipbookViewer } from './flipbook/viewer';

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(error => {
        console.warn('Service Worker registration failed:', error);
      });
  });
}

// Initialize flipbook viewer
const viewer = new FlipbookViewer('app', import.meta.env.BASE_URL);

// Get book ID from query parameter or use default
const params = new URLSearchParams(window.location.search);
const bookId = params.get('book') || 'catalog_11-12-25';

viewer.loadBook(bookId);
```

**Key Points:**

- **Service Worker Registration**: Registered on the `load` event to ensure the DOM is ready. The path uses `import.meta.env.BASE_URL` to work correctly in the GitHub Pages subdirectory.
- **Query Parameter Parsing**: Uses `URLSearchParams` to extract the `book` parameter from the URL. If not provided, defaults to `catalog_11-12-25`.
- **Base URL Injection**: The `FlipbookViewer` receives `import.meta.env.BASE_URL` which Vite automatically sets to `/HighPowerCatalog/` in production builds.

### 2. Viewer Component: `src/flipbook/viewer.ts`

The viewer is a class-based component that manages the entire UI and user interactions.

#### Constructor and Setup

```typescript
constructor(containerId: string, baseUrl: string = import.meta.env.BASE_URL) {
  const element = document.getElementById(containerId);
  if (!element) {
    throw new Error(`Container with id "${containerId}" not found`);
  }
  this.container = element;
  this.baseUrl = baseUrl;
  this.cacheManager = new CacheManager();
  this.setupContainer();
}
```

The constructor validates that the container exists, stores the base URL for asset loading, and initializes the cache manager.

#### UI Structure

The viewer creates a complete UI with:

- **Header**: Title, menu button, and download button
- **Content Area**: Full-page image display with page controls
- **Sidebar**: Thumbnail grid for quick navigation
- **Status Display**: Shows caching progress and offline status

#### Book Loading

```typescript
async loadBook(bookId: string): Promise<void> {
  if (this.isLoading) return;
  this.isLoading = true;

  try {
    const manifestUrl = `${this.baseUrl}books/${bookId}/manifest.json`;
    const response = await fetch(manifestUrl);

    if (!response.ok) {
      throw new Error(`Failed to load manifest: ${response.statusText}`);
    }

    this.manifest = await response.json();
    this.currentPageIndex = 0;
    this.renderPage();
    this.renderThumbnails();
    this.updateDownloadButton();
  } catch (error) {
    console.error('Error loading book:', error);
    this.showError(`Failed to load book: ${bookId}`);
  } finally {
    this.isLoading = false;
  }
}
```

The method:

1. Prevents concurrent loading with an `isLoading` flag
2. Constructs the manifest URL using the base URL and book ID
3. Fetches and parses the JSON manifest
4. Initializes the viewer state and renders the first page
5. Handles errors gracefully with user-friendly messages

#### Page Rendering

```typescript
private renderPage(): void {
  if (!this.manifest) return;

  const page = this.manifest.pages[this.currentPageIndex];
  if (!page) return;

  const pageImage = document.getElementById('pageImage') as HTMLImageElement;
  const pageCounter = document.getElementById('pageCounter');
  const bookTitle = document.getElementById('bookTitle');

  pageImage.src = `${this.baseUrl}books/${this.manifest.id}/${page.image}`;
  pageImage.alt = `Page ${page.pageNumber}`;

  if (pageCounter) {
    pageCounter.textContent = `Page ${page.pageNumber} of ${this.manifest.totalPages}`;
  }

  if (bookTitle) {
    bookTitle.textContent = this.manifest.title;
  }

  this.updatePageControls();
}
```

This method updates the displayed page image and metadata. All asset paths are constructed using the base URL to ensure correct paths in the GitHub Pages subdirectory.

#### Navigation

```typescript
private nextPage(): void {
  if (!this.manifest) return;

  if (this.currentPageIndex < this.manifest.pages.length - 1) {
    this.currentPageIndex++;
    this.renderPage();
    this.renderThumbnails();
  }
}

private previousPage(): void {
  if (this.currentPageIndex > 0) {
    this.currentPageIndex--;
    this.renderPage();
    this.renderThumbnails();
  }
}
```

Navigation methods check bounds before updating the current page index and re-render the view.

### 3. Cache Manager: `src/flipbook/cache.ts`

The cache manager handles offline functionality using the Cache API.

#### Offline Status Checking

```typescript
private async checkOfflineStatus(): Promise<void> {
  if (!('caches' in window)) return;

  try {
    const cacheNames = await caches.keys();
    const hasOfflineCache = cacheNames.some(name => name.startsWith(CACHE_PREFIX));
    if (hasOfflineCache) {
      this.updateState({ isOfflineReady: true });
    }
  } catch (error) {
    console.error('Error checking cache status:', error);
  }
}
```

On initialization, the cache manager checks if any offline caches exist and updates the UI accordingly.

#### Downloading Books for Offline

```typescript
async downloadBookForOffline(manifest: BookManifest): Promise<void> {
  if (!('caches' in window)) {
    console.warn('Cache API not available');
    return;
  }

  this.updateState({ isCaching: true, cacheProgress: 0 });

  try {
    const cacheName = `${CACHE_PREFIX}${manifest.id}`;
    const cache = await caches.open(cacheName);

    // Cache manifest
    const manifestUrl = `${import.meta.env.BASE_URL}books/${manifest.id}/manifest.json`;
    await cache.add(manifestUrl);

    // Calculate total items to cache
    const totalItems = manifest.pages.length * 2; // pages + thumbnails
    let cachedItems = 0;

    // Cache all pages and thumbnails
    for (const page of manifest.pages) {
      const pageUrl = `${import.meta.env.BASE_URL}books/${manifest.id}/${page.image}`;
      const thumbUrl = `${import.meta.env.BASE_URL}books/${manifest.id}/${page.thumbnail}`;

      try {
        await cache.add(pageUrl);
        cachedItems++;
        this.updateState({ cacheProgress: Math.round((cachedItems / totalItems) * 100) });
      } catch (error) {
        console.warn(`Failed to cache page: ${pageUrl}`, error);
      }

      try {
        await cache.add(thumbUrl);
        cachedItems++;
        this.updateState({ cacheProgress: Math.round((cachedItems / totalItems) * 100) });
      } catch (error) {
        console.warn(`Failed to cache thumbnail: ${thumbUrl}`, error);
      }
    }

    this.updateState({ isOfflineReady: true, isCaching: false, cacheProgress: 100 });
  } catch (error) {
    console.error('Error downloading book for offline:', error);
    this.updateState({ isCaching: false });
  }
}
```

This method:

1. Creates a unique cache store for each book (e.g., `flipbook-cache-catalog_11-12-25`)
2. Caches the manifest JSON file
3. Iterates through all pages and thumbnails, caching each one
4. Updates progress state after each successful cache operation
5. Handles individual failures gracefully (one failed image doesn't stop the entire process)
6. Marks the book as offline-ready when complete

#### State Management

```typescript
onStateChange(callback: (state: CacheState) => void): () => void {
  this.stateChangeCallbacks.push(callback);
  return () => {
    this.stateChangeCallbacks = this.stateChangeCallbacks.filter(cb => cb !== callback);
  };
}

private updateState(partial: Partial<CacheState>): void {
  this.cacheState = { ...this.cacheState, ...partial };
  this.stateChangeCallbacks.forEach(cb => cb(this.cacheState));
}
```

The cache manager uses a simple observer pattern to notify the viewer of state changes. The `onStateChange` method returns an unsubscribe function for cleanup.

### 4. Gesture Handler: `src/flipbook/gestures.ts`

The gesture handler processes touch events and detects user intents.

#### Touch Event Processing

```typescript
private handleTouchStart(event: TouchEvent): void {
  const touch = event.touches[0];
  this.startX = touch.clientX;
  this.startY = touch.clientY;
  this.startTime = Date.now();
}

private handleTouchMove(event: TouchEvent): void {
  // Prevent default scrolling during swipe
  if (Math.abs(event.touches[0].clientX - this.startX) > 10) {
    event.preventDefault();
  }
}

private handleTouchEnd(event: TouchEvent): void {
  const endX = event.changedTouches[0].clientX;
  const endY = event.changedTouches[0].clientY;
  const endTime = Date.now();

  const diffX = endX - this.startX;
  const diffY = endY - this.startY;
  const timeDiff = endTime - this.startTime;

  // Check for swipe
  if (
    Math.abs(diffX) > this.minSwipeDistance &&
    Math.abs(diffY) < this.minSwipeDistance &&
    timeDiff < this.maxSwipeTime
  ) {
    if (diffX > 0) {
      this.onSwipeRight?.();
    } else {
      this.onSwipeLeft?.();
    }
    return;
  }

  // Check for double tap
  const now = Date.now();
  const timeSinceLastTap = now - this.lastTapTime;
  const distanceFromLastTap = Math.sqrt(
    Math.pow(endX - this.lastTapX, 2) + Math.pow(endY - this.lastTapY, 2)
  );

  if (
    timeSinceLastTap < this.doubleTapThreshold &&
    distanceFromLastTap < this.doubleTapDistance
  ) {
    this.onDoubleTap?.();
    this.lastTapTime = 0;
  } else {
    this.onTap?.();
    this.lastTapTime = now;
    this.lastTapX = endX;
    this.lastTapY = endY;
  }
}
```

The gesture handler:

1. Records the starting position and time on `touchstart`
2. Prevents default scrolling during horizontal swipes
3. On `touchend`, calculates the distance and duration of the touch
4. Detects swipes by checking for large horizontal movement with minimal vertical movement
5. Detects double-taps by tracking the time and distance between consecutive taps

### 5. Service Worker: `public/sw.js`

The service worker implements multiple caching strategies to optimize performance and enable offline functionality.

#### Installation

```javascript
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
```

On installation, the service worker:

1. Creates a cache store for essential assets
2. Pre-caches the HTML entry point
3. Calls `skipWaiting()` to activate immediately (in development)

#### Fetch Strategies

The service worker implements three different strategies:

**1. Network-First (Manifests)**

```javascript
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
}
```

Manifests use network-first because they contain metadata that may change. If the network is unavailable, a cached version is used.

**2. Cache-First (Book Pages)**

```javascript
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
}
```

Book pages use cache-first because they rarely change and offline access is the primary goal.

**3. Stale-While-Revalidate (Other Assets)**

```javascript
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
```

Other assets serve cached versions immediately while fetching updates in the background.

## Base Path Handling

The most critical aspect of GitHub Pages deployment is correct base path handling. This project uses several techniques:

1. **Vite Configuration**: `vite.config.ts` sets `base: '/HighPowerCatalog/'`
2. **Environment Variable**: `import.meta.env.BASE_URL` is used throughout the code
3. **Manifest Paths**: `public/manifest.webmanifest` includes the full base path in all URLs
4. **Service Worker Paths**: Hardcoded paths in `public/sw.js` include the full base path

Example from `public/manifest.webmanifest`:

```json
{
  "start_url": "/HighPowerCatalog/",
  "scope": "/HighPowerCatalog/",
  "icons": [
    {
      "src": "/HighPowerCatalog/icons/icon-192x192.png"
    }
  ]
}
```

## Book Manifest Format

Each book requires a `manifest.json` file that describes its structure:

```json
{
  "id": "catalog_11-12-25",
  "title": "HighPower Catalog - November 2025",
  "author": "HighPower",
  "totalPages": 12,
  "coverImage": "thumbs/page-0.jpg",
  "pages": [
    {
      "pageNumber": 1,
      "image": "pages/page-1.jpg",
      "thumbnail": "thumbs/page-1.jpg",
      "width": 1024,
      "height": 1536
    }
  ]
}
```

The `id` field is used to construct the book URL and cache names. The `pages` array contains metadata for each page, including the paths to full-size images and thumbnails.

## Performance Optimizations

1. **Lazy Loading**: Thumbnails use the `loading="lazy"` attribute to defer loading until needed
2. **Image Optimization**: The viewer uses `max-width: 100%; max-height: 100%` to fit images to the viewport
3. **Cache Versioning**: Cache names include version numbers to facilitate cache invalidation
4. **Selective Caching**: Only GET requests are cached; POST, PUT, DELETE requests bypass the cache
5. **Error Handling**: Individual cache failures don't stop the entire caching process

## Testing Considerations

1. **Local HTTPS**: The dev server uses basic SSL to simulate HTTPS, which is required for service worker testing
2. **Cache Clearing**: During development, clear the cache in DevTools to test the full download flow
3. **Offline Testing**: Use DevTools to simulate offline mode and verify fallback behavior
4. **Android Testing**: Use Chrome DevTools port forwarding to test on real devices

## Future Enhancements

Potential improvements for future versions:

1. **Search**: Full-text search across all pages using OCR or embedded metadata
2. **Bookmarks**: Allow users to save favorite pages
3. **Annotations**: Add highlighting and note-taking capabilities
4. **Sync**: Sync bookmarks and reading progress across devices
5. **Multiple Languages**: Internationalization support for different catalogs
6. **Compression**: Implement WebP image format with fallbacks for better performance
