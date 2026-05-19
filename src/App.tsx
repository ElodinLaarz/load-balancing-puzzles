import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { PUZZLES, getPuzzle } from './puzzles'
import { gridFromPuzzle, setCell } from './sim/grid'
import { checkSinks, solveFlow, type FlowGrid, type SinkResult } from './sim/solve'
import type { BeltTier, Cell, Dir, Grid } from './sim/types'
import { idx } from './sim/types'
import { debounce } from './ui/debounce'
import { tierForKey } from './ui/hotkeys'
import { initHistory, push as pushHistory, redo, undo } from './ui/history'
import { nextPuzzleId } from './ui/nextPuzzle'
import {
  applySharedCells,
  decodeSolution,
  derivePlayerCells,
  encodeSolution,
} from './ui/share'
import { WinModal } from './ui/WinModal'
import { getBest, saveIfBest, type BestScoreRecord } from './ui/highScores'
import { scoreGrid } from './ui/score'
import './App.css'

/** Delay (ms) between the last grid edit and an auto-run of the simulator. */
const AUTO_RUN_DEBOUNCE_MS = 250

type SimStatus = 'idle' | 'pending' | 'ok' | 'fail'

/** Pull (puzzleId, grid) from the current URL hash, falling back to the first
 * puzzle if the hash is absent, malformed, or names an unknown puzzle. */
function initialStateFromHash(): { puzzleId: string; grid: Grid } {
  const fallback = () => {
    const p = PUZZLES[0]
    return { puzzleId: p.id, grid: gridFromPuzzle(p) }
  }
  if (typeof window === 'undefined') return fallback()
  try {
    const decoded = decodeSolution(window.location.hash)
    if (!decoded) return fallback()
    const puzzle = getPuzzle(decoded.puzzleId)
    if (!puzzle) return fallback()
    return { puzzleId: puzzle.id, grid: applySharedCells(puzzle, decoded.cells) }
  } catch {
    return fallback()
  }
}

const PixiBoard = lazy(() => import('./ui/PixiBoard'))

const DIRS: Dir[] = ['N', 'E', 'S', 'W']
const PUZZLE_IDS: readonly string[] = PUZZLES.map((p) => p.id)

export default function App() {
  const initial = useMemo(() => initialStateFromHash(), [])
  const [puzzleId, setPuzzleId] = useState(initial.puzzleId)
  const puzzle = getPuzzle(puzzleId)!
  const [history, setHistory] = useState(() => initHistory(initial.grid))
  const grid = history.present
  const [dir, setDir] = useState<Dir>('E')
  const [tier, setTier] = useState<BeltTier>('yellow')
  const [flows, setFlows] = useState<FlowGrid | null>(null)
  const [results, setResults] = useState<SinkResult[] | null>(null)
  const [simStatus, setSimStatus] = useState<SimStatus>('idle')
  const [modalOpen, setModalOpen] = useState(false)
  const [previousBest, setPreviousBest] = useState<BestScoreRecord | null>(null)
  const [isNewBest, setIsNewBest] = useState(false)
  const hoverRef = useRef<{ x: number; y: number } | null>(null)
  // Tracks whether the previous auto-run reported a solved grid. The win modal
  // should only open on the false→true edge, not on every re-render of an
  // already-solved board (e.g. if the user closes it).
  const wasSolvedLastTickRef = useRef(false)

  const allowedTiers = puzzle.allowedTiers ?? (['yellow', 'red', 'blue'] as BeltTier[])

  function applyGrid(fn: (g: Grid) => Grid) {
    setHistory((h) => {
      const next = fn(h.present)
      if (next === h.present) return h
      // A real edit landed: mark the sim as awaiting a debounced re-run so the
      // status indicator reflects the in-flight state immediately.
      setSimStatus('pending')
      return pushHistory(h, next)
    })
  }

  function changePuzzle(id: string) {
    const p = getPuzzle(id)!
    setPuzzleId(id)
    setHistory(initHistory(gridFromPuzzle(p)))
    setFlows(null)
    setResults(null)
    setSimStatus('idle')
    setModalOpen(false)
    setPreviousBest(null)
    setIsNewBest(false)
    wasSolvedLastTickRef.current = false
  }

  function handlePlace(x: number, y: number, placeDir: Dir | null, button: number) {
    applyGrid((g) => {
      const existing = g.cells[idx(g, x, y)]
      if (
        existing &&
        (existing.kind === 'source' || existing.kind === 'sink' || existing.kind === 'obstacle')
      )
        return g
      if (button === 2) return setCell(g, x, y, null)
      const useDir = placeDir ?? dir
      // Preserve tier of an existing belt when re-orienting mid-drag; new placements
      // use the active tier.
      const useTier = existing?.kind === 'belt' ? (existing.tier ?? tier) : tier
      const cell: Cell = { kind: 'belt', dir: useDir, tier: useTier }
      return setCell(g, x, y, cell)
    })
  }

  // Run the sim against a specific grid snapshot, push results to state, and
  // open the win modal on a non-solved → solved transition. Returns the new
  // status so callers can verify the run without re-reading React state.
  function runSimFor(g: Grid): SimStatus {
    const f = solveFlow(g)
    const r = checkSinks(g, f)
    const solved = r.every((s) => s.ok)
    setFlows(f)
    setResults(r)
    const status: SimStatus = solved ? 'ok' : 'fail'
    setSimStatus(status)
    if (solved && !wasSolvedLastTickRef.current) {
      // Capture the previous best BEFORE saving, so the modal can show what
      // the player just beat (if anything).
      const prev = getBest(puzzleId)
      const score = scoreGrid(g)
      saveIfBest(puzzleId, score)
      setPreviousBest(prev)
      setIsNewBest(!prev || score.total < prev.total)
      setModalOpen(true)
    }
    wasSolvedLastTickRef.current = solved
    return status
  }

  function reset() {
    setHistory(initHistory(gridFromPuzzle(puzzle)))
    setFlows(null)
    setResults(null)
    setSimStatus('idle')
    setModalOpen(false)
    setPreviousBest(null)
    setIsNewBest(false)
    wasSolvedLastTickRef.current = false
  }

  const solved = useMemo(() => results && results.every((r) => r.ok), [results])
  const nextId = useMemo(() => nextPuzzleId(puzzleId, PUZZLE_IDS), [puzzleId])

  // Auto-run the sim after every grid edit (debounced). Cleanup cancels any
  // pending invocation so a rapid sequence of edits coalesces into a single
  // run against the latest grid snapshot. Note: the 'pending' status itself
  // is set synchronously inside `applyGrid` / undo / redo handlers — this
  // effect only owns the eventual ok/fail transition.
  useEffect(() => {
    const d = debounce((g: Grid) => {
      runSimFor(g)
    }, AUTO_RUN_DEBOUNCE_MS)
    d.call(grid)
    return () => d.cancel()
  }, [grid])

  // Manual run: fire immediately, bypassing the debounce window.
  function run() {
    runSimFor(grid)
  }

  // Keep the URL hash in sync with the current solution so the page is
  // shareable as-is. Uses replaceState to avoid creating a history entry per
  // placement and to avoid scrolling.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const encoded = encodeSolution({
        version: 1,
        puzzleId,
        cells: derivePlayerCells(grid, puzzle),
      })
      const next = '#' + encoded
      if (window.location.hash !== next) {
        window.history.replaceState({}, '', next)
      }
    } catch {
      // URL updates are best-effort; never break the app on history failures.
    }
  }, [grid, puzzle, puzzleId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        setHistory((h) => {
          const next = undo(h)
          if (next !== h) setSimStatus('pending')
          return next
        })
        return
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        ((e.shiftKey && (e.key === 'z' || e.key === 'Z')) || e.key === 'y' || e.key === 'Y')
      ) {
        e.preventDefault()
        setHistory((h) => {
          const next = redo(h)
          if (next !== h) setSimStatus('pending')
          return next
        })
        return
      }
      const nextTier = tierForKey(e.key, allowedTiers)
      if (nextTier) {
        setTier(nextTier)
        return
      }
      if (e.key === 'r' || e.key === 'R') {
        const step = e.shiftKey ? DIRS.length - 1 : 1
        const rotate = (d: Dir) => DIRS[(DIRS.indexOf(d) + step) % DIRS.length]
        const hover = hoverRef.current
        if (hover) {
          let rotated = false
          let newDir: Dir | null = null
          applyGrid((g) => {
            const c = g.cells[idx(g, hover.x, hover.y)]
            if (!c || c.kind === 'source' || c.kind === 'sink' || c.kind === 'obstacle') return g
            rotated = true
            newDir = rotate(c.dir)
            return setCell(g, hover.x, hover.y, { ...c, dir: newDir })
          })
          if (rotated) {
            if (newDir) setDir(newDir)
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
  }, [allowedTiers])

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
          Left-click drag: paint belts. Right-click: erase. Scroll: zoom. R: rotate (Shift+R reverse) · 1/2/3: tier · Space+drag or middle-click: pan · ghost preview shows next placement · Ctrl+Z undo · Ctrl+Shift+Z redo.
        </p>

        <h2>Sinks</h2>
        <div className="sink-requirements">
          {puzzle.sinks.map((s, i) => (
            <div key={`${s.x},${s.y}`} className="sink-req">
              <strong>Sink {i + 1}:</strong>{' '}
              {Object.entries(s.require)
                .map(([resource, rate]) => `${resource} @ ${rate}/s`)
                .join(', ')}
            </div>
          ))}
        </div>

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

        <h2 className="sim-header">
          <span>Sim</span>
          <span
            className={`sim-status sim-status-${simStatus}`}
            role="status"
            aria-label={`Simulation status: ${simStatus}`}
            title={`Simulation: ${simStatus}`}
          />
        </h2>
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
        <Suspense fallback={<div className="board-loading">Loading board…</div>}>
          <PixiBoard
            grid={grid}
            flows={flows}
            sinkResults={results ?? undefined}
            placementDir={dir}
            placementTier={tier}
            onPlace={handlePlace}
            onHoverCell={(c) => {
              hoverRef.current = c
            }}
          />
        </Suspense>
      </main>

      <WinModal
        open={modalOpen}
        puzzleTitle={puzzle.title}
        score={scoreGrid(grid)}
        previousBest={previousBest}
        isNewBest={isNewBest}
        onClose={() => setModalOpen(false)}
        onNextPuzzle={nextId ? () => changePuzzle(nextId) : undefined}
      />
    </div>
  )
}
