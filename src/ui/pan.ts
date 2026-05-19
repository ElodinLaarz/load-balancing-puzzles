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
