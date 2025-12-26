import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/issue': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/upload': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Route multi file upload to FastAPI while keeping same-origin from the browser's perspective
      '/multi-fileupload': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/epic-init': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/check-status': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
