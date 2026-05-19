import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { PUZZLES } from '../puzzles'

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

  it('shows the Sinks section with required resources and rates for the initial puzzle', () => {
    render(<App />)
    // Puzzle 1 ("01-intro") has a single sink requiring 15/s of "iron".
    const sinksHeading = screen.getByRole('heading', { name: 'Sinks' })
    expect(sinksHeading).toBeInTheDocument()
    // The requirements row immediately follows the heading. Scope the assertions
    // to it so we don't collide with the post-sim "sink-detail" panel further
    // down (which also mentions "iron").
    const sinksList = sinksHeading.nextElementSibling as HTMLElement
    expect(sinksList).toBeTruthy()
    expect(within(sinksList).getByText(/Sink 1/)).toBeInTheDocument()
    // Resource name + rate appear together in a single text node. The function
    // matcher may match both the row and its container, so just assert that
    // at least one element shows the expected combined text.
    expect(
      within(sinksList).getAllByText((_, el) =>
        Boolean(el && /iron\s*@\s*15\/s/.test(el.textContent ?? '')),
      ).length,
    ).toBeGreaterThan(0)
  })

  it('updates the Sinks section when the puzzle changes', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Switch to puzzle 2 (02-two-to-four): 4 sinks, each requiring
    // iron / coal / iron-plate / copper-plate at 3.75/s.
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, PUZZLES[1].id)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sinks' })).toBeInTheDocument()
    })
    const sinksHeading = screen.getByRole('heading', { name: 'Sinks' })
    // Scope to the list immediately after the heading to avoid colliding with
    // the post-sim "sink-detail" panel which mirrors some resource names.
    const sinksList = sinksHeading.nextElementSibling as HTMLElement
    expect(sinksList).toBeTruthy()

    // Four sinks listed (1..4).
    expect(within(sinksList).getByText(/Sink 1/)).toBeInTheDocument()
    expect(within(sinksList).getByText(/Sink 4/)).toBeInTheDocument()

    // Each sink lists the four required resources at 3.75/s. Use a textContent
    // matcher so we can assert resource-name + rate appear together.
    const hasReqText = (regex: RegExp) => (_: string, el: Element | null) =>
      Boolean(el && regex.test(el.textContent ?? ''))
    expect(
      within(sinksList).getAllByText(hasReqText(/iron-plate\s*@\s*3\.75\/s/)).length,
    ).toBeGreaterThan(0)
    expect(
      within(sinksList).getAllByText(hasReqText(/copper-plate\s*@\s*3\.75\/s/)).length,
    ).toBeGreaterThan(0)
    expect(
      within(sinksList).getAllByText(hasReqText(/coal\s*@\s*3\.75\/s/)).length,
    ).toBeGreaterThan(0)
  })
})
