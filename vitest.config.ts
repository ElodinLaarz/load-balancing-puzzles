import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/sim/**'],
      thresholds: { lines: 70, statements: 70, functions: 70, branches: 60 },
      reporter: ['text', 'html', 'json-summary'],
    },
  },
})
