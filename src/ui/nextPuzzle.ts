// Returns the id immediately after currentId in allIds. Returns null when
// currentId is the last entry or is not present in the list.
export function nextPuzzleId(currentId: string, allIds: readonly string[]): string | null {
  const i = allIds.indexOf(currentId)
  if (i === -1) return null
  if (i >= allIds.length - 1) return null
  return allIds[i + 1]
}
