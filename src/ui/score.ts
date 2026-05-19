import type { BeltTier, Grid } from '../sim/types'

// Per-tier "cost" weight used in the win-score. Yellow is cheapest; higher tiers
// cost more because they carry more throughput. Scoring rewards using lower
// tiers when they suffice.
export const TIER_COST: Record<BeltTier, number> = {
  yellow: 1,
  red: 2,
  blue: 4,
}

export interface PuzzleScore {
  /** Number of player-placed cells (belts, splitters, undergrounds). */
  cellsUsed: number
  /** Sum of TIER_COST per player-placed cell (untiered cells count as 1). */
  tierCost: number
  /** Combined score; lower is better. */
  total: number
}

/**
 * Compute the win-score for a grid. Puzzle-fixed cells (source, sink, obstacle)
 * are not counted because the player did not place them. Empty cells obviously
 * don't count either.
 */
export function scoreGrid(g: Grid): PuzzleScore {
  let cellsUsed = 0
  let tierCost = 0
  for (const c of g.cells) {
    if (!c) continue
    if (
      c.kind === 'source' ||
      c.kind === 'sink' ||
      c.kind === 'obstacle' ||
      c.kind === 'empty'
    )
      continue
    cellsUsed += 1
    tierCost += c.tier ? TIER_COST[c.tier] : 1
  }
  return { cellsUsed, tierCost, total: cellsUsed + tierCost }
}
