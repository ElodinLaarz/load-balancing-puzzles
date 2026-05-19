import type { BestScoreRecord } from './highScores'
import type { PuzzleScore } from './score'

export interface WinModalProps {
  open: boolean
  puzzleTitle: string
  score: PuzzleScore
  onClose: () => void
  /** Previous best for this puzzle (before this solve), or null if none. */
  previousBest?: BestScoreRecord | null
  /** True when the current score is a new personal best. */
  isNewBest?: boolean
}

export function WinModal({
  open,
  puzzleTitle,
  score,
  onClose,
  previousBest = null,
  isNewBest = false,
}: WinModalProps) {
  if (!open) return null
  return (
    <div className="win-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="win-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Solved: {puzzleTitle}</h2>
        {isNewBest && <div className="win-modal-badge">★ NEW BEST</div>}
        <dl>
          <dt>Cells used</dt>
          <dd>{score.cellsUsed}</dd>
          <dt>Tier cost</dt>
          <dd>{score.tierCost}</dd>
          <dt>Total</dt>
          <dd>{score.total}</dd>
          {previousBest && (
            <>
              <dt>Previous best</dt>
              <dd>{previousBest.total}</dd>
            </>
          )}
        </dl>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
