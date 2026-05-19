import { describe, expect, it } from 'vitest'
import { initHistory, push, redo, undo } from './history'

describe('initHistory', () => {
  it('creates a history with empty past/future and given present', () => {
    const h = initHistory('a')
    expect(h.past).toEqual([])
    expect(h.future).toEqual([])
    expect(h.present).toBe('a')
  })
})

describe('push', () => {
  it('moves present onto past and sets next as present, clearing future', () => {
    const h0 = initHistory('a')
    const h1 = push(h0, 'b')
    expect(h1.past).toEqual(['a'])
    expect(h1.present).toBe('b')
    expect(h1.future).toEqual([])
  })

  it('clears future on push (classic redo-loss semantics)', () => {
    let h = initHistory('a')
    h = push(h, 'b')
    h = undo(h)
    expect(h.future).toEqual(['b'])
    h = push(h, 'c')
    expect(h.past).toEqual(['a'])
    expect(h.present).toBe('c')
    expect(h.future).toEqual([])
  })

  it('drops oldest entry when length exceeds cap', () => {
    let h = initHistory('a')
    h = push(h, 'b', 2)
    h = push(h, 'c', 2)
    h = push(h, 'd', 2)
    expect(h.past).toEqual(['b', 'c'])
    expect(h.present).toBe('d')
  })
})

describe('undo', () => {
  it('after push, restores prior present', () => {
    let h = initHistory('a')
    h = push(h, 'b')
    const u = undo(h)
    expect(u.past).toEqual([])
    expect(u.present).toBe('a')
    expect(u.future).toEqual(['b'])
  })

  it('is a no-op when past is empty', () => {
    const h = initHistory('a')
    const u = undo(h)
    expect(u.past).toEqual([])
    expect(u.present).toBe('a')
    expect(u.future).toEqual([])
  })
})

describe('redo', () => {
  it('brings the popped state back', () => {
    let h = initHistory('a')
    h = push(h, 'b')
    h = undo(h)
    const r = redo(h)
    expect(r.past).toEqual(['a'])
    expect(r.present).toBe('b')
    expect(r.future).toEqual([])
  })

  it('is a no-op when future is empty', () => {
    const h = initHistory('a')
    const r = redo(h)
    expect(r.past).toEqual([])
    expect(r.present).toBe('a')
    expect(r.future).toEqual([])
  })
})
