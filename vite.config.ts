import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  base: '/HighPowerCatalog/',
  plugins: [basicSsl()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
