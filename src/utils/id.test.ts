import { describe, it, expect } from 'vitest'
import { taoId } from './id'
import type { Person } from '../types/giapha'

const taoNguoi = (id: number): Person => ({
  id,
  hoTen: 'Test',
  gioiTinh: 'nam',
  laThanhVienHo: true,
  honNhan: [],
  conCaiIds: [],
})

describe('taoId', () => {
  it('returns max existing id + 1', () => {
    expect(taoId({
      1: taoNguoi(1),
      3: taoNguoi(3),
      9: taoNguoi(9),
    })).toBe(10)
  })

  it('returns 1 for empty persons map', () => {
    expect(taoId({})).toBe(1)
  })
})
