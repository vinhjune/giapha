import { describe, it, expect } from 'vitest'
import { taoId } from './id'

describe('taoId', () => {
  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, taoId))
    expect(ids.size).toBe(100)
  })

  it('starts with p_', () => {
    expect(taoId()).toMatch(/^p_/)
  })
})
