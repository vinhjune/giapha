import { describe, it, expect } from 'vitest'
import { kiemTraSoftLock, softLockHetHan, SOFT_LOCK_MINUTES } from './conflict'
import type { SoftLock } from '../types/giapha'

describe('softLockHetHan', () => {
  it('returns true if lock is older than SOFT_LOCK_MINUTES', () => {
    const old = new Date(Date.now() - (SOFT_LOCK_MINUTES + 1) * 60_000).toISOString()
    const lock: SoftLock = { email: 'a@b.com', hoTen: 'A', thoiGian: old }
    expect(softLockHetHan(lock)).toBe(true)
  })

  it('returns false if lock is recent', () => {
    const recent = new Date().toISOString()
    const lock: SoftLock = { email: 'a@b.com', hoTen: 'A', thoiGian: recent }
    expect(softLockHetHan(lock)).toBe(false)
  })
})

describe('kiemTraSoftLock', () => {
  it('returns null if no lock present', () => {
    expect(kiemTraSoftLock(undefined, 'me@me.com')).toBeNull()
  })

  it('returns null if current user holds the lock', () => {
    const lock: SoftLock = { email: 'me@me.com', hoTen: 'Me', thoiGian: new Date().toISOString() }
    expect(kiemTraSoftLock(lock, 'me@me.com')).toBeNull()
  })

  it('returns lock if another user holds it and it is not expired', () => {
    const lock: SoftLock = { email: 'other@me.com', hoTen: 'Other', thoiGian: new Date().toISOString() }
    expect(kiemTraSoftLock(lock, 'me@me.com')).toBe(lock)
  })
})
