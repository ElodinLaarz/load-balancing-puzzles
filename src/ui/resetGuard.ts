import type { CellKind, Grid } from '../sim/types'

/**
 * CellKinds the player can place on the board. Anything outside this set is
 * either an empty slot (`null` / `'empty'`) or a puzzle-fixed cell
 * (`source` / `sink` / `obstacle`) and therefore not "work" the player would
 * lose to a Reset click.
 *
 * Kept as a Set (not a switch) so the kind-membership check stays a single
 * O(1) hash lookup; the kind list is closed and grows infrequently.
 */
const PLAYER_PLACED_KINDS: ReadonlySet<CellKind> = new Set<CellKind>([
  'belt',
  'underground-in',
  'underground-out',
  'splitter-left',
  'splitter-right',
])

/**
 * Returns true iff `grid` contains at least one cell the player placed
 * (belts, undergrounds, or splitter halves).
 *
 * Used by the Reset button to decide whether to prompt for confirmation:
 * an empty board (or one populated only by sources/sinks/obstacles) should
 * reset silently, since there is nothing to lose.
 */
export function hasPlayerCells(grid: Grid): boolean {
  for (const cell of grid.cells) {
    if (cell && PLAYER_PLACED_KINDS.has(cell.kind)) return true
  }
  return false
}
