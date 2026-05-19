import type { BeltTier, Cell, Dir } from '../sim/types'

/**
 * Build a Cell spec used purely for the ghost preview rendered under the cursor
 * before placement. Kept as a pure helper so the type contract (kind/dir/tier) is
 * documented and trivially testable.
 */
export function previewCellSpec(dir: Dir, tier: BeltTier): Cell {
  return { kind: 'belt', dir, tier }
}
