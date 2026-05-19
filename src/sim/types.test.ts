import { describe, expect, it } from 'vitest'
import { idx, inBounds, BELT_THROUGHPUT, type Grid } from './types'

const makeGrid = (w: number, h: number): Grid => ({
  w,
  h,
  cells: new Array(w * h).fill(null),
})

describe('idx', () => {
  it('returns y*w + x for the (0,0) corner', () => {
    const g = makeGrid(5, 4)
    expect(idx(g, 0, 0)).toBe(0)
  })

  it('returns y*w + x for an arbitrary interior cell', () => {
    const g = makeGrid(5, 4)
    // (x=3, y=2) -> 2 * 5 + 3 = 13
    expect(idx(g, 3, 2)).toBe(13)
  })

  it('returns y*w + x for the bottom-right corner', () => {
    const g = makeGrid(5, 4)
    // (x=4, y=3) -> 3 * 5 + 4 = 19
    expect(idx(g, 4, 3)).toBe(19)
  })

  it('matches row-major layout: indices step by 1 along x, by w along y', () => {
    const g = makeGrid(7, 3)
    expect(idx(g, 1, 0) - idx(g, 0, 0)).toBe(1)
    expect(idx(g, 0, 1) - idx(g, 0, 0)).toBe(g.w)
  })

  it('handles a 1x1 grid', () => {
    const g = makeGrid(1, 1)
    expect(idx(g, 0, 0)).toBe(0)
  })
})

describe('inBounds', () => {
  it('returns true for all four corners of a non-empty grid', () => {
    const g = makeGrid(4, 3)
    expect(inBounds(g, 0, 0)).toBe(true)
    expect(inBounds(g, g.w - 1, 0)).toBe(true)
    expect(inBounds(g, 0, g.h - 1)).toBe(true)
    expect(inBounds(g, g.w - 1, g.h - 1)).toBe(true)
  })

  it('returns false for negative x or y', () => {
    const g = makeGrid(4, 3)
    expect(inBounds(g, -1, 0)).toBe(false)
    expect(inBounds(g, 0, -1)).toBe(false)
    expect(inBounds(g, -1, -1)).toBe(false)
  })

  it('returns false when x >= w', () => {
    const g = makeGrid(4, 3)
    expect(inBounds(g, 4, 0)).toBe(false)
    expect(inBounds(g, 100, 0)).toBe(false)
  })

  it('returns false when y >= h', () => {
    const g = makeGrid(4, 3)
    expect(inBounds(g, 0, 3)).toBe(false)
    expect(inBounds(g, 0, 100)).toBe(false)
  })

  it('returns true for interior cells', () => {
    const g = makeGrid(4, 3)
    expect(inBounds(g, 2, 1)).toBe(true)
  })
})

describe('BELT_THROUGHPUT', () => {
  it('defines yellow/red/blue throughput values', () => {
    expect(BELT_THROUGHPUT.yellow).toBe(15)
    expect(BELT_THROUGHPUT.red).toBe(30)
    expect(BELT_THROUGHPUT.blue).toBe(45)
  })
})
