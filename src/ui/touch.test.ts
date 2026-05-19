import { describe, expect, it } from 'vitest'
import { classifyTouchGesture } from './touch'

describe('classifyTouchGesture', () => {
  it('classifies a short, stationary touch as a tap', () => {
    expect(
      classifyTouchGesture({ startTimeMs: 0, endTimeMs: 200, distancePx: 0 }),
    ).toBe('tap')
  })

  it('classifies a long, stationary touch as a long-press', () => {
    expect(
      classifyTouchGesture({ startTimeMs: 0, endTimeMs: 600, distancePx: 0 }),
    ).toBe('long-press')
  })

  it('classifies a long, far-moving touch as a drag', () => {
    expect(
      classifyTouchGesture({ startTimeMs: 0, endTimeMs: 600, distancePx: 30 }),
    ).toBe('drag')
  })

  it('classifies a short, far-moving touch as a drag', () => {
    expect(
      classifyTouchGesture({ startTimeMs: 0, endTimeMs: 200, distancePx: 30 }),
    ).toBe('drag')
  })

  it('treats duration exactly equal to longPressMs as a long-press (>= boundary)', () => {
    // Boundary: 500ms exactly with zero motion qualifies as a long-press.
    expect(
      classifyTouchGesture({ startTimeMs: 0, endTimeMs: 500, distancePx: 0 }),
    ).toBe('long-press')
  })

  it('treats distance exactly equal to tapDistancePx as same-spot for long-press (<= boundary)', () => {
    // Boundary: a 10px wobble during a 600ms hold is still "same spot" and counts as long-press.
    expect(
      classifyTouchGesture({ startTimeMs: 0, endTimeMs: 600, distancePx: 10 }),
    ).toBe('long-press')
  })

  it('honors custom longPressMs threshold', () => {
    // With a 300ms long-press threshold, 400ms stationary counts as long-press.
    expect(
      classifyTouchGesture(
        { startTimeMs: 0, endTimeMs: 400, distancePx: 0 },
        { longPressMs: 300 },
      ),
    ).toBe('long-press')
    // ...but with the default 500ms it's still a tap.
    expect(
      classifyTouchGesture({ startTimeMs: 0, endTimeMs: 400, distancePx: 0 }),
    ).toBe('tap')
  })

  it('honors custom tapDistancePx threshold', () => {
    // A 15px wobble under a 20px tap-distance threshold during a long hold is a long-press.
    expect(
      classifyTouchGesture(
        { startTimeMs: 0, endTimeMs: 600, distancePx: 15 },
        { tapDistancePx: 20 },
      ),
    ).toBe('long-press')
    // ...but under the default 10px tolerance, that same wobble is a drag.
    expect(
      classifyTouchGesture({ startTimeMs: 0, endTimeMs: 600, distancePx: 15 }),
    ).toBe('drag')
  })
})
