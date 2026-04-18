import type { Person } from '../types/giapha'

export function taoId(persons: Record<number, Person>): number {
  return Object.values(persons).reduce((maxId, person) => Math.max(maxId, person.id), 0) + 1
}
