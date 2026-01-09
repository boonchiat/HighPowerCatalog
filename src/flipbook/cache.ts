export interface CacheState {
  isOfflineReady: boolean;
  isCaching: boolean;
  cacheProgress: number;
}

export class CacheManager {
  private state: CacheState = {
    isOfflineReady: false,
    isCaching: false,
    cacheProgress: 0,
  };

  private stateChangeCallbacks: ((state: CacheState) => void)[] = [];
  private baseUrl: string = import.meta.env.BASE_URL;

  constructor() {
    this.checkCacheStatus();
  }

  private async checkCacheStatus(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        console.log('Service Worker ready for offline support');
      } catch (error) {
        console.warn('Service Worker not available:', error);
      }
    }
  }

  async cacheBook(manifest: any): Promise<void> {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      throw new Error('Service Worker not available');
    }

    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      
      // Send message to service worker
      navigator.serviceWorker.controller!.postMessage(
        {
          type: 'CACHE_BOOK',
          bookId: manifest.id,
          pages: manifest.pages,
        },
        [channel.port2]
      );

      // Listen for responses on port1
      channel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_COMPLETE') {
          if (event.data.success) {
            this.setState({
              isOfflineReady: true,
              isCaching: false,
              cacheProgress: 100,
            });
            resolve();
          } else {
            reject(new Error(event.data.error || 'Caching failed'));
          }
          channel.port1.close();
        } else if (event.data.type === 'CACHE_PROGRESS') {
          this.setState({
            isCaching: true,
            cacheProgress: Math.round((event.data.cached / event.data.total) * 100),
          });
        }
      };

      // Timeout after 5 minutes
      setTimeout(() => {
        channel.port1.close();
        reject(new Error('Caching timeout'));
      }, 5 * 60 * 1000);
    });
  }

  async isBookCached(bookId: string): Promise<boolean> {
    if (!('caches' in window)) {
      return false;
    }

    try {
      const cache = await caches.open('flipbook-runtime-v1');
      const manifestUrl = `${this.baseUrl}books/${bookId}/manifest.json`;
      const response = await cache.match(manifestUrl);
      return !!response;
    } catch (error) {
      console.error('Error checking cache:', error);
      return false;
    }
  }

  async clearCache(): Promise<void> {
    if (!('caches' in window)) {
      return;
    }

    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(name => caches.delete(name))
      );
      this.setState({
        isOfflineReady: false,
        isCaching: false,
        cacheProgress: 0,
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  private setState(newState: Partial<CacheState>): void {
    this.state = { ...this.state, ...newState };
    this.stateChangeCallbacks.forEach(cb => cb(this.state));
  }

  onStateChange(callback: (state: CacheState) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  getState(): CacheState {
    return { ...this.state };
  }
}
