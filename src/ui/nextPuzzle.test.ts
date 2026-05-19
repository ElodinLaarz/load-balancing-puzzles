import { describe, expect, it } from 'vitest'
import { nextPuzzleId } from './nextPuzzle'

describe('nextPuzzleId', () => {
  it('returns the id immediately after the first id', () => {
    expect(nextPuzzleId('a', ['a', 'b', 'c'])).toBe('b')
  })

  it('returns null when currentId is the last id', () => {
    expect(nextPuzzleId('c', ['a', 'b', 'c'])).toBeNull()
  })

  it('returns null when currentId is not present in the list', () => {
    expect(nextPuzzleId('z', ['a', 'b', 'c'])).toBeNull()
  })

  it('returns null for a single-element list', () => {
    expect(nextPuzzleId('a', ['a'])).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(nextPuzzleId('a', [])).toBeNull()
  })
})
