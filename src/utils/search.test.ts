import { describe, it, expect } from 'vitest'
import { timKiemTheoTen } from './search'
import type { GiaphaData, Person } from '../types/giapha'

const p = (id: number, hoTen: string): Person => ({
  id, hoTen, gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: [],
})

const data: GiaphaData = {
  metadata: {} as any,
  persons: {
    1: p(1, 'Nguyễn Văn An'),
    2: p(2, 'Nguyễn Thị Bình'),
    3: p(3, 'Trần Văn An'),
  },
}

describe('timKiemTheoTen', () => {
  it('returns all persons matching name (case insensitive, accent insensitive)', () => {
    const results = timKiemTheoTen('an', data)
    expect(results.map(p => p.id)).toContain(1)
    expect(results.map(p => p.id)).toContain(3)
    expect(results.map(p => p.id)).not.toContain(2)
  })

  it('returns empty array for no match', () => {
    expect(timKiemTheoTen('xyz', data)).toHaveLength(0)
  })

  it('matches Vietnamese accented characters', () => {
    const results = timKiemTheoTen('binh', data)
    expect(results.map(p => p.id)).toContain(2)
  })

  it('matches names with Đ/đ when searching with d', () => {
    const dataD: GiaphaData = {
      metadata: {} as any,
      persons: { 4: p(4, 'Đặng Văn Dũng') },
    }
    expect(timKiemTheoTen('dang', dataD).map(p => p.id)).toContain(4)
  })
})
