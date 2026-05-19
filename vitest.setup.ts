// Subpath '/vitest' extends Vitest's expect (not Jest's) with the jest-dom
// matchers. Importing the top-level '@testing-library/jest-dom' assumes a Jest
// global and crashes under Vitest.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// @testing-library/react only auto-cleans when an `afterEach` global is present
// (i.e. Vitest globals enabled). We don't enable globals, so register cleanup
// manually to keep tests isolated.
afterEach(() => {
  cleanup()
})
