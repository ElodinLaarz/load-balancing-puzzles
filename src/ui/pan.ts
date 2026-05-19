/**
 * Pan helpers for board navigation.
 *
 * Pan is implemented by adjusting the scroll position of the board's scrollable
 * parent (`.board-wrap`). On pointer-down we capture the cursor position and
 * current scroll offset; on each move we shift the scroll inversely to the
 * cursor delta so the content tracks the cursor.
 */

export interface PanOrigin {
  /** Cursor clientX captured at pan start. */
  x: number
  /** Cursor clientY captured at pan start. */
  y: number
  /** Scroller `scrollLeft` captured at pan start. */
  scrollLeft: number
  /** Scroller `scrollTop` captured at pan start. */
  scrollTop: number
}

export interface PanPoint {
  clientX: number
  clientY: number
}

export interface ScrollOffset {
  scrollLeft: number
  scrollTop: number
}

/**
 * Compute the new scroll offset for a pan gesture.
 *
 * Moving the cursor right by `dx` shifts the viewport left by `dx`, which
 * corresponds to decreasing `scrollLeft` by `dx`. Same for the vertical axis.
 */
export function nextScroll(origin: PanOrigin, e: PanPoint): ScrollOffset {
  return {
    scrollLeft: origin.scrollLeft - (e.clientX - origin.x),
    scrollTop: origin.scrollTop - (e.clientY - origin.y),
  }
}

/** Apply a scroll offset to a scrollable element. Isolated so callers can mutate
 * the DOM without tripping the `react-hooks/immutability` lint rule on values
 * sourced from a React ref. */
export function applyScroll(el: Element, offset: ScrollOffset): void {
  el.scrollLeft = offset.scrollLeft
  el.scrollTop = offset.scrollTop
}

/**
 * Distance (in CSS pixels) a touch may travel before it is treated as a drag
 * rather than a tap. Mirrors the platform's default click-slop tolerance and
 * gives a comfortable buffer for finger jitter on touchscreens.
 */
export const TAP_THRESHOLD_PX = 8

/**
 * True when `current` has moved strictly more than `threshold` pixels (Euclidean)
 * from `start`. Used by the touch handler to upgrade a held-tap into a pan once
 * the finger has moved far enough to no longer count as a click.
 *
 * Note: comparison is strict (`>`), so a movement exactly equal to the threshold
 * still counts as a tap. This matches DOM `click` semantics where small motion
 * inside the slop radius is still routed as a click.
 */
export function exceedsTapThreshold(
  start: { x: number; y: number },
  current: { x: number; y: number },
  threshold = TAP_THRESHOLD_PX,
): boolean {
  const dx = current.x - start.x
  const dy = current.y - start.y
  return Math.hypot(dx, dy) > threshold
}
