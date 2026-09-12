import { defineConfig } from 'vite';
export default defineConfig({ base: './', worker: { format: 'es', rollupOptions: { output: { manualChunks(id) { if (id.includes('@breezystack/lamejs')) return 'lamejs'; } } } } });
