import type { PuzzleScore } from './score'

export interface WinModalProps {
  open: boolean
  puzzleTitle: string
  score: PuzzleScore
  onClose: () => void
}

export function WinModal({ open, puzzleTitle, score, onClose }: WinModalProps) {
  if (!open) return null
  return (
    <div className="win-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="win-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Solved: {puzzleTitle}</h2>
        <dl>
          <dt>Cells used</dt>
          <dd>{score.cellsUsed}</dd>
          <dt>Tier cost</dt>
          <dd>{score.tierCost}</dd>
          <dt>Total</dt>
          <dd>{score.total}</dd>
        </dl>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
