import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { PUZZLES } from '../puzzles'
import { encodeSolution } from './share'

// PixiBoard requires a real Canvas (not provided by jsdom) and pulls in pixi.js,
// so stub it out for the UI render path. App lazy-imports './ui/PixiBoard' from
// '../App', so the mock path must match what App actually imports.
vi.mock('../ui/PixiBoard', () => ({
  default: vi.fn(() => null),
}))

function getButtonByExactText(text: string) {
  const buttons = screen.getAllByRole('button')
  const match = buttons.find((b) => b.textContent === text)
  if (!match) throw new Error(`No button with exact text "${text}"`)
  return match
}

describe('App UI smoke', () => {
  // App reads window.location.hash at mount to restore shared solutions.
  // jsdom shares window across tests, so earlier tests' grid edits leak hash
  // state into later tests' initial puzzle selection — reset before each.
  beforeEach(() => {
    window.history.replaceState({}, '', window.location.pathname + window.location.search)
  })
  it('renders sidebar with the first puzzle description', async () => {
    render(<App />)
    // Lazy PixiBoard suspends initially; sidebar text is rendered eagerly.
    expect(
      screen.getByText(PUZZLES[0].description),
    ).toBeInTheDocument()
  })

  it('switches active tier when a tier button is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    // The intro puzzle only allows 'yellow' tier, so move to puzzle 2 which
    // allows both yellow and red.
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, PUZZLES[1].id)

    expect(getButtonByExactText('yellow').classList.contains('on')).toBe(true)
    expect(getButtonByExactText('red').classList.contains('on')).toBe(false)

    await user.click(getButtonByExactText('red'))
    expect(getButtonByExactText('red').classList.contains('on')).toBe(true)
    expect(getButtonByExactText('yellow').classList.contains('on')).toBe(false)
  })

  it('switches active direction when a direction button is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(getButtonByExactText('E').classList.contains('on')).toBe(true)
    expect(getButtonByExactText('N').classList.contains('on')).toBe(false)

    await user.click(getButtonByExactText('N'))
    expect(getButtonByExactText('N').classList.contains('on')).toBe(true)
    expect(getButtonByExactText('E').classList.contains('on')).toBe(false)
  })

  it('responds to 1 / 2 / 3 tier hotkeys', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Switch to puzzle 2 (yellow + red allowed).
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, PUZZLES[1].id)
    // The keydown handler in App ignores events targeted at <select>/<input>
    // (App.tsx line ~87) so the select keeping focus after selectOptions would
    // swallow the tier hotkey. Blur it before issuing keystrokes.
    ;(select as HTMLSelectElement).blur()

    // Re-query each assertion: setState swaps the button nodes, so cached refs
    // would point at unmounted elements and report stale classes.
    await user.keyboard('2')
    expect(getButtonByExactText('red').classList.contains('on')).toBe(true)
    expect(getButtonByExactText('yellow').classList.contains('on')).toBe(false)

    await user.keyboard('1')
    expect(getButtonByExactText('yellow').classList.contains('on')).toBe(true)
    expect(getButtonByExactText('red').classList.contains('on')).toBe(false)

    // '3' (blue) is not allowed for puzzle 2 (yellow + red only), so pressing
    // it must NOT change the active tier away from yellow.
    await user.keyboard('3')
    expect(getButtonByExactText('yellow').classList.contains('on')).toBe(true)
  })

  it('updates the description when the puzzle select changes', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByText(PUZZLES[0].description)).toBeInTheDocument()

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, PUZZLES[1].id)
    await waitFor(() => {
      expect(screen.getByText(PUZZLES[1].description)).toBeInTheDocument()
    })
    expect(screen.queryByText(PUZZLES[0].description)).not.toBeInTheDocument()
  })

  it('renders the allowed tier buttons for the selected puzzle', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Puzzle 1: only yellow allowed.
    const tierHeading = screen.getByRole('heading', { name: 'Tier' })
    const tierRow = tierHeading.nextElementSibling as HTMLElement
    expect(tierRow).toBeTruthy()
    expect(within(tierRow).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'yellow',
    ])

    // Switch to puzzle 2: yellow + red.
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, PUZZLES[1].id)
    const tierRow2 = screen
      .getByRole('heading', { name: 'Tier' })
      .nextElementSibling as HTMLElement
    expect(
      within(tierRow2).getAllByRole('button').map((b) => b.textContent),
    ).toEqual(['yellow', 'red'])
  })
})

describe('Reset button confirm guard', () => {
  // PixiBoard is mocked so we cannot click-paint cells. To create a non-empty
  // grid we seed `window.location.hash` with an encoded SharedSolution before
  // rendering — App.initialStateFromHash reads it on mount.
  function seedHashWithBelt(puzzleId: string, x: number, y: number) {
    const encoded = encodeSolution({
      version: 1,
      puzzleId,
      cells: [{ x, y, cell: { kind: 'belt', dir: 'E', tier: 'yellow' } }],
    })
    window.history.replaceState({}, '', '#' + encoded)
  }

  function clearHash() {
    window.history.replaceState({}, '', window.location.pathname + window.location.search)
  }

  let confirmSpy: MockInstance<(message?: string) => boolean>

  beforeEach(() => {
    clearHash()
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    confirmSpy.mockRestore()
    clearHash()
  })

  it('prompts and aborts when user cancels with a non-empty grid', async () => {
    const user = userEvent.setup()
    seedHashWithBelt(PUZZLES[0].id, 1, 3)
    confirmSpy.mockReturnValue(false)
    render(<App />)

    // After mount the hash has been re-encoded with the seeded belt; capture
    // it so we can prove Reset did not mutate the grid.
    const hashWithBelt = window.location.hash
    expect(hashWithBelt.length).toBeGreaterThan(1)

    await user.click(getButtonByExactText('Reset'))

    expect(confirmSpy).toHaveBeenCalledWith('Clear all placed cells?')
    // Grid still has the belt → hash unchanged.
    expect(window.location.hash).toBe(hashWithBelt)
  })

  it('clears the grid when user confirms with a non-empty grid', async () => {
    const user = userEvent.setup()
    seedHashWithBelt(PUZZLES[0].id, 1, 3)
    confirmSpy.mockReturnValue(true)
    render(<App />)

    const hashWithBelt = window.location.hash
    expect(hashWithBelt.length).toBeGreaterThan(1)

    await user.click(getButtonByExactText('Reset'))

    expect(confirmSpy).toHaveBeenCalledWith('Clear all placed cells?')
    // After reset, App re-encodes the empty solution, so the hash should
    // change. The new hash will encode `cells: []`.
    await waitFor(() => {
      expect(window.location.hash).not.toBe(hashWithBelt)
    })
  })

  it('does NOT prompt when the grid is already empty', async () => {
    const user = userEvent.setup()
    // No hash seeding: initial state is gridFromPuzzle (only source+sink).
    // Make confirm return false so an accidental prompt would visibly stop us.
    confirmSpy.mockReturnValue(false)
    render(<App />)

    const hashBefore = window.location.hash

    await user.click(getButtonByExactText('Reset'))

    expect(confirmSpy).not.toHaveBeenCalled()
    // Reset on an already-empty grid is a no-op for the URL hash too.
    expect(window.location.hash).toBe(hashBefore)
  })
})
