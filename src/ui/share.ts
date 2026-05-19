import type { Puzzle } from '../puzzles/schema'
import { gridFromPuzzle, setCell } from '../sim/grid'
import { type Cell, type Grid, idx, inBounds } from '../sim/types'

/**
 * A solution that can be encoded into a URL hash and decoded back. Carries
 * ONLY the cells the player placed — never source/sink/obstacle, which the
 * puzzle itself owns and re-creates via `gridFromPuzzle()` on load.
 *
 * `version` lets us evolve the on-the-wire shape later; decoders that don't
 * understand a version return null instead of crashing.
 */
export interface SharedSolution {
  version: 1
  puzzleId: string
  cells: Array<{ x: number; y: number; cell: Cell }>
}

const CURRENT_VERSION = 1

// --- URL-safe base64 helpers --------------------------------------------------
// We use base64url (RFC 4648 §5): + → -, / → _, padding stripped. UTF-8 first.

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(b64url: string): string | null {
  // Restore standard base64 alphabet and padding.
  const standard = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4)
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    return null
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

// --- Public API ---------------------------------------------------------------

export function encodeSolution(s: SharedSolution): string {
  return toBase64Url(JSON.stringify(s))
}

/**
 * Decode a shared-solution payload. Accepts:
 *   - the raw base64url fragment ("abc...")
 *   - the fragment with a leading hash ("#abc...")
 *   - a full URL with a hash ("https://.../page#abc...")
 *
 * Returns `null` for any parse failure, including:
 *   - empty/whitespace input
 *   - malformed base64
 *   - JSON parse failure
 *   - missing/wrong `version`, `puzzleId`, or `cells` shape
 *
 * NEVER throws: callers can safely use it during component mount.
 */
export function decodeSolution(hashOrUrl: string): SharedSolution | null {
  if (typeof hashOrUrl !== 'string') return null
  const fragment = extractFragment(hashOrUrl)
  if (!fragment) return null

  const json = fromBase64Url(fragment)
  if (json === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }

  if (!isSharedSolution(parsed)) return null
  return parsed
}

function extractFragment(input: string): string {
  // If it looks like a URL, grab everything after the first '#'. URL parsing
  // would also work but is overkill and has its own throw-on-invalid behavior.
  const hashIdx = input.indexOf('#')
  const raw = hashIdx >= 0 ? input.slice(hashIdx + 1) : input
  return raw.trim()
}

// --- Grid <-> SharedSolution helpers ----------------------------------------

/**
 * Kinds the puzzle definition (sources/sinks/obstacles) is allowed to claim a
 * cell with. These slots can NEVER be overridden by a shared solution; they're
 * derived from `gridFromPuzzle()` and are owned by the puzzle author.
 */
function isPuzzleFixedKind(c: Cell | null): boolean {
  if (!c) return false
  return c.kind === 'source' || c.kind === 'sink' || c.kind === 'obstacle'
}

/**
 * Compute the player-placed cells: every cell on `grid` whose corresponding
 * slot in `gridFromPuzzle(puzzle)` is null. We deliberately exclude any cell
 * the puzzle marked as source/sink/obstacle, even if `grid` somehow shows a
 * different cell there — those slots aren't the player's to share.
 */
export function derivePlayerCells(
  grid: Grid,
  puzzle: Puzzle,
): SharedSolution['cells'] {
  const base = gridFromPuzzle(puzzle)
  const out: SharedSolution['cells'] = []
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const i = idx(grid, x, y)
      if (isPuzzleFixedKind(base.cells[i] ?? null)) continue
      const cur = grid.cells[i]
      if (!cur) continue
      out.push({ x, y, cell: cur })
    }
  }
  return out
}

/**
 * Apply shared player-placed cells onto a freshly-built puzzle grid. Drops
 * any cell that is out of bounds OR that would overwrite a puzzle-fixed slot
 * (source/sink/obstacle). Never throws.
 */
export function applySharedCells(
  puzzle: Puzzle,
  cells: SharedSolution['cells'],
): Grid {
  let g = gridFromPuzzle(puzzle)
  for (const entry of cells) {
    if (!entry || !entry.cell) continue
    const { x, y, cell } = entry
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue
    if (!inBounds(g, x, y)) continue
    if (isPuzzleFixedKind(g.cells[idx(g, x, y)] ?? null)) continue
    g = setCell(g, x, y, cell)
  }
  return g
}

function isSharedSolution(v: unknown): v is SharedSolution {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  if (obj.version !== CURRENT_VERSION) return false
  if (typeof obj.puzzleId !== 'string') return false
  if (!Array.isArray(obj.cells)) return false
  for (const entry of obj.cells) {
    if (typeof entry !== 'object' || entry === null) return false
    const e = entry as Record<string, unknown>
    if (typeof e.x !== 'number' || typeof e.y !== 'number') return false
    if (typeof e.cell !== 'object' || e.cell === null) return false
    const c = e.cell as Record<string, unknown>
    if (typeof c.kind !== 'string' || typeof c.dir !== 'string') return false
  }
  return true
}
