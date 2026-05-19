import { describe, expect, it } from 'vitest'
import { checkSinks, solveFlow } from '../sim/solve'
import { gridFromPuzzle, setCell } from '../sim/grid'
import type { Cell, Dir, Grid } from '../sim/types'
import type { Puzzle } from './schema'
import puzzle04 from './data/04-twin-lanes.json'
import puzzle05 from './data/05-tight-footprint.json'
import puzzle06 from './data/06-throughput-stretch.json'
import { PUZZLES } from './index'

// Helpers --------------------------------------------------------------------

const belt = (dir: Dir, tier: Cell['tier'] = 'yellow'): Cell => ({
  kind: 'belt',
  dir,
  tier,
})

// Place a sequence of belts along a path. Each entry: [x, y, dir].
function layPath(g: Grid, path: Array<[number, number, Dir]>, tier: Cell['tier'] = 'yellow'): Grid {
  let out = g
  for (const [x, y, d] of path) {
    out = setCell(out, x, y, belt(d, tier))
  }
  return out
}

// 04 — Twin Lanes ------------------------------------------------------------
// Two sources, two sinks, parallel non-crossing lanes.
// Lane A: source (0,1) E iron:15 → sink (7,1) E iron:15 via row y=1
// Lane B: source (0,4) E coal:15 → sink (7,4) E coal:15 via row y=4

describe('04-twin-lanes', () => {
  it('parallel non-crossing lanes deliver each resource to its own sink', () => {
    let g = gridFromPuzzle(puzzle04 as unknown as Puzzle)
    // Lane A: belts (1..6, 1) all eastbound.
    for (let x = 1; x <= 6; x++) g = setCell(g, x, 1, belt('E'))
    // Lane B: belts (1..6, 4) all eastbound.
    for (let x = 1; x <= 6; x++) g = setCell(g, x, 4, belt('E'))
    const flows = solveFlow(g)
    const results = checkSinks(g, flows)
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.ok)).toBe(true)
  })
})

// 05 — Tight Footprint -------------------------------------------------------
// 5×5 grid; obstacle column (2,1..3) forces a serpentine over-the-top path.
// Source (0,2) E iron:15 → sink (4,2) E iron:15.

describe('05-tight-footprint', () => {
  it('serpentine over-the-top path satisfies the sink', () => {
    let g = gridFromPuzzle(puzzle05 as unknown as Puzzle)
    g = layPath(g, [
      [1, 2, 'N'],
      [1, 1, 'N'],
      [1, 0, 'E'],
      [2, 0, 'E'],
      [3, 0, 'S'],
      [3, 1, 'S'],
      [3, 2, 'E'],
    ])
    const flows = solveFlow(g)
    const results = checkSinks(g, flows)
    expect(results).toHaveLength(1)
    expect(results[0].ok).toBe(true)
  })
})

// 06 — Throughput Stretch ----------------------------------------------------
// 8×4 grid; demand exactly matches yellow source rate. One obstacle nudges
// the path one row down. Player can pick yellow (sufficient) or red (wasteful).
// Source (0,1) E tier:yellow iron:15 → sink (7,2) E tier:yellow iron:15.

describe('06-throughput-stretch', () => {
  it('yellow belts saturate the demand exactly', () => {
    let g = gridFromPuzzle(puzzle06 as unknown as Puzzle)
    g = layPath(g, [
      [1, 1, 'E'],
      [2, 1, 'E'],
      [3, 1, 'S'],
      [3, 2, 'E'],
      [4, 2, 'E'],
      [5, 2, 'E'],
      [6, 2, 'E'],
    ])
    const flows = solveFlow(g)
    const results = checkSinks(g, flows)
    expect(results).toHaveLength(1)
    expect(results[0].ok).toBe(true)
    expect(results[0].actual.iron).toBeCloseTo(15, 5)
  })
})

// Registration ---------------------------------------------------------------

describe('PUZZLES registry includes 04-06', () => {
  it('exposes puzzle 04 by id', () => {
    expect(PUZZLES.find((p) => p.id === '04-twin-lanes')).toBeDefined()
  })
  it('exposes puzzle 05 by id', () => {
    expect(PUZZLES.find((p) => p.id === '05-tight-footprint')).toBeDefined()
  })
  it('exposes puzzle 06 by id', () => {
    expect(PUZZLES.find((p) => p.id === '06-throughput-stretch')).toBeDefined()
  })
})
