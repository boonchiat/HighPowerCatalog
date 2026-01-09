import type { BookManifest, CacheState } from './types';

const CACHE_PREFIX = 'flipbook-cache-';
const MANIFEST_CACHE = 'flipbook-manifests';

export class CacheManager {
  private cacheState: CacheState = {
    isOfflineReady: false,
    isCaching: false,
    cacheProgress: 0,
  };

  private stateChangeCallbacks: ((state: CacheState) => void)[] = [];

  constructor() {
    this.checkOfflineStatus();
  }

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

      // Cache cover image if different
      if (manifest.coverImage) {
        const coverUrl = `${import.meta.env.BASE_URL}books/${manifest.id}/${manifest.coverImage}`;
        try {
          await cache.add(coverUrl);
        } catch (error) {
          console.warn(`Failed to cache cover: ${coverUrl}`, error);
        }
      }

      this.updateState({ isOfflineReady: true, isCaching: false, cacheProgress: 100 });
    } catch (error) {
      console.error('Error downloading book for offline:', error);
      this.updateState({ isCaching: false });
    }
  }

  async getOfflineBookIds(): Promise<string[]> {
    if (!('caches' in window)) return [];

    try {
      const cacheNames = await caches.keys();
      return cacheNames
        .filter(name => name.startsWith(CACHE_PREFIX))
        .map(name => name.replace(CACHE_PREFIX, ''));
    } catch (error) {
      console.error('Error getting offline books:', error);
      return [];
    }
  }

  async deleteOfflineBook(bookId: string): Promise<void> {
    if (!('caches' in window)) return;

    try {
      const cacheName = `${CACHE_PREFIX}${bookId}`;
      await caches.delete(cacheName);
      this.updateState({ isOfflineReady: false });
    } catch (error) {
      console.error('Error deleting offline book:', error);
    }
  }

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

  getState(): CacheState {
    return { ...this.cacheState };
  }
}
