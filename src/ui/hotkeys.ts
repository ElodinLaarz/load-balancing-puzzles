import type { BeltTier } from '../sim/types'

// Maps the 1/2/3 number-row keys to belt tiers. Returns null when the key is
// not bound or when the candidate tier is not allowed by the active puzzle.
export function tierForKey(key: string, allowed: readonly BeltTier[]): BeltTier | null {
  const map: Record<string, BeltTier> = { '1': 'yellow', '2': 'red', '3': 'blue' }
  const candidate = map[key]
  if (candidate && allowed.includes(candidate)) return candidate
  return null
}
