import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8080,
    host: true, // Listen on all network interfaces
  },
  base: './',
  build: {
    sourcemap: true,
  }
});