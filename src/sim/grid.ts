import type { Puzzle } from '../puzzles/schema'
import { type Cell, type Grid, idx } from './types'

export function emptyGrid(w: number, h: number): Grid {
  return { w, h, cells: new Array(w * h).fill(null) }
}

export function gridFromPuzzle(p: Puzzle): Grid {
  const g = emptyGrid(p.width, p.height)
  for (const s of p.sources) {
    g.cells[idx(g, s.x, s.y)] = {
      kind: 'source',
      dir: s.dir,
      tier: s.tier,
      feed: s.feed,
    }
  }
  for (const k of p.sinks) {
    g.cells[idx(g, k.x, k.y)] = {
      kind: 'sink',
      dir: k.dir,
      tier: k.tier,
      require: k.require,
      tolerance: k.tolerance,
    }
  }
  // Obstacles are puzzle-fixed walls. `dir` is unused for them; we set 'E'
  // only to satisfy the required Cell field.
  for (const o of p.obstacles ?? []) {
    g.cells[idx(g, o.x, o.y)] = { kind: 'obstacle', dir: 'E' }
  }
  return g
}

export function setCell(g: Grid, x: number, y: number, c: Cell | null): Grid {
  const cells = g.cells.slice()
  cells[idx(g, x, y)] = c
  return { ...g, cells }
}
