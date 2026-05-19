import { defineWorkspace } from 'vitest/config'

// Vitest 2 multi-project workspace. Vitest 3 introduces inline `test.projects`,
// but on 2.1.x the supported entrypoint is `defineWorkspace` in this file.
//
// - sim:     pure logic, node env. Coverage thresholds enforced here.
// - puzzles: puzzle-data assertions (e.g. JSON puzzles are solvable on the
//            current solver). Pure logic, node env, no coverage budget.
// - ui:      React render tests, jsdom env, with @testing-library/jest-dom matchers.
//            No coverage thresholds yet (smoke-tests are entry-level).
export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'sim',
      environment: 'node',
      include: ['src/sim/**/*.test.ts'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'puzzles',
      environment: 'node',
      include: ['src/puzzles/**/*.test.ts'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'ui',
      environment: 'jsdom',
      include: ['src/ui/**/*.test.{ts,tsx}', 'src/App.test.{ts,tsx}'],
      setupFiles: ['./vitest.setup.ts'],
    },
  },
])
