import type { BookManifest, BookPage } from './types';
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
          <div class="page-container" id="pageContainer">
            <img class="page-image" id="pageImage" alt="Book page" />
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
      </div>
    `;

    this.attachEventListeners();
    this.setupStyles();
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
      }

      .flipbook-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #0d0d0d;
        border-bottom: 1px solid #333;
        gap: 12px;
      }

      .flipbook-title {
        flex: 1;
        font-size: 18px;
        font-weight: 600;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .btn-menu, .btn-download, .btn-close-sidebar {
        background: #333;
        border: none;
        color: #fff;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        transition: background 0.2s;
      }

      .btn-menu:hover, .btn-download:hover, .btn-close-sidebar:hover {
        background: #555;
      }

      .btn-download.cached {
        background: #4caf50;
      }

      .flipbook-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
      }

      .page-container {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: auto;
        background: #000;
        user-select: none;
      }

      .page-image {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        cursor: grab;
      }

      .page-image:active {
        cursor: grabbing;
      }

      .page-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 12px 16px;
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
        background: #222;
        color: #666;
        cursor: not-allowed;
      }

      .page-counter {
        min-width: 120px;
        text-align: center;
        font-size: 14px;
        color: #aaa;
      }

      .flipbook-sidebar {
        position: fixed;
        top: 0;
        right: -300px;
        width: 300px;
        height: 100vh;
        background: #0d0d0d;
        border-left: 1px solid #333;
        display: flex;
        flex-direction: column;
        transition: right 0.3s ease;
        z-index: 1000;
      }

      .flipbook-sidebar.open {
        right: 0;
      }

      .sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
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
        aspect-ratio: 2/3;
        background: #1a1a1a;
        border: 2px solid #333;
        border-radius: 4px;
        cursor: pointer;
        overflow: hidden;
        transition: border-color 0.2s;
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
        object-fit: cover;
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
      }

      .cache-status.show {
        display: block;
      }

      .cache-status.success {
        background: #4caf50;
      }

      .cache-status.error {
        background: #f44336;
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

        .page-counter {
          font-size: 12px;
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

    btnMenu?.addEventListener('click', () => this.toggleSidebar());
    btnDownload?.addEventListener('click', () => this.downloadForOffline());
    btnPrev?.addEventListener('click', () => this.previousPage());
    btnNext?.addEventListener('click', () => this.nextPage());
    btnCloseSidebar?.addEventListener('click', () => this.toggleSidebar());

    if (pageContainer) {
      this.gestureHandler = new GestureHandler(pageContainer);
      this.gestureHandler.onSwipeLeft = () => this.nextPage();
      this.gestureHandler.onSwipeRight = () => this.previousPage();
    }

    // Listen to cache state changes
    this.cacheManager.onStateChange(state => {
      this.updateCacheStatus(state);
    });
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

  private updatePageControls(): void {
    if (!this.manifest) return;

    const btnPrev = document.getElementById('btnPrev') as HTMLButtonElement;
    const btnNext = document.getElementById('btnNext') as HTMLButtonElement;

    if (btnPrev) {
      btnPrev.disabled = this.currentPageIndex === 0;
    }

    if (btnNext) {
      btnNext.disabled = this.currentPageIndex === this.manifest.pages.length - 1;
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

  private async downloadForOffline(): Promise<void> {
    if (!this.manifest) return;

    await this.cacheManager.downloadBookForOffline(this.manifest);
  }

  private updateDownloadButton(): void {
    const btnDownload = document.getElementById('btnDownload');
    if (!btnDownload) return;

    const state = this.cacheManager.getState();
    if (state.isOfflineReady) {
      btnDownload.classList.add('cached');
      btnDownload.textContent = '✓';
      btnDownload.title = 'Downloaded for offline';
    } else {
      btnDownload.classList.remove('cached');
      btnDownload.textContent = '⬇';
      btnDownload.title = 'Download for offline';
    }
  }

  private updateCacheStatus(state: any): void {
    const statusEl = document.getElementById('cacheStatus');
    if (!statusEl) return;

    if (state.isCaching) {
      statusEl.classList.add('show');
      statusEl.textContent = `Caching... ${state.cacheProgress}%`;
      statusEl.classList.remove('success', 'error');
    } else if (state.isOfflineReady) {
      statusEl.classList.add('show', 'success');
      statusEl.textContent = 'Offline Ready ✓';
      setTimeout(() => {
        statusEl.classList.remove('show');
      }, 3000);
      this.updateDownloadButton();
    }
  }

  private showError(message: string): void {
    const statusEl = document.getElementById('cacheStatus');
    if (statusEl) {
      statusEl.classList.add('show', 'error');
      statusEl.textContent = message;
    }
  }
}
