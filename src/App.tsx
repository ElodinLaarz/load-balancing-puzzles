import { useEffect, useMemo, useRef, useState } from 'react'
import { PUZZLES, getPuzzle } from './puzzles'
import { gridFromPuzzle, setCell } from './sim/grid'
import { checkSinks, solveFlow, type FlowGrid, type SinkResult } from './sim/solve'
import type { BeltTier, Cell, Dir } from './sim/types'
import { idx } from './sim/types'
import { PixiBoard } from './ui/PixiBoard'
import './App.css'

const DIRS: Dir[] = ['N', 'E', 'S', 'W']

export default function App() {
  const [puzzleId, setPuzzleId] = useState(PUZZLES[0].id)
  const puzzle = getPuzzle(puzzleId)!
  const [grid, setGrid] = useState(() => gridFromPuzzle(puzzle))
  const [dir, setDir] = useState<Dir>('E')
  const [tier, setTier] = useState<BeltTier>('yellow')
  const [flows, setFlows] = useState<FlowGrid | null>(null)
  const [results, setResults] = useState<SinkResult[] | null>(null)
  const hoverRef = useRef<{ x: number; y: number } | null>(null)

  const allowedTiers = puzzle.allowedTiers ?? (['yellow', 'red', 'blue'] as BeltTier[])

  function changePuzzle(id: string) {
    const p = getPuzzle(id)!
    setPuzzleId(id)
    setGrid(gridFromPuzzle(p))
    setFlows(null)
    setResults(null)
  }

  function handlePlace(x: number, y: number, placeDir: Dir | null, button: number) {
    setGrid((g) => {
      const existing = g.cells[idx(g, x, y)]
      if (existing && (existing.kind === 'source' || existing.kind === 'sink')) return g
      if (button === 2) return setCell(g, x, y, null)
      const useDir = placeDir ?? dir
      // Preserve tier of an existing belt when re-orienting mid-drag; new placements
      // use the active tier.
      const useTier = existing?.kind === 'belt' ? (existing.tier ?? tier) : tier
      const cell: Cell = { kind: 'belt', dir: useDir, tier: useTier }
      return setCell(g, x, y, cell)
    })
    setFlows(null)
    setResults(null)
  }

  function run() {
    const f = solveFlow(grid)
    setFlows(f)
    setResults(checkSinks(grid, f))
  }

  function reset() {
    setGrid(gridFromPuzzle(puzzle))
    setFlows(null)
    setResults(null)
  }

  const solved = useMemo(() => results && results.every((r) => r.ok), [results])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'r' || e.key === 'R') {
        const step = e.shiftKey ? DIRS.length - 1 : 1
        const rotate = (d: Dir) => DIRS[(DIRS.indexOf(d) + step) % DIRS.length]
        const hover = hoverRef.current
        if (hover) {
          let rotated = false
          let newDir: Dir | null = null
          setGrid((g) => {
            const c = g.cells[idx(g, hover.x, hover.y)]
            if (!c || c.kind === 'source' || c.kind === 'sink') return g
            rotated = true
            newDir = rotate(c.dir)
            return setCell(g, hover.x, hover.y, { ...c, dir: newDir })
          })
          if (rotated) {
            if (newDir) setDir(newDir)
            setFlows(null)
            setResults(null)
          } else {
            setDir(rotate)
          }
        } else {
          setDir(rotate)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Load Balancing Puzzles</h1>

        <label className="block">
          Puzzle
          <select value={puzzleId} onChange={(e) => changePuzzle(e.target.value)}>
            {PUZZLES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <p className="desc">{puzzle.description}</p>

        <p className="hint">
          Left-click drag: paint belts. Right-click: erase. Scroll: zoom. R: rotate (Shift+R reverse).
        </p>

        <h2>Direction</h2>
        <div className="row">
          {DIRS.map((d) => (
            <button key={d} className={dir === d ? 'on' : ''} onClick={() => setDir(d)}>
              {d}
            </button>
          ))}
        </div>

        <h2>Tier</h2>
        <div className="row">
          {allowedTiers.map((t) => (
            <button key={t} className={tier === t ? 'on' : ''} onClick={() => setTier(t)}>
              {t}
            </button>
          ))}
        </div>

        <h2>Sim</h2>
        <div className="row">
          <button onClick={run}>Run</button>
          <button onClick={reset}>Reset</button>
        </div>

        {results && (
          <div className={solved ? 'verdict ok' : 'verdict bad'}>
            {solved ? 'Solved!' : 'Not yet balanced'}
          </div>
        )}

        {results?.map((r) => (
          <div key={`${r.x},${r.y}`} className="sink-detail">
            <strong>
              Sink {r.x},{r.y} {r.ok ? '✓' : '✗'}
            </strong>
            {Object.keys(r.required).map((k) => (
              <div key={k}>
                {k}: {(r.actual[k] ?? 0).toFixed(2)} / {r.required[k].toFixed(2)}
              </div>
            ))}
          </div>
        ))}

        <footer>
          <p>Splitters, undergrounds, filters: coming soon.</p>
        </footer>
      </aside>

      <main className="board-wrap">
        <PixiBoard
          grid={grid}
          flows={flows}
          sinkResults={results ?? undefined}
          placementDir={dir}
          onPlace={handlePlace}
          onHoverCell={(c) => {
            hoverRef.current = c
          }}
        />
      </main>
    </div>
  )
}
