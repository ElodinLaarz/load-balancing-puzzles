import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { WinModal } from './WinModal'
import type { PuzzleScore } from './score'

const SCORE: PuzzleScore = { cellsUsed: 5, tierCost: 7, total: 12 }

function renderModal(overrides: Partial<Parameters<typeof WinModal>[0]> = {}) {
  const onClose = vi.fn()
  const utils = render(
    <WinModal
      open
      puzzleTitle="Test puzzle"
      score={SCORE}
      onClose={onClose}
      {...overrides}
    />,
  )
  return { onClose, ...utils }
}

describe('WinModal close interactions', () => {
  it('calls onClose when Escape is pressed', () => {
    const { onClose } = renderModal()
    // Window-level keydown listener should fire onClose regardless of focus.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClose when Escape is pressed while closed', () => {
    const onClose = vi.fn()
    render(
      <WinModal
        open={false}
        puzzleTitle="Test puzzle"
        score={SCORE}
        onClose={onClose}
      />,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('removes its Escape listener when unmounted so Escape no longer closes', () => {
    const { onClose, unmount } = renderModal()
    unmount()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when the overlay (backdrop) is clicked', () => {
    const { onClose } = renderModal()
    // The dialog wrapper is also the overlay; clicking it fires onClose.
    const overlay = screen.getByRole('dialog')
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onClose when clicking inside the modal content', () => {
    const { onClose } = renderModal()
    // Clicking the heading inside the modal panel must not bubble to the overlay.
    const heading = screen.getByRole('heading', { name: /Solved: Test puzzle/ })
    fireEvent.click(heading)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('ignores non-Escape keys', () => {
    const { onClose } = renderModal()
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'a' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
