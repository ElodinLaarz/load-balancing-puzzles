import { describe, expect, it } from 'vitest'
import type { Puzzle } from '../puzzles/schema'
import { gridFromPuzzle } from '../sim/grid'
import { type Cell, idx } from '../sim/types'
import {
  type SharedSolution,
  applySharedCells,
  decodeSolution,
  derivePlayerCells,
  encodeSolution,
} from './share'

const samplePuzzle: Puzzle = {
  id: 'test-puzzle',
  title: 'Test',
  description: 'Test',
  width: 5,
  height: 3,
  sources: [{ x: 0, y: 1, dir: 'E', tier: 'yellow', feed: { iron: 15 } }],
  sinks: [{ x: 4, y: 1, dir: 'E', tier: 'yellow', require: { iron: 15 } }],
  obstacles: [{ x: 2, y: 0 }],
}

const yellowBelt = (dir: Cell['dir'] = 'E'): Cell => ({ kind: 'belt', dir, tier: 'yellow' })

describe('encodeSolution / decodeSolution', () => {
  it('round-trips puzzleId + cells exactly', () => {
    const s: SharedSolution = {
      version: 1,
      puzzleId: '01-intro',
      cells: [
        { x: 1, y: 3, cell: yellowBelt('E') },
        { x: 2, y: 3, cell: { kind: 'belt', dir: 'N', tier: 'red' } },
        { x: 5, y: 0, cell: { kind: 'belt', dir: 'W', tier: 'blue' } },
      ],
    }
    const encoded = encodeSolution(s)
    expect(typeof encoded).toBe('string')
    expect(encoded.length).toBeGreaterThan(0)
    const decoded = decodeSolution(encoded)
    expect(decoded).toEqual(s)
  })

  it('round-trips an empty cells array', () => {
    const s: SharedSolution = { version: 1, puzzleId: '02-two-to-four', cells: [] }
    expect(decodeSolution(encodeSolution(s))).toEqual(s)
  })

  it('produces URL-safe output (no +, /, or =)', () => {
    const s: SharedSolution = {
      version: 1,
      puzzleId: '01-intro',
      // Pad the payload so the base64 would normally include padding.
      cells: Array.from({ length: 7 }, (_, i) => ({ x: i, y: 0, cell: yellowBelt('E') })),
    }
    const encoded = encodeSolution(s)
    expect(encoded).not.toMatch(/[+/=]/)
  })

  it('decode("") returns null', () => {
    expect(decodeSolution('')).toBeNull()
  })

  it('decode("garbage") returns null', () => {
    expect(decodeSolution('garbage!!!not-base64')).toBeNull()
  })

  it('returns null when version is not 1', () => {
    // Encode a non-versioned payload with the same helper, then mutate version manually
    // by hand-building a base64url string.
    const payload = JSON.stringify({ version: 2, puzzleId: '01-intro', cells: [] })
    const bytes = new TextEncoder().encode(payload)
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(decodeSolution(b64)).toBeNull()
  })

  it('accepts a raw fragment with leading "#"', () => {
    const s: SharedSolution = {
      version: 1,
      puzzleId: '01-intro',
      cells: [{ x: 0, y: 0, cell: yellowBelt() }],
    }
    const encoded = encodeSolution(s)
    expect(decodeSolution('#' + encoded)).toEqual(s)
  })

  it('accepts a raw fragment without leading "#"', () => {
    const s: SharedSolution = {
      version: 1,
      puzzleId: '01-intro',
      cells: [{ x: 0, y: 0, cell: yellowBelt() }],
    }
    const encoded = encodeSolution(s)
    expect(decodeSolution(encoded)).toEqual(s)
  })

  it('accepts a full URL with hash', () => {
    const s: SharedSolution = {
      version: 1,
      puzzleId: '01-intro',
      cells: [{ x: 0, y: 0, cell: yellowBelt() }],
    }
    const encoded = encodeSolution(s)
    expect(decodeSolution(`https://example.test/app/?q=1#${encoded}`)).toEqual(s)
  })

  it('returns null when the JSON shape is wrong (missing cells)', () => {
    const payload = JSON.stringify({ version: 1, puzzleId: '01-intro' })
    const bytes = new TextEncoder().encode(payload)
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(decodeSolution(b64)).toBeNull()
  })

  it('preserves unicode in puzzleId via UTF-8 encoding', () => {
    const s: SharedSolution = {
      version: 1,
      puzzleId: 'puzzle-emoji-rocket',
      cells: [{ x: 0, y: 0, cell: yellowBelt() }],
    }
    expect(decodeSolution(encodeSolution(s))).toEqual(s)
  })
})

describe('derivePlayerCells', () => {
  it('returns nothing for a freshly-built puzzle grid', () => {
    const g = gridFromPuzzle(samplePuzzle)
    expect(derivePlayerCells(g, samplePuzzle)).toEqual([])
  })

  it('captures only the player-placed cells (skipping source/sink/obstacle slots)', () => {
    const g = gridFromPuzzle(samplePuzzle)
    // Place a belt at (1, 1) and (3, 1).
    g.cells[idx(g, 1, 1)] = yellowBelt('E')
    g.cells[idx(g, 3, 1)] = yellowBelt('E')
    const player = derivePlayerCells(g, samplePuzzle)
    expect(player).toEqual([
      { x: 1, y: 1, cell: yellowBelt('E') },
      { x: 3, y: 1, cell: yellowBelt('E') },
    ])
  })
})

describe('applySharedCells', () => {
  it('rebuilds a grid with the shared player cells applied', () => {
    const cells: SharedSolution['cells'] = [
      { x: 1, y: 1, cell: yellowBelt('E') },
      { x: 3, y: 1, cell: { kind: 'belt', dir: 'E', tier: 'red' } },
    ]
    const g = applySharedCells(samplePuzzle, cells)
    expect(g.cells[idx(g, 1, 1)]).toEqual(yellowBelt('E'))
    expect(g.cells[idx(g, 3, 1)]).toEqual({ kind: 'belt', dir: 'E', tier: 'red' })
    // Source/sink remain.
    expect(g.cells[idx(g, 0, 1)]?.kind).toBe('source')
    expect(g.cells[idx(g, 4, 1)]?.kind).toBe('sink')
  })

  it('drops cells outside the grid bounds', () => {
    const cells: SharedSolution['cells'] = [
      { x: -1, y: 0, cell: yellowBelt() },
      { x: 99, y: 0, cell: yellowBelt() },
      { x: 0, y: -1, cell: yellowBelt() },
      { x: 0, y: 99, cell: yellowBelt() },
      { x: 1, y: 1, cell: yellowBelt('E') },
    ]
    const g = applySharedCells(samplePuzzle, cells)
    expect(g.cells[idx(g, 1, 1)]).toEqual(yellowBelt('E'))
    // Only one cell was placed; the rest were dropped.
    expect(derivePlayerCells(g, samplePuzzle)).toHaveLength(1)
  })

  it('refuses to overwrite source/sink/obstacle slots', () => {
    const cells: SharedSolution['cells'] = [
      { x: 0, y: 1, cell: yellowBelt() }, // source slot
      { x: 4, y: 1, cell: yellowBelt() }, // sink slot
      { x: 2, y: 0, cell: yellowBelt() }, // obstacle slot
    ]
    const g = applySharedCells(samplePuzzle, cells)
    expect(g.cells[idx(g, 0, 1)]?.kind).toBe('source')
    expect(g.cells[idx(g, 4, 1)]?.kind).toBe('sink')
    expect(g.cells[idx(g, 2, 0)]?.kind).toBe('obstacle')
    expect(derivePlayerCells(g, samplePuzzle)).toEqual([])
  })

  it('round-trips: applySharedCells(derivePlayerCells(g)) === g (player slots)', () => {
    const g0 = gridFromPuzzle(samplePuzzle)
    g0.cells[idx(g0, 1, 1)] = yellowBelt('E')
    g0.cells[idx(g0, 3, 1)] = { kind: 'belt', dir: 'N', tier: 'blue' }
    const round = applySharedCells(samplePuzzle, derivePlayerCells(g0, samplePuzzle))
    expect(round.cells).toEqual(g0.cells)
  })

  it('does not throw on malformed entries', () => {
    const cells = [
      null as unknown as SharedSolution['cells'][number],
      { x: 1.5, y: 1, cell: yellowBelt() }, // non-integer x
      { x: 1, y: 1, cell: yellowBelt('E') },
    ]
    const g = applySharedCells(samplePuzzle, cells)
    expect(g.cells[idx(g, 1, 1)]).toEqual(yellowBelt('E'))
  })
})
