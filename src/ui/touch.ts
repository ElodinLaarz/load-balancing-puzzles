/**
 * Touch gesture classifier.
 *
 * A single-finger touch can end in one of three ways:
 *   - 'tap'        — short hold, finger stayed approximately in place
 *   - 'long-press' — long hold (>= longPressMs), finger stayed approximately
 *                    in place (<= tapDistancePx). Used to trigger erase on
 *                    touch devices where right-click is impossible.
 *   - 'drag'       — finger moved beyond tapDistancePx. Pan, not placement.
 */

export interface TouchGesture {
  /** Timestamp captured at touchstart (ms, e.g. `performance.now()`). */
  startTimeMs: number
  /** Timestamp captured at touchend (ms, same clock as startTimeMs). */
  endTimeMs: number
  /** Euclidean distance (CSS px) between touchstart and touchend points. */
  distancePx: number
}

export interface TouchGestureOptions {
  /** Minimum hold duration (inclusive) that counts as a long-press. Default 500. */
  longPressMs?: number
  /** Maximum movement (inclusive) that still counts as "same spot". Default 10. */
  tapDistancePx?: number
}

export type TouchGestureKind = 'tap' | 'long-press' | 'drag'

export function classifyTouchGesture(
  gesture: TouchGesture,
  options: TouchGestureOptions = {},
): TouchGestureKind {
  const { longPressMs = 500, tapDistancePx = 10 } = options
  const duration = gesture.endTimeMs - gesture.startTimeMs
  // Movement beyond the tap-distance tolerance is always a drag, regardless of
  // duration — a slow-but-far swipe should pan, not erase.
  if (gesture.distancePx > tapDistancePx) return 'drag'
  // Finger held in place (within tolerance) long enough → erase intent.
  if (duration >= longPressMs) return 'long-press'
  // Short hold in place → place.
  return 'tap'
}
