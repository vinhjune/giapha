import type { SoftLock } from '../types/giapha'

export const SOFT_LOCK_MINUTES = 10

export function softLockHetHan(lock: SoftLock): boolean {
  const lockTime = new Date(lock.thoiGian).getTime()
  return Date.now() - lockTime > SOFT_LOCK_MINUTES * 60_000
}

export function kiemTraSoftLock(lock: SoftLock | undefined, currentEmail: string): SoftLock | null {
  if (!lock) return null
  if (lock.email === currentEmail) return null
  if (softLockHetHan(lock)) return null
  return lock
}

export function taoSoftLock(email: string, hoTen: string): SoftLock {
  return { email, hoTen, thoiGian: new Date().toISOString() }
}
