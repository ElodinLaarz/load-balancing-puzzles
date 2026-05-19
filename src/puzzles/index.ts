import type { Puzzle } from './schema'
import intro from './data/01-intro.json'
import twoToFour from './data/02-two-to-four.json'
import obstacle from './data/03-obstacle-bypass.json'
import twinLanes from './data/04-twin-lanes.json'
import tightFootprint from './data/05-tight-footprint.json'
import throughputStretch from './data/06-throughput-stretch.json'

// JSON puzzles. Code-defined puzzles can be added by exporting Puzzle objects here too.
export const PUZZLES: Puzzle[] = [
  intro as unknown as Puzzle,
  twoToFour as unknown as Puzzle,
  obstacle as unknown as Puzzle,
  twinLanes as unknown as Puzzle,
  tightFootprint as unknown as Puzzle,
  throughputStretch as unknown as Puzzle,
]

export const getPuzzle = (id: string) => PUZZLES.find((p) => p.id === id)
