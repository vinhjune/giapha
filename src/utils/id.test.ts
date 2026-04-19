import { describe, it, expect } from 'vitest'
import { nextId } from './id'

describe('nextId', () => {
  it('returns 1 when persons is empty', () => {
    expect(nextId({})).toBe(1)
  })

  it('returns max existing id + 1', () => {
    expect(nextId({ 1: {}, 5: {}, 3: {} } as any)).toBe(6)
  })

  it('ignores non-numeric keys', () => {
    expect(nextId({ 2: {}, abc: {} } as any)).toBe(3)
  })
})
