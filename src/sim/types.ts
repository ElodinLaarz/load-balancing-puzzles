// Core domain types for belt sim.
// Hybrid model: discrete items animate visually, but win-check uses steady-state rates.

export type ResourceId = string // e.g. "iron", "copper", "coal"

export type BeltTier = 'yellow' | 'red' | 'blue'

export const BELT_THROUGHPUT: Record<BeltTier, number> = {
  yellow: 15,
  red: 30,
  blue: 45,
}

export type Dir = 'N' | 'E' | 'S' | 'W'

export type CellKind =
  | 'empty'
  | 'belt'
  | 'underground-in'
  | 'underground-out'
  | 'splitter-left' // splitters occupy 2 cells; this is the left half (relative to output dir)
  | 'splitter-right'
  | 'source' // puzzle-fixed input
  | 'sink' // puzzle-fixed output
  | 'obstacle' // puzzle-fixed non-buildable terrain; blocks placement and flow

export interface Cell {
  kind: CellKind
  dir: Dir
  tier?: BeltTier
  // Splitter optional filter: forces this resource to this side (if present on input).
  filter?: ResourceId
  // For source: composition of feed (must sum to <= tier throughput).
  feed?: Record<ResourceId, number>
  // For sink: required composition (rates per resource).
  require?: Record<ResourceId, number>
  // For sink: tolerance for accepting "balanced".
  tolerance?: number
}

export interface Grid {
  w: number
  h: number
  cells: (Cell | null)[] // length w*h, row-major
}

export const idx = (g: Grid, x: number, y: number) => y * g.w + x
export const inBounds = (g: Grid, x: number, y: number) =>
  x >= 0 && y >= 0 && x < g.w && y < g.h
