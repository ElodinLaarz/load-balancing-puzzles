import type { PuzzleScore } from './score'

/** localStorage key under which the best-score map is kept. Bump the `vN`
 * suffix if the shape changes incompatibly. */
export const STORAGE_KEY = 'lbp.bestScores.v1'

export interface BestScoreRecord {
  cellsUsed: number
  tierCost: number
  total: number
  /** Date.now() at the moment this record was first recorded. */
  ts: number
}

type Store = Record<string, BestScoreRecord>

/** Returns null if localStorage is unavailable (SSR, private-browsing throw). */
function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function readAll(): Store {
  const ls = getStorage()
  if (!ls) return {}
  try {
    const raw = ls.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Store
  } catch {
    return {}
  }
}

function writeAll(store: Store): boolean {
  const ls = getStorage()
  if (!ls) return false
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(store))
    return true
  } catch {
    return false
  }
}

export function getBest(puzzleId: string): BestScoreRecord | null {
  const store = readAll()
  const rec = store[puzzleId]
  return rec ?? null
}

export function saveIfBest(
  puzzleId: string,
  score: PuzzleScore,
): { saved: boolean; record: BestScoreRecord } {
  // Read once: avoids a redundant localStorage hit + JSON parse, and keeps
  // the read/write pair atomic from the caller's POV.
  const store = readAll()
  const existing = store[puzzleId]

  // Tie: do NOT overwrite — preserve earlier ts.
  if (existing && score.total >= existing.total) {
    return { saved: false, record: existing }
  }

  const record: BestScoreRecord = {
    cellsUsed: score.cellsUsed,
    tierCost: score.tierCost,
    total: score.total,
    ts: Date.now(),
  }

  store[puzzleId] = record
  const wrote = writeAll(store)
  return { saved: wrote, record }
}
