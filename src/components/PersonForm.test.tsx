import { describe, it, expect } from 'vitest'
import { tuDongDienMe, tuDongDienBo } from '../utils/familyTree'
import type { GiaphaData } from '../types/giapha'

const data: GiaphaData = {
  metadata: {} as any,
  persons: {
    10: { id: 10, hoTen: 'Bố', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [{ voChongId: 20 }], conCaiIds: [] },
    20: { id: 20, hoTen: 'Mẹ', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: 10 }], conCaiIds: [] },
  },
}

describe('PersonForm auto-fill', () => {
  it('selecting father with one wife auto-fills mother', () => {
    expect(tuDongDienMe(10, data)).toBe(20)
  })

  it('selecting mother with one husband auto-fills father', () => {
    expect(tuDongDienBo(20, data)).toBe(10)
  })
})
