import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GH Pages serves at /<repo>/
export default defineConfig({
  plugins: [react()],
  base: '/load-balancing-puzzles/',
})
