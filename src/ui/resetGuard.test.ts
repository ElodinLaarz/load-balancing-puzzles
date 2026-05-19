import { describe, expect, it } from 'vitest'
import { hasPlayerCells } from './resetGuard'
import { emptyGrid } from '../sim/grid'
import type { Cell, CellKind, Grid } from '../sim/types'
import { idx } from '../sim/types'

function gridWithCell(cell: Cell): Grid {
  const g = emptyGrid(3, 3)
  g.cells[idx(g, 1, 1)] = cell
  return g
}

describe('hasPlayerCells', () => {
  it('returns false for a freshly-allocated empty grid', () => {
    expect(hasPlayerCells(emptyGrid(4, 4))).toBe(false)
  })

  it('returns false for a 0×0 grid', () => {
    expect(hasPlayerCells(emptyGrid(0, 0))).toBe(false)
  })

  it('returns false when the grid contains only sources', () => {
    const g = gridWithCell({
      kind: 'source',
      dir: 'E',
      tier: 'yellow',
      feed: { iron: 15 },
    })
    expect(hasPlayerCells(g)).toBe(false)
  })

  it('returns false when the grid contains only sinks', () => {
    const g = gridWithCell({
      kind: 'sink',
      dir: 'E',
      tier: 'yellow',
      require: { iron: 15 },
      tolerance: 0.5,
    })
    expect(hasPlayerCells(g)).toBe(false)
  })

  it('returns false when the grid contains only obstacles', () => {
    const g = gridWithCell({ kind: 'obstacle', dir: 'E' })
    expect(hasPlayerCells(g)).toBe(false)
  })

  it('returns false for a mix of puzzle-fixed kinds (source + sink + obstacle)', () => {
    const g = emptyGrid(4, 4)
    g.cells[idx(g, 0, 0)] = { kind: 'source', dir: 'E', tier: 'yellow', feed: { iron: 15 } }
    g.cells[idx(g, 3, 0)] = {
      kind: 'sink',
      dir: 'E',
      tier: 'yellow',
      require: { iron: 15 },
      tolerance: 0.5,
    }
    g.cells[idx(g, 2, 2)] = { kind: 'obstacle', dir: 'E' }
    expect(hasPlayerCells(g)).toBe(false)
  })

  it('returns true when the grid contains a belt', () => {
    const g = gridWithCell({ kind: 'belt', dir: 'E', tier: 'yellow' })
    expect(hasPlayerCells(g)).toBe(true)
  })

  it('returns true when the grid contains an underground-in', () => {
    const g = gridWithCell({ kind: 'underground-in', dir: 'E', tier: 'yellow' })
    expect(hasPlayerCells(g)).toBe(true)
  })

  it('returns true when the grid contains an underground-out', () => {
    const g = gridWithCell({ kind: 'underground-out', dir: 'E', tier: 'yellow' })
    expect(hasPlayerCells(g)).toBe(true)
  })

  it('returns true when the grid contains a splitter-left half', () => {
    const g = gridWithCell({ kind: 'splitter-left', dir: 'E', tier: 'yellow' })
    expect(hasPlayerCells(g)).toBe(true)
  })

  it('returns true when the grid contains a splitter-right half', () => {
    const g = gridWithCell({ kind: 'splitter-right', dir: 'E', tier: 'yellow' })
    expect(hasPlayerCells(g)).toBe(true)
  })

  it('treats a cell with kind "empty" (degenerate but legal) as not-player', () => {
    // Defensive: the grid sparse representation uses null for empty, but an
    // explicit { kind: 'empty', ... } sentinel should never count as a placed cell.
    const g = gridWithCell({ kind: 'empty', dir: 'E' })
    expect(hasPlayerCells(g)).toBe(false)
  })

  it('returns true when a belt is interleaved with sources/sinks/obstacles', () => {
    const g = emptyGrid(4, 4)
    g.cells[idx(g, 0, 0)] = { kind: 'source', dir: 'E', tier: 'yellow', feed: { iron: 15 } }
    g.cells[idx(g, 1, 0)] = { kind: 'belt', dir: 'E', tier: 'yellow' }
    g.cells[idx(g, 3, 0)] = {
      kind: 'sink',
      dir: 'E',
      tier: 'yellow',
      require: { iron: 15 },
      tolerance: 0.5,
    }
    g.cells[idx(g, 2, 2)] = { kind: 'obstacle', dir: 'E' }
    expect(hasPlayerCells(g)).toBe(true)
  })

  // Compile-time exhaustiveness assertion: if a new CellKind is added,
  // either it's player-placed (this test breaks loud) or the helper must
  // explicitly include it. The runtime check below is a sanity net.
  it('explicitly classifies every known CellKind', () => {
    const allKinds: CellKind[] = [
      'empty',
      'belt',
      'underground-in',
      'underground-out',
      'splitter-left',
      'splitter-right',
      'source',
      'sink',
      'obstacle',
    ]
    const playerKinds = new Set<CellKind>([
      'belt',
      'underground-in',
      'underground-out',
      'splitter-left',
      'splitter-right',
    ])
    for (const k of allKinds) {
      const g = gridWithCell({ kind: k, dir: 'E' })
      expect(hasPlayerCells(g)).toBe(playerKinds.has(k))
    }
  })
})
