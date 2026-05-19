import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PuzzleScore } from './score'
import { getBest, saveIfBest } from './highScores'

// In-memory localStorage stub; vitest config currently uses the node
// environment for src/ui/**/*.test.ts, so we provide our own.
function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null
    },
    key(i: number) {
      return Array.from(map.keys())[i] ?? null
    },
    removeItem(key: string) {
      map.delete(key)
    },
    setItem(key: string, value: string) {
      map.set(key, String(value))
    },
  }
}

const score = (cellsUsed: number, tierCost: number): PuzzleScore => ({
  cellsUsed,
  tierCost,
  total: cellsUsed + tierCost,
})

describe('highScores (with localStorage)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getBest returns null when no record exists', () => {
    expect(getBest('puzzle-a')).toBeNull()
  })

  it('saveIfBest writes a new record when none exists', () => {
    const s = score(3, 4)
    const result = saveIfBest('puzzle-a', s)
    expect(result.saved).toBe(true)
    expect(result.record.cellsUsed).toBe(3)
    expect(result.record.tierCost).toBe(4)
    expect(result.record.total).toBe(7)
    expect(typeof result.record.ts).toBe('number')

    const fetched = getBest('puzzle-a')
    expect(fetched).not.toBeNull()
    expect(fetched!.total).toBe(7)
  })

  it('saveIfBest does NOT overwrite when new total is greater', () => {
    saveIfBest('puzzle-a', score(2, 3)) // total 5
    const result = saveIfBest('puzzle-a', score(5, 5)) // total 10
    expect(result.saved).toBe(false)
    expect(result.record.total).toBe(5)
    expect(getBest('puzzle-a')!.total).toBe(5)
  })

  it('saveIfBest does NOT overwrite on tie (preserves earlier ts)', () => {
    const first = saveIfBest('puzzle-a', score(3, 4)) // total 7
    const firstTs = first.record.ts
    // Force a different "now" so we can detect overwrite if it happens.
    vi.useFakeTimers()
    vi.setSystemTime(firstTs + 10_000)
    try {
      const result = saveIfBest('puzzle-a', score(3, 4)) // same total 7
      expect(result.saved).toBe(false)
      expect(result.record.ts).toBe(firstTs)
      expect(getBest('puzzle-a')!.ts).toBe(firstTs)
    } finally {
      vi.useRealTimers()
    }
  })

  it('saveIfBest overwrites when new total is strictly less', () => {
    saveIfBest('puzzle-a', score(5, 5)) // total 10
    const result = saveIfBest('puzzle-a', score(2, 3)) // total 5
    expect(result.saved).toBe(true)
    expect(result.record.total).toBe(5)
    expect(getBest('puzzle-a')!.total).toBe(5)
  })

  it('does not collide across different puzzle ids', () => {
    saveIfBest('puzzle-a', score(2, 3)) // 5
    saveIfBest('puzzle-b', score(7, 8)) // 15
    expect(getBest('puzzle-a')!.total).toBe(5)
    expect(getBest('puzzle-b')!.total).toBe(15)

    // Improving one does not touch the other.
    saveIfBest('puzzle-a', score(1, 1)) // 2
    expect(getBest('puzzle-a')!.total).toBe(2)
    expect(getBest('puzzle-b')!.total).toBe(15)
  })
})

describe('highScores (without localStorage)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getBest returns null and does not throw', () => {
    expect(() => getBest('puzzle-a')).not.toThrow()
    expect(getBest('puzzle-a')).toBeNull()
  })

  it('saveIfBest does not throw and reports saved=false', () => {
    const s = score(2, 3)
    let result!: ReturnType<typeof saveIfBest>
    expect(() => {
      result = saveIfBest('puzzle-a', s)
    }).not.toThrow()
    expect(result.saved).toBe(false)
    // Returned record should still reflect the supplied score.
    expect(result.record.total).toBe(5)
  })
})
