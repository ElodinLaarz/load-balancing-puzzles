import { describe, expect, it } from 'vitest'
import { nextScroll } from './pan'

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
})
