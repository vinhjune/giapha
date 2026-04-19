/** Returns the next numeric ID, which is max(existing ids) + 1.
 *  Falls back to 1 if no persons exist yet. */
export function nextId(persons: Record<string, unknown>): number {
  const keys = Object.keys(persons).map(Number).filter(n => Number.isFinite(n))
  return keys.length > 0 ? Math.max(...keys) + 1 : 1
}
