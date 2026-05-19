import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { debounce } from './debounce'

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not invoke fn before the delay elapses', () => {
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d.call()
    vi.advanceTimersByTime(99)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('coalesces multiple calls within the window into a single invocation with the last args', () => {
    const fn = vi.fn<(arg: string) => void>()
    const d = debounce(fn, 100)
    d.call('a')
    vi.advanceTimersByTime(50)
    d.call('b')
    vi.advanceTimersByTime(50)
    d.call('c')
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('c')
  })

  it('cancel() prevents a pending invocation from firing', () => {
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d.call()
    vi.advanceTimersByTime(50)
    d.cancel()
    vi.advanceTimersByTime(1000)
    expect(fn).not.toHaveBeenCalled()
  })

  it('can fire again after a previous invocation has resolved', () => {
    const fn = vi.fn<(arg: number) => void>()
    const d = debounce(fn, 100)
    d.call(1)
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenLastCalledWith(1)
    d.call(2)
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith(2)
  })
})
