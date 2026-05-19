import { describe, expect, it } from 'vitest'
import { previewCellSpec } from './previewCell'

describe('previewCellSpec', () => {
  it('returns a belt cell spec with the given dir and tier', () => {
    expect(previewCellSpec('E', 'yellow')).toEqual({
      kind: 'belt',
      dir: 'E',
      tier: 'yellow',
    })
  })

  it('preserves all valid directions', () => {
    expect(previewCellSpec('N', 'red').dir).toBe('N')
    expect(previewCellSpec('S', 'blue').dir).toBe('S')
    expect(previewCellSpec('W', 'yellow').dir).toBe('W')
  })

  it('preserves all valid tiers', () => {
    expect(previewCellSpec('E', 'yellow').tier).toBe('yellow')
    expect(previewCellSpec('E', 'red').tier).toBe('red')
    expect(previewCellSpec('E', 'blue').tier).toBe('blue')
  })
})
