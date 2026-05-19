import { describe, expect, it } from 'vitest'
import { checkSinks, solveFlow, solveFlowDetailed, type FlowGrid } from './solve'
import { emptyGrid, gridFromPuzzle, setCell } from './grid'
import { idx, type Cell, type Grid, type Dir } from './types'
import type { Puzzle } from '../puzzles/schema'
import puzzle from '../puzzles/data/01-intro.json'

// Helpers --------------------------------------------------------------------

const beltCell = (dir: Dir, tier: Cell['tier'] = 'yellow'): Cell => ({
  kind: 'belt',
  dir,
  tier,
})

// Lay belts at (x0..x1, y) all pointing east. Inclusive on both ends.
function layEastRow(g: Grid, x0: number, x1: number, y: number, tier: Cell['tier'] = 'yellow'): Grid {
  let out = g
  for (let x = x0; x <= x1; x++) {
    out = setCell(out, x, y, beltCell('E', tier))
  }
  return out
}

// 01-intro: source at (0,3) E iron:15, sink at (9,3) E iron:15 tol 0.5.
describe('solveFlow on 01-intro', () => {
  it('full belt run delivers iron:15 to the sink', () => {
    let g = gridFromPuzzle(puzzle as Puzzle)
    g = layEastRow(g, 1, 8, 3)
    const flows = solveFlow(g)
    const results = checkSinks(g, flows)
    expect(results).toHaveLength(1)
    expect(results[0].ok).toBe(true)
    expect(results[0].actual.iron).toBeCloseTo(15, 5)
  })

  it('gap before sink — sink receives 0 → not ok', () => {
    let g = gridFromPuzzle(puzzle as Puzzle)
    // belts (1..7, 3) east; (8,3) intentionally missing.
    g = layEastRow(g, 1, 7, 3)
    const flows = solveFlow(g)
    const results = checkSinks(g, flows)
    expect(results).toHaveLength(1)
    expect(results[0].ok).toBe(false)
    expect(results[0].actual.iron ?? 0).toBe(0)
  })

  it('last belt facing wrong direction blocks flow — sink not ok', () => {
    let g = gridFromPuzzle(puzzle as Puzzle)
    g = layEastRow(g, 1, 7, 3)
    // (8,3) faces W — does NOT accept eastbound flow from (7,3) (W is its output side).
    g = setCell(g, 8, 3, beltCell('W'))
    const flows = solveFlow(g)
    const results = checkSinks(g, flows)
    expect(results[0].ok).toBe(false)
    expect(results[0].actual.iron ?? 0).toBe(0)
  })

  it('flows are finite and non-negative everywhere on a normal solve', () => {
    let g = gridFromPuzzle(puzzle as Puzzle)
    g = layEastRow(g, 1, 8, 3)
    const flows = solveFlow(g)
    for (const f of flows) {
      if (!f) continue
      for (const k in f) {
        expect(Number.isFinite(f[k])).toBe(true)
        expect(f[k]).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('solveFlow termination & convergence', () => {
  it('terminates with finite values on a 2-belt configuration with no source/sink', () => {
    // Belts pointing into empty cells — no propagation path, but solver must
    // still complete maxIter without throwing or producing non-finite values.
    let g = emptyGrid(5, 5)
    g = setCell(g, 1, 3, beltCell('E'))
    g = setCell(g, 1, 4, beltCell('W'))
    const flows = solveFlow(g, 50)
    expect(flows).toHaveLength(g.w * g.h)
    for (const f of flows) {
      if (!f) continue
      for (const k in f) {
        expect(Number.isFinite(f[k])).toBe(true)
        expect(f[k]).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('terminates on a small cyclic loop (no source) — no infinite loop, finite flows', () => {
    // 4-belt loop: (1,3)E -> (2,3)S -> (2,4)W -> (1,4)N -> back to (1,3).
    let g = emptyGrid(5, 6)
    g = setCell(g, 1, 3, beltCell('E'))
    g = setCell(g, 2, 3, beltCell('S'))
    g = setCell(g, 2, 4, beltCell('W'))
    g = setCell(g, 1, 4, beltCell('N'))
    const flows = solveFlow(g, 50)
    for (const f of flows) {
      if (!f) continue
      for (const k in f) {
        expect(Number.isFinite(f[k])).toBe(true)
      }
    }
  })

  it('multi-source/sink: 02 puzzle solves without throwing & yields finite flows', () => {
    // Just exercise the solver on the larger puzzle; we don't assert "balanced"
    // (that's a real puzzle to solve). We do check no throw + all finite.
    const g: Grid = {
      w: 14,
      h: 10,
      cells: new Array(14 * 10).fill(null),
    }
    // Source at (0,3) red iron+coal, sink at (13,2) yellow.
    g.cells[idx(g, 0, 3)] = {
      kind: 'source',
      dir: 'E',
      tier: 'red',
      feed: { iron: 15, coal: 15 },
    }
    g.cells[idx(g, 13, 2)] = {
      kind: 'sink',
      dir: 'E',
      tier: 'yellow',
      require: { iron: 7.5 },
      tolerance: 0.5,
    }
    const flows = solveFlow(g)
    expect(flows).toHaveLength(g.w * g.h)
    for (const f of flows) {
      if (!f) continue
      for (const k in f) {
        expect(Number.isFinite(f[k])).toBe(true)
      }
    }
  })
})

describe('checkSinks', () => {
  const sinkGrid = (require: Record<string, number>, tolerance?: number): Grid => {
    const g = emptyGrid(2, 1)
    g.cells[idx(g, 0, 0)] = {
      kind: 'sink',
      dir: 'E',
      require,
      tolerance,
    }
    return g
  }

  it('returns one result per sink in the grid', () => {
    const g = emptyGrid(3, 1)
    g.cells[idx(g, 0, 0)] = { kind: 'sink', dir: 'E', require: { iron: 1 } }
    g.cells[idx(g, 2, 0)] = { kind: 'sink', dir: 'E', require: { iron: 1 } }
    const flows: FlowGrid = new Array(g.w * g.h).fill(null).map(() => ({}))
    const results = checkSinks(g, flows)
    expect(results).toHaveLength(2)
  })

  it('skips sinks with no require field', () => {
    const g = emptyGrid(1, 1)
    g.cells[idx(g, 0, 0)] = { kind: 'sink', dir: 'E' }
    const flows: FlowGrid = [{}]
    expect(checkSinks(g, flows)).toHaveLength(0)
  })

  it('ok=true when actual is within tolerance', () => {
    const g = sinkGrid({ iron: 15 }, 0.5)
    const flows: FlowGrid = new Array(g.w * g.h).fill(null).map(() => ({}))
    flows[idx(g, 0, 0)] = { iron: 14.6 }
    const results = checkSinks(g, flows)
    expect(results[0].ok).toBe(true)
    expect(results[0].actual.iron).toBe(14.6)
    expect(results[0].tolerance).toBe(0.5)
  })

  it('ok=false when actual is outside tolerance', () => {
    const g = sinkGrid({ iron: 15 }, 0.5)
    const flows: FlowGrid = new Array(g.w * g.h).fill(null).map(() => ({}))
    flows[idx(g, 0, 0)] = { iron: 14.4 }
    const results = checkSinks(g, flows)
    expect(results[0].ok).toBe(false)
  })

  it('ok=false when actual is over by more than tolerance', () => {
    const g = sinkGrid({ iron: 15 }, 0.5)
    const flows: FlowGrid = new Array(g.w * g.h).fill(null).map(() => ({}))
    flows[idx(g, 0, 0)] = { iron: 15.6 }
    expect(checkSinks(g, flows)[0].ok).toBe(false)
  })

  it('defaults tolerance to 0.1 when sink omits it', () => {
    const g = sinkGrid({ iron: 15 })
    const flows: FlowGrid = new Array(g.w * g.h).fill(null).map(() => ({}))
    flows[idx(g, 0, 0)] = { iron: 14.95 }
    const results = checkSinks(g, flows)
    expect(results[0].tolerance).toBe(0.1)
    expect(results[0].ok).toBe(true)

    flows[idx(g, 0, 0)] = { iron: 14.8 }
    const r2 = checkSinks(g, flows)
    expect(r2[0].ok).toBe(false)
  })

  it('treats missing resource in actual as 0', () => {
    const g = sinkGrid({ iron: 1 }, 0.1)
    const flows: FlowGrid = new Array(g.w * g.h).fill(null).map(() => ({}))
    flows[idx(g, 0, 0)] = {} // no iron in actual
    expect(checkSinks(g, flows)[0].ok).toBe(false)
  })

  it('all required resources must be within tolerance — fails if any one is off', () => {
    const g = sinkGrid({ iron: 10, coal: 10 }, 0.5)
    const flows: FlowGrid = new Array(g.w * g.h).fill(null).map(() => ({}))
    flows[idx(g, 0, 0)] = { iron: 10, coal: 8 }
    expect(checkSinks(g, flows)[0].ok).toBe(false)
  })
})

describe('throughput cap', () => {
  it('caps belt output at the tier throughput', () => {
    // Source emits 30 iron, but yellow tier cap=15. Sink requires 15.
    const g = emptyGrid(3, 1)
    g.cells[idx(g, 0, 0)] = {
      kind: 'source',
      dir: 'E',
      tier: 'yellow',
      feed: { iron: 30 },
    }
    g.cells[idx(g, 1, 0)] = beltCell('E', 'yellow')
    g.cells[idx(g, 2, 0)] = {
      kind: 'sink',
      dir: 'E',
      tier: 'yellow',
      require: { iron: 15 },
      tolerance: 0.1,
    }
    const flows = solveFlow(g)
    const results = checkSinks(g, flows)
    expect(results).toHaveLength(1)
    expect(results[0].actual.iron).toBeCloseTo(15, 5)
    expect(results[0].ok).toBe(true)
  })

  it('red belt (cap=30) passes 30 iron unchanged', () => {
    const g = emptyGrid(3, 1)
    g.cells[idx(g, 0, 0)] = {
      kind: 'source',
      dir: 'E',
      tier: 'red',
      feed: { iron: 30 },
    }
    g.cells[idx(g, 1, 0)] = beltCell('E', 'red')
    g.cells[idx(g, 2, 0)] = {
      kind: 'sink',
      dir: 'E',
      tier: 'red',
      require: { iron: 30 },
      tolerance: 0.1,
    }
    const flows = solveFlow(g)
    const results = checkSinks(g, flows)
    expect(results[0].ok).toBe(true)
    expect(results[0].actual.iron).toBeCloseTo(30, 5)
  })
})

describe('solveFlowDetailed convergence detection', () => {
  it('simple belt chain converges in <20 iters', () => {
    // Source -> 8 belts -> sink, all eastbound.
    let g = gridFromPuzzle(puzzle as Puzzle)
    g = layEastRow(g, 1, 8, 3)
    const result = solveFlowDetailed(g)
    expect(result.status).toBe('converged')
    expect(result.iters).toBeLessThan(20)
    // Flows must still be correct.
    const sinkResults = checkSinks(g, result.flows)
    expect(sinkResults[0].ok).toBe(true)
  })

  it('linear belt preserves per-resource composition (single belt cell)', () => {
    // Source { iron: 5, copper: 5 } → 1-cell belt → sink reads { iron: 5, copper: 5 }.
    const g = emptyGrid(3, 1)
    g.cells[idx(g, 0, 0)] = {
      kind: 'source',
      dir: 'E',
      tier: 'red',
      feed: { iron: 5, copper: 5 },
    }
    g.cells[idx(g, 1, 0)] = beltCell('E', 'red')
    g.cells[idx(g, 2, 0)] = {
      kind: 'sink',
      dir: 'E',
      tier: 'red',
      require: { iron: 5, copper: 5 },
      tolerance: 0.01,
    }
    const result = solveFlowDetailed(g)
    expect(result.status).toBe('converged')
    const sinkFlow = result.flows[idx(g, 2, 0)]
    expect(sinkFlow).not.toBeNull()
    expect(sinkFlow!.iron).toBeCloseTo(5, 5)
    expect(sinkFlow!.copper).toBeCloseTo(5, 5)
  })

  it('composition preserved through varied-tier chain (yellow→red→blue ratio preserved)', () => {
    // Mixed-tier chain: source pushes 6 iron + 9 copper (15 total, fits yellow cap).
    // Tiers go yellow → red → blue. Composition ratio iron:copper = 2:3 must hold
    // end-to-end. Total rate is capped by the lowest tier (yellow=15) at most.
    const g = emptyGrid(6, 1)
    g.cells[idx(g, 0, 0)] = {
      kind: 'source',
      dir: 'E',
      tier: 'blue',
      feed: { iron: 6, copper: 9 },
    }
    g.cells[idx(g, 1, 0)] = beltCell('E', 'yellow')
    g.cells[idx(g, 2, 0)] = beltCell('E', 'red')
    g.cells[idx(g, 3, 0)] = beltCell('E', 'blue')
    g.cells[idx(g, 4, 0)] = beltCell('E', 'yellow')
    g.cells[idx(g, 5, 0)] = {
      kind: 'sink',
      dir: 'E',
      tier: 'blue',
      require: { iron: 6, copper: 9 },
      tolerance: 0.01,
    }
    const result = solveFlowDetailed(g)
    expect(result.status).toBe('converged')
    const sinkFlow = result.flows[idx(g, 5, 0)]
    expect(sinkFlow).not.toBeNull()
    const iron = sinkFlow!.iron ?? 0
    const copper = sinkFlow!.copper ?? 0
    // Ratio iron / copper must equal 6 / 9 = 2/3 (composition preserved).
    expect(iron / copper).toBeCloseTo(6 / 9, 5)
    // Total fits within yellow cap (15), so full source flows through.
    expect(iron + copper).toBeCloseTo(15, 5)
  })

  it('zero-flow cycle (no source feeding) does not crash and is converged', () => {
    // 4-belt loop: (1,3)E -> (2,3)S -> (2,4)W -> (1,4)N -> back to (1,3).
    let g = emptyGrid(5, 6)
    g = setCell(g, 1, 3, beltCell('E'))
    g = setCell(g, 2, 3, beltCell('S'))
    g = setCell(g, 2, 4, beltCell('W'))
    g = setCell(g, 1, 4, beltCell('N'))
    const result = solveFlowDetailed(g)
    expect(result.status).toBe('converged')
    // Trivially stable: all flows zero.
    for (const f of result.flows) {
      if (!f) continue
      for (const k in f) expect(f[k]).toBe(0)
    }
  })

  it('source-fed cycle does not crash (oscillating or max-iter both acceptable)', () => {
    // Same 4-belt loop, but with a source feeding into (1,3) from the west.
    let g = emptyGrid(5, 6)
    g.cells[idx(g, 0, 3)] = {
      kind: 'source',
      dir: 'E',
      tier: 'yellow',
      feed: { iron: 10 },
    }
    g = setCell(g, 1, 3, beltCell('E'))
    g = setCell(g, 2, 3, beltCell('S'))
    g = setCell(g, 2, 4, beltCell('W'))
    g = setCell(g, 1, 4, beltCell('N'))
    // Must not throw; either oscillating, max-iter, or even converged is OK.
    const result = solveFlowDetailed(g)
    expect(['converged', 'oscillating', 'max-iter']).toContain(result.status)
    // All flows must remain finite & non-negative.
    for (const f of result.flows) {
      if (!f) continue
      for (const k in f) {
        expect(Number.isFinite(f[k])).toBe(true)
        expect(f[k]).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('solveFlow back-compat returns FlowGrid (legacy signature still works)', () => {
    let g = gridFromPuzzle(puzzle as Puzzle)
    g = layEastRow(g, 1, 8, 3)
    const flows = solveFlow(g)
    // FlowGrid is (Flow | null)[] — must be an array of length w*h.
    expect(Array.isArray(flows)).toBe(true)
    expect(flows).toHaveLength(g.w * g.h)
    // And contain the same data as solveFlowDetailed(g).flows.
    const detailed = solveFlowDetailed(g)
    expect(flows).toEqual(detailed.flows)
  })
})
