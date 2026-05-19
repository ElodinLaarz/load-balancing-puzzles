import { describe, expect, it } from 'vitest'
import { tierForKey } from './hotkeys'
import type { BeltTier } from '../sim/types'

const ALL_TIERS: readonly BeltTier[] = ['yellow', 'red', 'blue']

describe('tierForKey', () => {
  it('maps "1" to yellow when allowed', () => {
    expect(tierForKey('1', ALL_TIERS)).toBe('yellow')
  })

  it('maps "2" to red when allowed', () => {
    expect(tierForKey('2', ALL_TIERS)).toBe('red')
  })

  it('maps "3" to blue when allowed', () => {
    expect(tierForKey('3', ALL_TIERS)).toBe('blue')
  })

  it('returns null for unmapped digit "4"', () => {
    expect(tierForKey('4', ALL_TIERS)).toBeNull()
  })

  it('returns null when the candidate tier is not allowed for the puzzle', () => {
    expect(tierForKey('2', ['yellow'])).toBeNull()
  })

  it('returns null for non-digit keys like "R"', () => {
    expect(tierForKey('R', ALL_TIERS)).toBeNull()
  })
})
