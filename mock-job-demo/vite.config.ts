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
      '/multi_fileupload': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
