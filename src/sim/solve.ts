import {
  BELT_THROUGHPUT,
  type Cell,
  type Dir,
  type Grid,
  type ResourceId,
  idx,
  inBounds,
} from './types'

export type Flow = Record<ResourceId, number>
export type FlowGrid = (Flow | null)[]

const DV: Record<Dir, [number, number]> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  W: [-1, 0],
}

const opposite: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' }

const addFlow = (a: Flow, b: Flow): Flow => {
  const out: Flow = { ...a }
  for (const k in b) out[k] = (out[k] ?? 0) + b[k]
  return out
}

const scaleFlow = (f: Flow, s: number): Flow => {
  const out: Flow = {}
  for (const k in f) out[k] = f[k] * s
  return out
}

const sumFlow = (f: Flow) => Object.values(f).reduce((a, b) => a + b, 0)

const capFlow = (f: Flow, cap: number): Flow => {
  const s = sumFlow(f)
  return s > cap && s > 0 ? scaleFlow(f, cap / s) : f
}

// Convergence tolerance for L∞ (max-cell-resource) delta between iterations.
const EPSILON = 1e-6

export type SolveStatus = 'converged' | 'oscillating' | 'max-iter'

export interface SolveResult {
  flows: FlowGrid
  status: SolveStatus
  iters: number
}

// L∞ norm of (next - prev) across every cell/resource pair.
function maxDelta(prev: FlowGrid, next: FlowGrid): number {
  let m = 0
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i]
    const b = next[i]
    if (!a && !b) continue
    // Compare union of keys; missing key counts as 0.
    if (a) {
      for (const k in a) {
        const d = Math.abs((b?.[k] ?? 0) - a[k])
        if (d > m) m = d
      }
    }
    if (b) {
      for (const k in b) {
        if (a && k in a) continue
        const d = Math.abs(b[k] - (a?.[k] ?? 0))
        if (d > m) m = d
      }
    }
  }
  return m
}

// Compute steady-state flow at every cell via fixed-point iteration with early-exit
// convergence detection. Each iteration: for each producing cell, push its current
// outflow to the downstream neighbor it points at. Splitters (TODO) distribute their
// input across both outputs.
//
// Termination:
// - 'converged'   — L∞ delta < EPSILON for 2 consecutive iterations (steady state).
// - 'oscillating' — exhausted maxIter; last 4 deltas all > EPSILON and show a
//                   non-decaying pattern (max(last4) > 2 * min(last4)).
// - 'max-iter'    — exhausted maxIter but doesn't fit the oscillation heuristic.
export function solveFlowDetailed(g: Grid, maxIter = 200): SolveResult {
  let flows: FlowGrid = new Array(g.w * g.h).fill(null).map(() => ({}))

  // Seed sources.
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const c = g.cells[idx(g, x, y)]
      if (c?.kind === 'source' && c.feed) {
        flows[idx(g, x, y)] = { ...c.feed }
      }
    }
  }

  let smallDeltaStreak = 0
  const recentDeltas: number[] = []

  for (let iter = 0; iter < maxIter; iter++) {
    const next: FlowGrid = new Array(g.w * g.h).fill(null).map(() => ({}))

    // Sources keep emitting.
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const c = g.cells[idx(g, x, y)]
        if (c?.kind === 'source' && c.feed) {
          next[idx(g, x, y)] = { ...c.feed }
        }
      }
    }

    // Propagate.
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const c = g.cells[idx(g, x, y)]
        if (!c) continue
        const f = flows[idx(g, x, y)]
        if (!f || sumFlow(f) === 0) continue

        if (c.kind === 'belt' || c.kind === 'source' || c.kind === 'underground-out') {
          const [dx, dy] = DV[c.dir]
          const nx = x + dx
          const ny = y + dy
          if (!inBounds(g, nx, ny)) continue
          const nc = g.cells[idx(g, nx, ny)]
          if (!acceptsFrom(nc, c.dir)) continue
          const cap = c.tier ? BELT_THROUGHPUT[c.tier] : Infinity
          const out = capFlow(f, cap)
          next[idx(g, nx, ny)] = addFlow(next[idx(g, nx, ny)]!, out)
        }
        // TODO: splitter, underground-in pairing.
      }
    }

    const delta = maxDelta(flows, next)
    recentDeltas.push(delta)
    if (recentDeltas.length > 4) recentDeltas.shift()

    flows = next

    if (delta < EPSILON) {
      smallDeltaStreak++
      if (smallDeltaStreak >= 2) {
        return { flows, status: 'converged', iters: iter + 1 }
      }
    } else {
      smallDeltaStreak = 0
    }
  }

  // Exhausted maxIter — classify.
  // Oscillation heuristic: last 4 deltas all > EPSILON and non-decaying
  // (max(last4) > 2 * min(last4) with min > EPSILON).
  if (recentDeltas.length === 4) {
    const mn = Math.min(...recentDeltas)
    const mx = Math.max(...recentDeltas)
    if (mn > EPSILON && mx > 2 * mn) {
      return { flows, status: 'oscillating', iters: maxIter }
    }
  }
  return { flows, status: 'max-iter', iters: maxIter }
}

// Back-compat wrapper: returns just the FlowGrid as before.
export function solveFlow(g: Grid, maxIter = 200): FlowGrid {
  return solveFlowDetailed(g, maxIter).flows
}

function acceptsFrom(c: Cell | null | undefined, incomingDir: Dir): boolean {
  if (!c) return false
  if (c.kind === 'sink') return c.dir === incomingDir
  if (c.kind === 'belt' || c.kind === 'underground-in') {
    // Belt accepts from any side except its output side.
    return c.dir !== opposite[incomingDir]
  }
  return false
}

export interface SinkResult {
  x: number
  y: number
  ok: boolean
  actual: Flow
  required: Flow
  tolerance: number
}

export function checkSinks(g: Grid, flows: FlowGrid): SinkResult[] {
  const results: SinkResult[] = []
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const c = g.cells[idx(g, x, y)]
      if (c?.kind !== 'sink' || !c.require) continue
      const f = flows[idx(g, x, y)] ?? {}
      const tol = c.tolerance ?? 0.1
      let ok = true
      for (const k in c.require) {
        if (Math.abs((f[k] ?? 0) - c.require[k]) > tol) ok = false
      }
      results.push({ x, y, ok, actual: f, required: c.require, tolerance: tol })
    }
  }
  return results
}
