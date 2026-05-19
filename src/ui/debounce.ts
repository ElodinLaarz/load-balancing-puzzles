/**
 * Trailing-edge debounce. `call(...args)` schedules `fn(...args)` to run `ms`
 * milliseconds after the most recent `call`. Subsequent calls within the
 * window reset the timer; only the final args are delivered. `cancel()`
 * clears any pending invocation.
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number,
): {
  call: (...args: Args) => void
  cancel: () => void
} {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingArgs: Args | null = null

  function cancel(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    pendingArgs = null
  }

  function call(...args: Args): void {
    pendingArgs = args
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      const args = pendingArgs as Args
      pendingArgs = null
      fn(...args)
    }, ms)
  }

  return { call, cancel }
}
