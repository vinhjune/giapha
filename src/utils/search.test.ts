import { describe, it, expect } from 'vitest'
import { timKiemTheoTen } from './search'
import type { GiaphaData, Person } from '../types/giapha'

const p = (id: string, hoTen: string): Person => ({
  id, hoTen, gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: [],
})

const data: GiaphaData = {
  metadata: {} as any,
  persons: {
    p1: p('p1', 'Nguyễn Văn An'),
    p2: p('p2', 'Nguyễn Thị Bình'),
    p3: p('p3', 'Trần Văn An'),
  },
}

describe('timKiemTheoTen', () => {
  it('returns all persons matching name (case insensitive, accent insensitive)', () => {
    const results = timKiemTheoTen('an', data)
    expect(results.map(p => p.id)).toContain('p1')
    expect(results.map(p => p.id)).toContain('p3')
    expect(results.map(p => p.id)).not.toContain('p2')
  })

  it('returns empty array for no match', () => {
    expect(timKiemTheoTen('xyz', data)).toHaveLength(0)
  })

  it('matches Vietnamese accented characters', () => {
    const results = timKiemTheoTen('binh', data)
    expect(results.map(p => p.id)).toContain('p2')
  })
})
