import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WinModal, type WinModalProps } from './WinModal'
import type { PuzzleScore } from './score'
import type { BestScoreRecord } from './highScores'

const baseScore: PuzzleScore = {
  cellsUsed: 5,
  tierCost: 7,
  total: 12,
}

const previousBest: BestScoreRecord = {
  cellsUsed: 9,
  tierCost: 11,
  total: 20,
  ts: 1_700_000_000_000,
}

function renderModal(overrides: Partial<WinModalProps> = {}) {
  const onClose = vi.fn()
  const onNextPuzzle = vi.fn()
  const props = {
    open: true,
    puzzleTitle: 'Test Puzzle',
    score: baseScore,
    onClose,
    onNextPuzzle,
    ...overrides,
  }
  render(<WinModal {...props} />)
  return { onClose, onNextPuzzle, props }
}

describe('WinModal', () => {
  it('renders Close and Next puzzle buttons when onNextPuzzle provided', () => {
    renderModal()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next puzzle/ })).toBeInTheDocument()
  })

  it('does NOT render Next puzzle button when onNextPuzzle is omitted', () => {
    renderModal({ onNextPuzzle: undefined })
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Next puzzle/ })).not.toBeInTheDocument()
  })

  it('invokes onNextPuzzle exactly once when Next puzzle button is clicked', async () => {
    const user = userEvent.setup()
    const { onNextPuzzle, onClose } = renderModal()
    await user.click(screen.getByRole('button', { name: /Next puzzle/ }))
    expect(onNextPuzzle).toHaveBeenCalledTimes(1)
    // Clicking next-puzzle should not fire onClose (button click does not
    // bubble to the overlay because the modal content stops propagation).
    expect(onClose).not.toHaveBeenCalled()
  })

  it('invokes onClose exactly once when Close button is clicked', async () => {
    const user = userEvent.setup()
    const { onClose, onNextPuzzle } = renderModal()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onNextPuzzle).not.toHaveBeenCalled()
  })

  it('invokes onClose when the backdrop overlay is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    // The overlay element is the outermost dialog div (role="dialog").
    const overlay = screen.getByRole('dialog')
    expect(overlay.classList.contains('win-modal-overlay')).toBe(true)
    await user.click(overlay)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT invoke onClose when clicking inside modal content (e.g. on the title)', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    // Click the title — propagation stops at the inner .win-modal div.
    await user.click(screen.getByRole('heading', { name: /Solved: Test Puzzle/ }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('renders the NEW BEST badge when isNewBest is true', () => {
    renderModal({ isNewBest: true })
    // Actual copy in WinModal.tsx is "★ NEW BEST".
    expect(screen.getByText(/NEW BEST/)).toBeInTheDocument()
  })

  it('does NOT render the NEW BEST badge when isNewBest is false', () => {
    renderModal({ isNewBest: false })
    expect(screen.queryByText(/NEW BEST/)).not.toBeInTheDocument()
  })

  it('renders previous-best total when isNewBest=false and previousBest provided', () => {
    renderModal({ isNewBest: false, previousBest })
    expect(screen.getByText('Previous best')).toBeInTheDocument()
    // Previous best total is 20 per our fixture.
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('does not render anything when open is false', () => {
    const { container } = render(
      <WinModal
        open={false}
        puzzleTitle="Hidden"
        score={baseScore}
        onClose={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
