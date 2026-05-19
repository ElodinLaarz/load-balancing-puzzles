import type { BeltTier, Dir, ResourceId } from '../sim/types'

export interface PuzzleSource {
  x: number
  y: number
  dir: Dir
  tier: BeltTier
  feed: Record<ResourceId, number>
}

export interface PuzzleSink {
  x: number
  y: number
  dir: Dir // belt dir entering sink
  tier: BeltTier
  require: Record<ResourceId, number>
  tolerance?: number
}

export interface PuzzleObstacle {
  x: number
  y: number
}

export interface Puzzle {
  id: string
  title: string
  description: string
  width: number
  height: number
  sources: PuzzleSource[]
  sinks: PuzzleSink[]
  obstacles?: PuzzleObstacle[]
  allowedTiers?: BeltTier[]
}
