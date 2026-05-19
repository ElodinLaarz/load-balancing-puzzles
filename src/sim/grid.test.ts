import { describe, expect, it } from 'vitest'
import { emptyGrid, gridFromPuzzle } from './grid'
import { idx } from './types'
import type { Puzzle } from '../puzzles/schema'
import puzzle from '../puzzles/data/01-intro.json'

describe('emptyGrid', () => {
  it('creates a w*h grid of nulls', () => {
    const g = emptyGrid(3, 2)
    expect(g.w).toBe(3)
    expect(g.h).toBe(2)
    expect(g.cells).toHaveLength(6)
    expect(g.cells.every((c) => c === null)).toBe(true)
  })
})

describe('gridFromPuzzle', () => {
  it('places source and sink at puzzle coordinates', () => {
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
})
