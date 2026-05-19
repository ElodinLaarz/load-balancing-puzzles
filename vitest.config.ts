import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Base config shared by every workspace project (see vitest.workspace.ts).
// - React plugin is needed so .tsx UI render tests compile.
// - Coverage stays scoped to src/sim/** so existing thresholds keep working;
//   UI smoke tests don't have a coverage budget yet.
export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/sim/**'],
      thresholds: { lines: 70, statements: 70, functions: 70, branches: 60 },
      reporter: ['text', 'html', 'json-summary'],
    },
  },
})
