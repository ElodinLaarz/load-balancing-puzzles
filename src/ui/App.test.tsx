import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { PUZZLES } from '../puzzles'
import { STORAGE_KEY } from './highScores'

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
  // Also clear localStorage so best-score state from other tests does not
  // bleed into the puzzle-selector checkmark assertions below.
  beforeEach(() => {
    window.history.replaceState({}, '', window.location.pathname + window.location.search)
    window.localStorage.clear()
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

  // Regression for issue #6: when the player has any best score for a puzzle,
  // the dropdown option for that puzzle should be visually marked as
  // completed (currently a "✓ " prefix on the option label).
  it('prepends a checkmark to puzzles that have a saved best score', () => {
    // Seed a best-score record for the first puzzle BEFORE render — App reads
    // localStorage during initial render to derive option labels.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        '01-intro': { cellsUsed: 1, tierCost: 1, total: 2, ts: 1 },
      }),
    )
    render(<App />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    const intro = Array.from(select.options).find((o) => o.value === '01-intro')
    expect(intro, 'option for 01-intro should exist').toBeTruthy()
    expect(intro!.textContent ?? '').toContain('✓')
    // Puzzles without a best score must NOT receive the checkmark.
    const second = Array.from(select.options).find((o) => o.value === PUZZLES[1].id)
    expect(second, 'option for second puzzle should exist').toBeTruthy()
    expect(second!.textContent ?? '').not.toContain('✓')
  })
})
