export interface History<T> {
  past: T[]
  present: T
  future: T[]
}

export const initHistory = <T>(present: T): History<T> => ({
  past: [],
  present,
  future: [],
})

export function push<T>(h: History<T>, next: T, cap = 200): History<T> {
  const past = h.past.concat([h.present])
  if (past.length > cap) past.shift()
  return { past, present: next, future: [] }
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h
  const present = h.past[h.past.length - 1]!
  return {
    past: h.past.slice(0, -1),
    present,
    future: h.future.concat([h.present]),
  }
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h
  const present = h.future[h.future.length - 1]!
  return {
    past: h.past.concat([h.present]),
    present,
    future: h.future.slice(0, -1),
  }
}
