import { describe, it, expect } from 'vitest'
import { tuDongDienMe, tuDongDienBo } from '../utils/familyTree'
import type { GiaphaData } from '../types/giapha'

const data: GiaphaData = {
  metadata: {} as any,
  persons: {
    bo1: { id: 'bo1', hoTen: 'Bố', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [{ voChongId: 'me1' }], conCaiIds: [] },
    me1: { id: 'me1', hoTen: 'Mẹ', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: 'bo1' }], conCaiIds: [] },
  },
}

describe('PersonForm auto-fill', () => {
  it('selecting father with one wife auto-fills mother', () => {
    expect(tuDongDienMe('bo1', data)).toBe('me1')
  })

  it('selecting mother with one husband auto-fills father', () => {
    expect(tuDongDienBo('me1', data)).toBe('bo1')
  })
})
