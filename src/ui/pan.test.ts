import { describe, expect, it } from 'vitest'
import { exceedsTapThreshold, nextScroll, TAP_THRESHOLD_PX } from './pan'

describe('nextScroll', () => {
  const origin = { x: 100, y: 200, scrollLeft: 50, scrollTop: 80 }

  it('returns the origin scroll when cursor has not moved', () => {
    expect(nextScroll(origin, { clientX: 100, clientY: 200 })).toEqual({
      scrollLeft: 50,
      scrollTop: 80,
    })
  })

  it('decreases scrollLeft as cursor moves right (content follows cursor)', () => {
    // Cursor moved +30 right, +10 down: scroll shifts the opposite direction.
    expect(nextScroll(origin, { clientX: 130, clientY: 210 })).toEqual({
      scrollLeft: 20,
      scrollTop: 70,
    })
  })

  it('increases scrollLeft as cursor moves left', () => {
    // Cursor moved -40 left, -25 up.
    expect(nextScroll(origin, { clientX: 60, clientY: 175 })).toEqual({
      scrollLeft: 90,
      scrollTop: 105,
    })
  })

  it('allows negative resulting scroll values (caller clamps to scroller bounds)', () => {
    // Sanity: helper is pure arithmetic; clamping is the DOM's responsibility.
    const result = nextScroll(
      { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 },
      { clientX: 500, clientY: 500 }
    )
    expect(result).toEqual({ scrollLeft: -500, scrollTop: -500 })
  })

  it('works with touch-shaped point inputs (duck-typed clientX/clientY)', () => {
    // Touch event entries (`Touch` objects) expose `clientX`/`clientY` just
    // like `MouseEvent`, so the same helper can drive touch pans.
    const touchPoint = { clientX: 130, clientY: 210, identifier: 0, force: 1 }
    expect(nextScroll(origin, touchPoint)).toEqual({
      scrollLeft: 20,
      scrollTop: 70,
    })
  })
})

describe('exceedsTapThreshold', () => {
  const start = { x: 100, y: 200 }

  it('exposes TAP_THRESHOLD_PX as the default and uses 8px', () => {
    expect(TAP_THRESHOLD_PX).toBe(8)
  })

  it('returns false when current point is exactly at the start', () => {
    expect(exceedsTapThreshold(start, { x: 100, y: 200 })).toBe(false)
  })

  it('returns false for small jitter under the default threshold', () => {
    // ~5px diagonal: hypot(3,4) === 5, under default 8.
    expect(exceedsTapThreshold(start, { x: 103, y: 204 })).toBe(false)
  })

  it('returns false for movement exactly on the threshold boundary', () => {
    // hypot(0, 8) === 8 — strict greater-than means this is NOT a drag yet.
    expect(exceedsTapThreshold(start, { x: 100, y: 208 })).toBe(false)
  })

  it('returns true once movement passes the default threshold', () => {
    // hypot(6, 8) === 10, > 8.
    expect(exceedsTapThreshold(start, { x: 106, y: 208 })).toBe(true)
  })

  it('honors a custom threshold when supplied', () => {
    // Same 5px move: under custom threshold of 10, over custom threshold of 3.
    expect(exceedsTapThreshold(start, { x: 103, y: 204 }, 10)).toBe(false)
    expect(exceedsTapThreshold(start, { x: 103, y: 204 }, 3)).toBe(true)
  })
})
