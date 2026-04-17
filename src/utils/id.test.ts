import { describe, it, expect } from 'vitest'
import { taoId } from './id'

describe('taoId', () => {
  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, taoId))
    expect(ids.size).toBe(100)
  })

  it('has valid format p_<base36timestamp>_<5chars>', () => {
    expect(taoId()).toMatch(/^p_[0-9a-z]+_[0-9a-z]{5}$/)
  })

  it('respects custom prefix', () => {
    expect(taoId('x')).toMatch(/^x_/)
  })
})
