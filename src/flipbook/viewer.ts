import { GestureHandler } from './gestures';
import { CacheManager } from './cache';

export class FlipbookViewer {
  private container: HTMLElement;
  private manifest: BookManifest | null = null;
  private currentPageIndex = 0;
  private gestureHandler: GestureHandler | null = null;
  private cacheManager: CacheManager;
  private isLoading = false;
  private baseUrl: string;
  
  // Zoom and pan
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private zoomAnimationId: number | null = null;
  private panAnimationId: number | null = null;
  private minZoom = 1;
  private maxZoom = 3;
  
  // Lazy loading
  private loadedPages = new Map<number, HTMLImageElement>();
  private pageCache = new Map<number, string>();

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

  private setupContainer(): void {
    this.container.innerHTML = `
      <div class="flipbook-viewer">
        <div class="flipbook-header">
          <button class="btn-menu" id="btnMenu" title="Menu">☰</button>
          <h1 class="flipbook-title" id="bookTitle">Loading...</h1>
          <button class="btn-download" id="btnDownload" title="Download for Offline">⬇</button>
        </div>
        
        <div class="flipbook-content" id="flipbookContent">
          <div class="zoom-controls">
            <button class="btn-zoom" id="btnZoomOut" title="Zoom Out">−</button>
            <span class="zoom-level" id="zoomLevel">100%</span>
            <button class="btn-zoom" id="btnZoomIn" title="Zoom In">+</button>
            <button class="btn-zoom" id="btnFitWidth" title="Fit to Width">⊡</button>
          </div>
          
          <div class="page-container" id="pageContainer">
            <div class="page-viewer" id="pageViewer">
              <img class="page-image" id="pageImage" alt="Book page" />
            </div>
          </div>
          
          <div class="page-controls">
            <button class="btn-prev" id="btnPrev">← Previous</button>
            <span class="page-counter" id="pageCounter">Page 1 of 1</span>
            <button class="btn-next" id="btnNext">Next →</button>
          </div>
        </div>

        <div class="flipbook-sidebar" id="sidebar">
          <div class="sidebar-header">
            <h2>Thumbnails</h2>
            <button class="btn-close-sidebar" id="btnCloseSidebar">✕</button>
          </div>
          <div class="thumbnail-grid" id="thumbnailGrid"></div>
        </div>

        <div class="cache-status" id="cacheStatus"></div>
        <div class="offline-message" id="offlineMessage"></div>
        <div class="install-prompt" id="installPrompt">
          <div class="install-content">
            <div class="install-icon">📱</div>
            <div class="install-text">
              <h3>Add to Home Screen</h3>
              <p>Get quick access to your catalog</p>
            </div>
            <button class="btn-install" id="btnInstall">Install</button>
            <button class="btn-dismiss" id="btnDismiss">✕</button>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
    this.setupStyles();
    this.checkOfflineStatus();
  }

  private setupStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .flipbook-viewer {
        display: flex;
        flex-direction: column;
        height: 100vh;
        background: #1a1a1a;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .flipbook-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #0d0d0d;
        border-bottom: 1px solid #333;
        gap: 12px;
        z-index: 100;
      }

      .flipbook-title {
        flex: 1;
        font-size: 18px;
        font-weight: 600;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin: 0;
      }

      .btn-menu, .btn-download, .btn-close-sidebar, .btn-zoom {
        background: #333;
        border: none;
        color: #fff;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        transition: background 0.2s;
      }

      .btn-menu:hover, .btn-download:hover, .btn-close-sidebar:hover, .btn-zoom:hover {
        background: #555;
      }

      .flipbook-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
      }

      .zoom-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px;
        background: #0d0d0d;
        border-bottom: 1px solid #333;
      }

      .zoom-level {
        font-size: 12px;
        min-width: 50px;
        text-align: center;
      }

      .page-container {
        flex: 1;
        overflow: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0d0d0d;
        position: relative;
      }

      .page-viewer {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        user-select: none;
        transform-origin: center;
        will-change: transform;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      }

      .page-viewer.panning {
        cursor: grabbing;
      }

      .page-image {
        max-width: 100%;
        max-height: 100%;
        display: block;
        image-rendering: high-quality;
        will-change: transform;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      }

      .page-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 12px;
        background: #0d0d0d;
        border-top: 1px solid #333;
      }

      .btn-prev, .btn-next {
        background: #333;
        border: none;
        color: #fff;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
      }

      .btn-prev:hover, .btn-next:hover {
        background: #555;
      }

      .btn-prev:disabled, .btn-next:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .page-counter {
        font-size: 12px;
        min-width: 100px;
        text-align: center;
      }

      .flipbook-sidebar {
        position: fixed;
        left: -320px;
        top: 0;
        width: 300px;
        height: 100vh;
        background: #1a1a1a;
        border-right: 1px solid #333;
        transition: left 0.3s ease-out;
        z-index: 200;
        display: flex;
        flex-direction: column;
      }

      .flipbook-sidebar.open {
        left: 0;
      }

      .sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px;
        border-bottom: 1px solid #333;
      }

      .sidebar-header h2 {
        font-size: 16px;
        margin: 0;
      }

      .thumbnail-grid {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
      }

      .thumbnail {
        width: 100%;
        aspect-ratio: 2/3;
        background: #0d0d0d;
        border: 2px solid #333;
        border-radius: 4px;
        cursor: pointer;
        overflow: hidden;
        transition: border-color 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .thumbnail:hover {
        border-color: #666;
      }

      .thumbnail.active {
        border-color: #4caf50;
      }

      .thumbnail img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: #0d0d0d;
      }

      .cache-status {
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: #333;
        padding: 12px 16px;
        border-radius: 4px;
        font-size: 12px;
        max-width: 200px;
        z-index: 500;
        display: none;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }

      .cache-status.show {
        display: block;
        animation: slideIn 0.3s ease-out;
      }

      .cache-status.success {
        background: #4caf50;
        color: #fff;
      }

      .cache-status.error {
        background: #f44336;
        color: #fff;
      }

      .cache-status.info {
        background: #2196f3;
        color: #fff;
      }

      .offline-message {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #f44336;
        color: #fff;
        padding: 24px 32px;
        border-radius: 8px;
        text-align: center;
        z-index: 600;
        display: none;
        max-width: 80%;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      }

      .offline-message.show {
        display: block;
        animation: fadeIn 0.3s ease-out;
      }

      @keyframes slideIn {
        from {
          transform: translateX(-20px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      .install-prompt {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #333;
        border: 2px solid #4caf50;
        border-radius: 8px;
        padding: 16px;
        z-index: 400;
        display: none;
        max-width: 300px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      }

      .install-prompt.show {
        display: flex;
        animation: slideIn 0.3s ease-out;
      }

      .install-content {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
      }

      .install-icon {
        font-size: 32px;
        flex-shrink: 0;
      }

      .install-text {
        flex: 1;
      }

      .install-text h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #fff;
      }

      .install-text p {
        margin: 4px 0 0 0;
        font-size: 12px;
        color: #ccc;
      }

      .btn-install {
        background: #4caf50;
        border: none;
        color: #fff;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        flex-shrink: 0;
        transition: background 0.2s;
      }

      .btn-install:hover {
        background: #45a049;
      }

      .btn-dismiss {
        background: transparent;
        border: none;
        color: #999;
        cursor: pointer;
        font-size: 16px;
        padding: 0;
        flex-shrink: 0;
        transition: color 0.2s;
      }

      .btn-dismiss:hover {
        color: #fff;
      }

      @media (max-width: 768px) {
        .flipbook-title {
          font-size: 16px;
        }

        .page-controls {
          gap: 8px;
          padding: 8px;
        }

        .btn-prev, .btn-next {
          padding: 6px 12px;
          font-size: 12px;
        }

        .zoom-controls {
          gap: 4px;
          padding: 4px;
        }

        .btn-zoom {
          padding: 6px 8px;
          font-size: 14px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  private attachEventListeners(): void {
    const btnMenu = document.getElementById('btnMenu');
    const btnDownload = document.getElementById('btnDownload');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const btnCloseSidebar = document.getElementById('btnCloseSidebar');
    const pageContainer = document.getElementById('pageContainer');
    const pageViewer = document.getElementById('pageViewer');
    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    const btnFitWidth = document.getElementById('btnFitWidth');

    btnMenu?.addEventListener('click', () => this.toggleSidebar());
    btnDownload?.addEventListener('click', () => this.downloadForOffline());
    btnPrev?.addEventListener('click', () => this.previousPage());
    btnNext?.addEventListener('click', () => this.nextPage());
    btnCloseSidebar?.addEventListener('click', () => this.toggleSidebar());
    btnZoomIn?.addEventListener('click', () => this.zoomIn());
    btnZoomOut?.addEventListener('click', () => this.zoomOut());
    btnFitWidth?.addEventListener('click', () => this.fitToWidth());

    if (pageContainer) {
      this.gestureHandler = new GestureHandler(pageContainer);
      this.gestureHandler.onSwipeLeft = () => this.nextPage();
      this.gestureHandler.onSwipeRight = () => this.previousPage();
    }

    if (pageViewer) {
      pageViewer.addEventListener('mousedown', (e) => this.startPan(e));
      pageViewer.addEventListener('mousemove', (e) => this.doPan(e));
      pageViewer.addEventListener('mouseup', () => this.endPan());
      pageViewer.addEventListener('mouseleave', () => this.endPan());
      pageViewer.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    }

    // Listen to cache state changes
    this.cacheManager.onStateChange(state => {
      this.updateCacheStatus(state);
    });

    // Listen for online/offline events
    window.addEventListener('online', () => this.checkOfflineStatus());
    window.addEventListener('offline', () => this.checkOfflineStatus());

    // PWA install prompt
    const btnInstall = document.getElementById("btnInstall");
    const btnDismiss = document.getElementById("btnDismiss");
    if (btnInstall) {
      btnInstall.addEventListener("click", () => this.installPWA());
    }
    if (btnDismiss) {
      btnDismiss.addEventListener("click", () => this.dismissInstallPrompt());
    }

    // Listen for beforeinstallprompt event
    window.addEventListener("beforeinstallprompt", (e: any) => this.handleBeforeInstallPrompt(e));
  }

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
      console.log('Manifest loaded:', this.manifest);
      if (this.manifest.pages && this.manifest.pages.length > 0) {
        console.log('First page object:', this.manifest.pages[0]);
      }
      this.currentPageIndex = 0;
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
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

  private renderPage(): void {
    if (!this.manifest) {
      console.error('No manifest loaded');
      return;
    }

    const page = this.manifest.pages[this.currentPageIndex];
    console.log('Current page index:', this.currentPageIndex);
    console.log('Page object:', page);
    if (!page) {
      console.error('Page not found at index:', this.currentPageIndex);
      return;
    }

    const pageImage = document.getElementById('pageImage') as HTMLImageElement;
    const pageCounter = document.getElementById('pageCounter');
    const bookTitle = document.getElementById('bookTitle');
    const pageViewer = document.getElementById('pageViewer') as HTMLElement;

    pageImage.src = `${this.baseUrl}books/${this.manifest.id}/${page.image}`;
    pageImage.alt = `Page ${page.pageNumber}`;

    if (pageCounter) {
      pageCounter.textContent = `Page ${page.pageNumber} of ${this.manifest.totalPages}`;
    }

    if (bookTitle) {
      bookTitle.textContent = this.manifest.title;
    }

    // Reset zoom and pan when changing pages
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.updatePageTransform();

    this.updatePageControls();
    this.preloadAdjacentPages();
  }

  private renderThumbnails(): void {
    if (!this.manifest) return;

    const grid = document.getElementById('thumbnailGrid');
    if (!grid) return;

    grid.innerHTML = '';

    this.manifest.pages.forEach((page, index) => {
      const thumb = document.createElement('div');
      thumb.className = 'thumbnail';
      if (index === this.currentPageIndex) {
        thumb.classList.add('active');
      }

      const img = document.createElement('img');
      img.src = `${this.baseUrl}books/${this.manifest!.id}/${page.thumbnail}`;
      img.alt = `Thumbnail page ${page.pageNumber}`;
      img.loading = 'lazy';

      thumb.appendChild(img);
      thumb.addEventListener('click', () => {
        this.currentPageIndex = index;
        this.renderPage();
        this.renderThumbnails();
      });

      grid.appendChild(thumb);
    });
  }

  private preloadAdjacentPages(): void {
    if (!this.manifest) return;

    // Preload previous page
    if (this.currentPageIndex > 0) {
      const prevPage = this.manifest.pages[this.currentPageIndex - 1];
      const prevImg = new Image();
      prevImg.src = `${this.baseUrl}books/${this.manifest.id}/${prevPage.image}`;
    }

    // Preload next page
    if (this.currentPageIndex < this.manifest.pages.length - 1) {
      const nextPage = this.manifest.pages[this.currentPageIndex + 1];
      const nextImg = new Image();
      nextImg.src = `${this.baseUrl}books/${this.manifest.id}/${nextPage.image}`;
    }
  }

  private updatePageControls(): void {
    const btnPrev = document.getElementById('btnPrev') as HTMLButtonElement;
    const btnNext = document.getElementById('btnNext') as HTMLButtonElement;

    if (btnPrev) {
      btnPrev.disabled = this.currentPageIndex === 0;
    }
    if (btnNext) {
      btnNext.disabled = this.currentPageIndex === (this.manifest?.pages.length ?? 1) - 1;
    }
  }

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

  private toggleSidebar(): void {
    const sidebar = document.getElementById('sidebar');
    sidebar?.classList.toggle('open');
  }

  private zoomIn(): void {
    this.zoom = Math.min(this.zoom + 0.2, this.maxZoom);
    this.updatePageTransform();
  }

  private zoomOut(): void {
    this.zoom = Math.max(this.zoom - 0.2, this.minZoom);
    this.updatePageTransform();
  }

  private fitToWidth(): void {
    const pageContainer = document.getElementById('pageContainer');
    const pageImage = document.getElementById('pageImage') as HTMLImageElement;
    
    if (pageContainer && pageImage && pageImage.naturalWidth) {
      const containerWidth = pageContainer.clientWidth;
      this.zoom = containerWidth / pageImage.naturalWidth;
      this.updatePageTransform();
    }
  }

  private startPan(e: MouseEvent): void {
    if (this.zoom <= 1) return;
    this.isPanning = true;
    this.panStartX = e.clientX - this.panX;
    this.panStartY = e.clientY - this.panY;
    const pageViewer = document.getElementById('pageViewer');
    pageViewer?.classList.add('panning');
  }

  private doPan(e: MouseEvent): void {
    if (!this.isPanning || this.zoom <= 1) return;
    this.panX = e.clientX - this.panStartX;
    this.panY = e.clientY - this.panStartY;
    if (this.panAnimationId !== null) {
      cancelAnimationFrame(this.panAnimationId);
    }
    this.panAnimationId = requestAnimationFrame(() => {
      this.updatePageTransform();
      this.panAnimationId = null;
    });
  }

  private endPan(): void {
    this.isPanning = false;
    const pageViewer = document.getElementById('pageViewer');
    pageViewer?.classList.remove('panning');
  }

  private handleWheel(e: WheelEvent): void {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const oldZoom = this.zoom;
    if (e.deltaY < 0) {
      this.zoom = Math.min(this.zoom + 0.1, this.maxZoom);
    } else {
      this.zoom = Math.max(this.zoom - 0.1, this.minZoom);
    }
    if (this.zoom !== oldZoom) {
      this.updatePageTransform();
    }
  }

  private updatePageTransform(): void {
    const pageViewer = document.getElementById('pageViewer') as HTMLElement;
    const zoomLevel = document.getElementById('zoomLevel');
    
    if (pageViewer) {
      const translateX = this.panX / this.zoom;
      const translateY = this.panY / this.zoom;
      pageViewer.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${this.zoom})`;
    }
    
    if (zoomLevel) {
      zoomLevel.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  }

  private async downloadForOffline(): Promise<void> {
    if (!this.manifest) return;

    const btnDownload = document.getElementById('btnDownload') as HTMLButtonElement;
    if (btnDownload) {
      btnDownload.disabled = true;
    }

    this.showCacheStatus('Downloading…', 'info');

    try {
      await this.cacheManager.cacheBook(this.manifest);
      this.showCacheStatus('Offline Ready ✓', 'success');
      
      if (btnDownload) {
        btnDownload.textContent = '✓';
      }
    } catch (error) {
      console.error('Failed to cache book:', error);
      this.showCacheStatus('Download failed', 'error');
    }
  }

  private showCacheStatus(message: string, type: 'info' | 'success' | 'error'): void {
    const status = document.getElementById('cacheStatus');
    if (!status) return;

    status.textContent = message;
    status.className = `cache-status show ${type}`;

    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        status.classList.remove('show');
      }, 3000);
    }
  }

  private async checkOfflineStatus(): Promise<void> {
    if (!navigator.onLine && this.manifest) {
      const isCached = await this.cacheManager.isBookCached(this.manifest.id);
      if (!isCached) {
        this.showOfflineMessage('Offline assets not downloaded yet. Please connect once.');
      }
    }
  }

  private showOfflineMessage(message: string): void {
    const offlineMsg = document.getElementById('offlineMessage');
    if (!offlineMsg) return;

    offlineMsg.textContent = message;
    offlineMsg.classList.add('show');

    setTimeout(() => {
      offlineMsg.classList.remove('show');
    }, 5000);
  }

  private updateCacheStatus(state: any): void {
    // Cache state updates handled by cache manager
  }

  private showError(message: string): void {
    const offlineMsg = document.getElementById('offlineMessage');
    if (offlineMsg) {
      offlineMsg.textContent = message;
      offlineMsg.classList.add('show');
    }
  }

  private async updateDownloadButton(): Promise<void> {
    if (!this.manifest) return;

    const btnDownload = document.getElementById('btnDownload') as HTMLButtonElement;
    if (!btnDownload) return;

    try {
      const isCached = await this.cacheManager.isBookCached(this.manifest.id);
      if (isCached) {
        btnDownload.textContent = '✓';
        btnDownload.disabled = true;
        btnDownload.title = 'Book is cached for offline';
      } else {
        btnDownload.textContent = '⬇';
        btnDownload.disabled = false;
        btnDownload.title = 'Download for Offline';
      }
    } catch (error) {
      console.error('Error updating download button:', error);
    }
  }

  private deferredPrompt: any = null;

  private handleBeforeInstallPrompt(e: any): void {
    e.preventDefault();
    this.deferredPrompt = e;
    const installPrompt = document.getElementById('installPrompt');
    if (installPrompt) {
      installPrompt.classList.add('show');
    }
  }

  private async installPWA(): Promise<void> {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    console.log(`User response: ${outcome}`);
    this.deferredPrompt = null;
    this.dismissInstallPrompt();
  }

  private dismissInstallPrompt(): void {
    const installPrompt = document.getElementById('installPrompt');
    if (installPrompt) {
      installPrompt.classList.remove('show');
    }
  }
}

interface BookPage {
  pageNumber: number;
  image: string;
  thumbnail: string;
  width: number;
  height: number;
}

interface BookManifest {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  coverImage: string;
  pages: BookPage[];
}
