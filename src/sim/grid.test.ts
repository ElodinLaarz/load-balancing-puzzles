import { describe, expect, it } from 'vitest'
import { emptyGrid, gridFromPuzzle, setCell } from './grid'
import { idx, type Cell } from './types'
import type { Puzzle } from '../puzzles/schema'
import puzzle from '../puzzles/data/01-intro.json'
import puzzle2 from '../puzzles/data/02-two-to-four.json'

describe('emptyGrid', () => {
  it('creates a w*h grid of nulls', () => {
    const g = emptyGrid(3, 2)
    expect(g.w).toBe(3)
    expect(g.h).toBe(2)
    expect(g.cells).toHaveLength(6)
    expect(g.cells.every((c) => c === null)).toBe(true)
  })

  it('handles 1x1 grid', () => {
    const g = emptyGrid(1, 1)
    expect(g.cells).toHaveLength(1)
    expect(g.cells[0]).toBeNull()
  })
})

describe('gridFromPuzzle', () => {
  it('places source and sink at puzzle coordinates (01-intro)', () => {
    const g = gridFromPuzzle(puzzle as Puzzle)
    expect(g.w).toBe(10)
    expect(g.h).toBe(6)
    const src = g.cells[idx(g, 0, 3)]
    expect(src?.kind).toBe('source')
    expect(src?.dir).toBe('E')
    expect(src?.feed).toEqual({ iron: 15 })
    const sink = g.cells[idx(g, 9, 3)]
    expect(sink?.kind).toBe('sink')
    expect(sink?.require).toEqual({ iron: 15 })
  })

  it('places 2 sources and 4 sinks for 02-two-to-four', () => {
    const g = gridFromPuzzle(puzzle2 as unknown as Puzzle)
    expect(g.w).toBe(14)
    expect(g.h).toBe(10)

    // 2 red sources at (0,3) and (0,6)
    const src1 = g.cells[idx(g, 0, 3)]
    expect(src1?.kind).toBe('source')
    expect(src1?.dir).toBe('E')
    expect(src1?.tier).toBe('red')
    expect(src1?.feed).toEqual({ iron: 15, coal: 15 })

    const src2 = g.cells[idx(g, 0, 6)]
    expect(src2?.kind).toBe('source')
    expect(src2?.tier).toBe('red')
    expect(src2?.feed).toEqual({ 'iron-plate': 15, 'copper-plate': 15 })

    // 4 yellow sinks at (13, {2,4,6,8})
    const expectedSinkYs = [2, 4, 6, 8]
    for (const y of expectedSinkYs) {
      const sink = g.cells[idx(g, 13, y)]
      expect(sink?.kind).toBe('sink')
      expect(sink?.dir).toBe('E')
      expect(sink?.tier).toBe('yellow')
      expect(sink?.require).toEqual({
        iron: 3.75,
        coal: 3.75,
        'iron-plate': 3.75,
        'copper-plate': 3.75,
      })
      expect(sink?.tolerance).toBe(0.5)
    }
  })

  it('counts exactly 2 sources and 4 sinks in 02-two-to-four', () => {
    const g = gridFromPuzzle(puzzle2 as unknown as Puzzle)
    let sources = 0
    let sinks = 0
    for (const c of g.cells) {
      if (c?.kind === 'source') sources++
      if (c?.kind === 'sink') sinks++
    }
    expect(sources).toBe(2)
    expect(sinks).toBe(4)
  })
})

describe('setCell', () => {
  it('returns a NEW grid (immutability) — original cells array is untouched', () => {
    const g = emptyGrid(3, 3)
    const belt: Cell = { kind: 'belt', dir: 'E', tier: 'yellow' }
    const g2 = setCell(g, 1, 1, belt)
    expect(g2).not.toBe(g)
    expect(g2.cells).not.toBe(g.cells)
    // Original unchanged.
    expect(g.cells[idx(g, 1, 1)]).toBeNull()
    // New grid has the cell.
    expect(g2.cells[idx(g2, 1, 1)]).toEqual(belt)
  })

  it('preserves all other cells when setting one', () => {
    const g = emptyGrid(3, 3)
    const belt: Cell = { kind: 'belt', dir: 'E', tier: 'yellow' }
    const g2 = setCell(g, 1, 1, belt)
    expect(g2.w).toBe(g.w)
    expect(g2.h).toBe(g.h)
    expect(g2.cells.length).toBe(g.cells.length)
    for (let i = 0; i < g2.cells.length; i++) {
      if (i === idx(g, 1, 1)) continue
      expect(g2.cells[i]).toBeNull()
    }
  })

  it('can set a cell to null (erasing)', () => {
    const g = emptyGrid(2, 2)
    const belt: Cell = { kind: 'belt', dir: 'N' }
    const g2 = setCell(g, 0, 0, belt)
    const g3 = setCell(g2, 0, 0, null)
    expect(g3.cells[idx(g3, 0, 0)]).toBeNull()
    // g2 untouched.
    expect(g2.cells[idx(g2, 0, 0)]).toEqual(belt)
  })

  it('overwrites an existing cell at the same coordinate', () => {
    const g = emptyGrid(2, 2)
    const a: Cell = { kind: 'belt', dir: 'E' }
    const b: Cell = { kind: 'belt', dir: 'S' }
    const g2 = setCell(g, 1, 0, a)
    const g3 = setCell(g2, 1, 0, b)
    expect(g3.cells[idx(g3, 1, 0)]).toEqual(b)
    expect(g2.cells[idx(g2, 1, 0)]).toEqual(a)
  })
})
