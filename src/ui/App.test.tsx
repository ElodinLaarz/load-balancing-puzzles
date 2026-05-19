import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { PUZZLES } from '../puzzles'
import type { Dir } from '../sim/types'

// PixiBoard requires a real Canvas (not provided by jsdom) and pulls in pixi.js,
// so stub it out for the UI render path. App lazy-imports './ui/PixiBoard' from
// '../App', so the mock path must match what App actually imports.
//
// The stub captures the latest `onPlace` callback so tests can simulate a cell
// placement (which would normally arrive via a Pixi pointer event on the
// canvas). Tests retrieve it via `getLastPlace()` below.
let lastOnPlace: ((x: number, y: number, dir: Dir | null, button: number) => void) | null = null
vi.mock('../ui/PixiBoard', () => ({
  default: vi.fn((props: { onPlace?: (x: number, y: number, dir: Dir | null, button: number) => void }) => {
    lastOnPlace = props.onPlace ?? null
    return null
  }),
}))

function getLastPlace() {
  if (!lastOnPlace) throw new Error('PixiBoard mock has not received an onPlace callback yet')
  return lastOnPlace
}

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
    lastOnPlace = null
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

  it('shows live score breakdown in the sidebar that updates as belts are placed', async () => {
    render(<App />)

    // Initial state for puzzle 01-intro: only puzzle-fixed source + sink, no
    // player cells, so cellsUsed = 0 / tierCost = 0 / total = 0.
    const scoreHeading = await screen.findByRole('heading', { name: 'Score' })
    const scoreSection = scoreHeading.nextElementSibling as HTMLElement
    expect(scoreSection).toBeTruthy()
    expect(scoreSection.textContent).toMatch(/Cells used.*0/)
    expect(scoreSection.textContent).toMatch(/Tier cost.*0/)
    expect(scoreSection.textContent).toMatch(/Total.*0/)

    // Simulate placing one yellow belt — mirrors a left-click on the board.
    // PixiBoard is mocked, so we invoke the captured onPlace handler directly.
    act(() => {
      getLastPlace()(1, 3, 'E', 0)
    })

    // One player-placed yellow belt: cellsUsed = 1, tierCost = TIER_COST.yellow = 1,
    // total = 2.
    await waitFor(() => {
      const section = screen.getByRole('heading', { name: 'Score' })
        .nextElementSibling as HTMLElement
      expect(section.textContent).toMatch(/Cells used.*1/)
      expect(section.textContent).toMatch(/Tier cost.*1/)
      expect(section.textContent).toMatch(/Total.*2/)
    })
  })
})
