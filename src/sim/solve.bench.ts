// Vitest bench mode — runs via `npm run bench`, not in `test:run`.
//
// Target: mean < 50ms for a 50x50 serpentine on a developer laptop. This is
// machine-dependent, so we do NOT assert a hard threshold here — the bench is
// for regression visibility. Compare to the baseline in PR for #3.
import { bench, describe } from 'vitest'
import { solveFlow } from './solve'
import { emptyGrid, setCell } from './grid'
import { idx, type Dir, type Cell } from './types'

const beltCell = (dir: Dir, tier: Cell['tier'] = 'red'): Cell => ({
  kind: 'belt',
  dir,
  tier,
})

// 50x50 serpentine: alternating-row belts, source at (0,0), sink at (49,49).
// Even row y: belts go east (1..48), with a south-pointing belt at (49,y) to
// drop into the next row. Odd row y: belts go west (1..48), with a south at (0,y).
function buildSerpentine(size = 50) {
  let g = emptyGrid(size, size)

  g.cells[idx(g, 0, 0)] = {
    kind: 'source',
    dir: 'E',
    tier: 'red',
    feed: { iron: 15, copper: 15 },
  }

  for (let y = 0; y < size; y++) {
    const goingEast = y % 2 === 0
    if (goingEast) {
      // Belts pointing east across the row.
      for (let x = 1; x < size - 1; x++) {
        // Skip (0,0) which is the source.
        if (x === 0 && y === 0) continue
        g = setCell(g, x, y, beltCell('E'))
      }
      // Turn south at the east edge (unless last row).
      if (y < size - 1) {
        g = setCell(g, size - 1, y, beltCell('S'))
      }
    } else {
      // Odd row going west: skip (0,y) — that's the south-turn from above.
      for (let x = size - 2; x >= 1; x--) {
        g = setCell(g, x, y, beltCell('W'))
      }
      // Turn south at the west edge (unless last row).
      if (y < size - 1) {
        g = setCell(g, 0, y, beltCell('S'))
      }
    }
  }

  // Sink at (size-1, size-1). On an even row (49 is odd for size=50), so it's
  // approached from the east going west. Sink accepts from W direction means it
  // wants flow coming in from the west (its `dir: 'W'` means output side is west,
  // accepts incoming from east). Wait — sink.dir is the direction it FACES, which
  // is the direction the incoming flow is moving. Re-check: acceptsFrom returns
  // c.dir === incomingDir for sinks. The incoming flow on row 49 (odd) is moving
  // west. So sink at (49,49) needs dir='W'? That doesn't make sense for the right edge.
  // Actually: on the last row (49, odd), belts go west, so flow at (1,49) is moving
  // west, never reaches (49,49). Easier: just put the sink at (0, size-1).
  // For size=50, that's (0, 49), an odd row going west, so flow at (0,49) is
  // moving west = incomingDir 'W'. Sink wants dir='W'. Good.
  g.cells[idx(g, 0, size - 1)] = {
    kind: 'sink',
    dir: 'W',
    tier: 'red',
    require: { iron: 15, copper: 15 },
    tolerance: 0.5,
  }

  return g
}

const grid = buildSerpentine(50)

describe('solver benchmark', () => {
  bench(
    'solve 50x50 serpentine',
    () => {
      solveFlow(grid)
    },
    { time: 1000 },
  )
})
