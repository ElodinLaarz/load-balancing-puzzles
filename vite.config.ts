import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GH Pages serves at /<repo>/
export default defineConfig({
  plugins: [react()],
  base: '/load-balancing-puzzles/',
  build: {
    // The Pixi vendor chunk is intentionally large but lazy-loaded behind Suspense;
    // bump the warning limit so we keep the legit warning if any new chunk creeps over.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Normalise Windows paths so includes() matches regardless of slash form.
          const p = id.replace(/\\/g, '/')
          if (p.includes('node_modules/pixi.js') || p.includes('node_modules/@pixi/')) {
            return 'pixi'
          }
        },
      },
    },
  },
})
