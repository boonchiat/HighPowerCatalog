import { FlipbookViewer } from './flipbook/viewer';

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(registration => {
        console.log('Service Worker registered:', registration);
      })
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

// Load the book
viewer.loadBook(bookId).catch(error => {
  console.error('Failed to load book:', error);
});
