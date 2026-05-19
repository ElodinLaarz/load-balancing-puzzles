import type { Puzzle } from './schema'
import intro from './data/01-intro.json'
import twoToFour from './data/02-two-to-four.json'

// JSON puzzles. Code-defined puzzles can be added by exporting Puzzle objects here too.
export const PUZZLES: Puzzle[] = [intro as unknown as Puzzle, twoToFour as unknown as Puzzle]

export const getPuzzle = (id: string) => PUZZLES.find((p) => p.id === id)
