import { defineConfig } from 'vite';
export default defineConfig({
  base: '/games/PULSE_CHAIN/',
  build: { target: 'es2022', rollupOptions: { input: { main: 'index.html', inspector: 'inspector.html' } } },
});
