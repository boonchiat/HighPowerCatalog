# HighPower Flipbook Catalog PWA

This project is a standalone Progressive Web App (PWA) for viewing flipbook-style catalogs. It is built with Vite, TypeScript, and Workbox, and is designed for easy deployment to GitHub Pages.

## Features

- **Flipbook Viewer**: Navigate through catalog pages with swipe gestures or next/previous buttons.
- **PWA & Offline Caching**: Download entire catalogs for offline viewing. The app uses a service worker to cache all necessary assets.
- **Dynamic Book Loading**: Load different catalogs by specifying a `book` query parameter (e.g., `/?book=catalog_name`).
- **GitHub Pages Deployment**: Includes a GitHub Actions workflow for automatic deployment on every push to the `main` branch.
- **Correct Base Path Handling**: All asset paths are configured to work correctly when hosted in a subdirectory on GitHub Pages (e.g., `/HighPowerCatalog/`).

## Project Structure

```
/ (repo root)
  README.md
  package.json
  vite.config.ts
  index.html
  public/
    manifest.webmanifest
    sw.js
    icons/
    books/
      catalog_11-12-25/  (example book)
        manifest.json
        pages/
        thumbs/
  src/
    main.ts
    flipbook/
      viewer.ts
      cache.ts
      gestures.ts
      types.ts
  .github/workflows/deploy.yml
```

## Local Development

To run the project locally for development, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/boonchiat/HighPowerCatalog.git
    cd HighPowerCatalog
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    This will start a local development server, typically at `https://localhost:5173`. The `basic-ssl` plugin is included in Vite's configuration to provide a self-signed SSL certificate, which is necessary for testing service worker functionality locally.

## Building for Production

To create a production-ready build, run:

```bash
npm run build
```

This command bundles the application and outputs the static files to the `dist/` directory. The `vite.config.ts` is configured to set the base path to `/HighPowerCatalog/`, ensuring all asset links are correct for GitHub Pages deployment.

## Deployment to GitHub Pages

The repository includes a pre-configured GitHub Actions workflow (`.github/workflows/deploy.yml`) that automates deployment.

1.  **Push to `main`:** Simply push your changes to the `main` branch. The workflow will automatically trigger, build the project, and deploy the contents of the `dist/` directory to your `gh-pages` branch.

2.  **Enable GitHub Pages in Repository Settings:**
    - Go to your repository on GitHub.
    - Click on the **Settings** tab.
    - In the left sidebar, click on **Pages**.
    - Under "Build and deployment", set the **Source** to **Deploy from a branch**.
    - Set the **Branch** to `gh-pages` and the folder to `/ (root)`.
    - Click **Save**. Your site should be live at `https://<your-username>.github.io/HighPowerCatalog/` within a few minutes.

## Verifying the Base Path

After deployment, you can verify that the base path is correctly configured:

1.  Open your deployed site: `https://boonchiat.github.io/HighPowerCatalog/`.
2.  Open the browser's developer tools (Right-click -> Inspect).
3.  Go to the **Elements** tab and inspect the `<head>` section of the `index.html` file.
4.  Check the `href` attributes of the `<link>` tags (e.g., for the manifest and icons). They should all be prefixed with `/HighPowerCatalog/`.
5.  Go to the **Network** tab and reload the page. All requests for assets (JS, CSS, images) should show a path that includes `/HighPowerCatalog/`.

## How to Add a New Book

The viewer is designed to be reusable. To add a new catalog:

1.  Create a new directory under `public/books/`. The directory name will be the book's ID (e.g., `public/books/new_catalog_2026`).
2.  Inside this new directory, create a `manifest.json` file. This file describes the book's properties and lists all its pages. Follow the structure of the example manifest in `public/books/catalog_11-12-25/manifest.json`.
3.  Place all full-size page images and thumbnail images in `pages/` and `thumbs/` subdirectories, respectively.
4.  Update the image paths in your new `manifest.json` to point to the correct files.
5.  To view the new book, append the book ID as a query parameter to the URL: `https://boonchiat.github.io/HighPowerCatalog/?book=new_catalog_2026`.

## Testing Offline PWA on Android

To test the offline capabilities on an Android device (e.g., Android 10):

1.  **Serve Locally with SSL:** Ensure your local development server is running (`npm run dev`). It must be served over HTTPS for service worker registration.

2.  **Connect Device:** Connect your Android device to your computer via USB and enable USB debugging in the developer options.

3.  **Port Forwarding:**
    - Open Chrome on your desktop and navigate to `chrome://inspect/#devices`.
    - Your Android device should appear. Click on the **Port forwarding** button.
    - Add a new rule: `Port` should be `5173` (or your Vite dev server port), and `IP address and port` should be `localhost:5173`.
    - Check the "Enable port forwarding" checkbox.

4.  **Access Site on Device:**
    - Open Chrome on your Android device and navigate to `localhost:5173`.
    - The flipbook PWA should load.

5.  **Download for Offline:**
    - Tap the download icon (⬇) in the header. A status message will appear indicating the caching progress.
    - Once caching is complete, you will see an "Offline Ready" message, and the download icon will change to a checkmark (✓).

6.  **Test Offline Mode:**
    - Turn off Wi-Fi and mobile data on your Android device.
    - Close and reopen Chrome, or refresh the page.
    - The flipbook should still load and be fully functional, served entirely from the cache by the service worker.
