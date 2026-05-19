import { describe, expect, it } from 'vitest'
import { emptyGrid, setCell } from '../sim/grid'
import type { Cell } from '../sim/types'
import { TIER_COST, scoreGrid } from './score'

describe('scoreGrid', () => {
  it('returns all zeros for an empty grid', () => {
    const g = emptyGrid(4, 3)
    expect(scoreGrid(g)).toEqual({ cellsUsed: 0, tierCost: 0, total: 0 })
  })

  it('ignores source and sink cells', () => {
    let g = emptyGrid(4, 3)
    const src: Cell = { kind: 'source', dir: 'E', tier: 'yellow', feed: { iron: 15 } }
    const sink: Cell = { kind: 'sink', dir: 'E', tier: 'yellow', require: { iron: 15 } }
    g = setCell(g, 0, 1, src)
    g = setCell(g, 3, 1, sink)
    expect(scoreGrid(g)).toEqual({ cellsUsed: 0, tierCost: 0, total: 0 })
  })

  it('counts three yellow belts as 3 cells / 3 cost / 6 total', () => {
    let g = emptyGrid(4, 1)
    const belt = (): Cell => ({ kind: 'belt', dir: 'E', tier: 'yellow' })
    g = setCell(g, 0, 0, belt())
    g = setCell(g, 1, 0, belt())
    g = setCell(g, 2, 0, belt())
    expect(scoreGrid(g)).toEqual({ cellsUsed: 3, tierCost: 3, total: 6 })
  })

  it('weights tiers by TIER_COST (1+2+4)', () => {
    let g = emptyGrid(3, 1)
    g = setCell(g, 0, 0, { kind: 'belt', dir: 'E', tier: 'yellow' })
    g = setCell(g, 1, 0, { kind: 'belt', dir: 'E', tier: 'red' })
    g = setCell(g, 2, 0, { kind: 'belt', dir: 'E', tier: 'blue' })
    expect(scoreGrid(g)).toEqual({ cellsUsed: 3, tierCost: 7, total: 10 })
  })

  it('exposes a TIER_COST table with yellow=1, red=2, blue=4', () => {
    expect(TIER_COST).toEqual({ yellow: 1, red: 2, blue: 4 })
  })

  it('ignores obstacle cells (puzzle-fixed, not player-placed)', () => {
    let g = emptyGrid(3, 1)
    const belt: Cell = { kind: 'belt', dir: 'E', tier: 'yellow' }
    const obstacle: Cell = { kind: 'obstacle', dir: 'E' }
    g = setCell(g, 0, 0, belt)
    g = setCell(g, 1, 0, obstacle)
    expect(scoreGrid(g)).toEqual({ cellsUsed: 1, tierCost: 1, total: 2 })
  })
})
