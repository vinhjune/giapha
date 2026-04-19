import { describe, it, expect } from 'vitest'
import type { GiaphaData, Person } from '../types/giapha'
import {
  timVoChong,
  tuDongDienMe,
  sapXepAnhChiEm,
  laThanhVienThuocHo,
  layConCai,
  layBoCMe,
  tinhThuTuDoi,
  dinhDangTenNguoi,
} from './familyTree'

const nguoiMau = (ghi: Partial<Person>): Person => ({
  id: 0,
  hoTen: 'Test',
  gioiTinh: 'nam',
  laThanhVienHo: true,
  honNhan: [],
  conCaiIds: [],
  ...ghi,
})

describe('timVoChong', () => {
  it('returns spouse IDs of a person', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        1: nguoiMau({ id: 1, gioiTinh: 'nam', honNhan: [{ voChongId: 2 }] }),
        2: nguoiMau({ id: 2, gioiTinh: 'nu' }),
      },
    }
    expect(timVoChong(1, data)).toEqual([2])
  })
})

describe('tuDongDienMe', () => {
  it('returns mother ID when father has exactly one wife', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        1: nguoiMau({ id: 1, honNhan: [{ voChongId: 2 }] }),
        2: nguoiMau({ id: 2 }),
      },
    }
    expect(tuDongDienMe(1, data)).toBe(2)
  })

  it('returns null when father has multiple wives', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        1: nguoiMau({ id: 1, honNhan: [{ voChongId: 2 }, { voChongId: 3 }] }),
        2: nguoiMau({ id: 2 }),
        3: nguoiMau({ id: 3 }),
      },
    }
    expect(tuDongDienMe(1, data)).toBeNull()
  })
})

describe('sapXepAnhChiEm', () => {
  it('sorts siblings by thuTuAnhChi ascending, undeclared last', () => {
    const a = nguoiMau({ id: 1, thuTuAnhChi: 2 })
    const b = nguoiMau({ id: 2, thuTuAnhChi: 1 })
    const c = nguoiMau({ id: 3 }) // no order
    expect(sapXepAnhChiEm([a, b, c]).map(p => p.id)).toEqual([2, 1, 3])
  })
})

describe('laThanhVienThuocHo', () => {
  it('male is always clan member', () => {
    expect(laThanhVienThuocHo(nguoiMau({ gioiTinh: 'nam' }))).toBe(true)
  })

  it('female with laThanhVienHo false is not clan member', () => {
    expect(laThanhVienThuocHo(nguoiMau({ gioiTinh: 'nu', laThanhVienHo: false }))).toBe(false)
  })

  it('person with gioiTinh khac and laThanhVienHo false is not clan member', () => {
    expect(laThanhVienThuocHo(nguoiMau({ gioiTinh: 'khac', laThanhVienHo: false }))).toBe(false)
  })
})

describe('layConCai', () => {
  it('returns child Person objects for a parent', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        1: nguoiMau({ id: 1, conCaiIds: [2, 3] }),
        2: nguoiMau({ id: 2 }),
        3: nguoiMau({ id: 3 }),
      },
    }
    const result = layConCai(1, data)
    expect(result.map(p => p.id)).toEqual([2, 3])
  })

  it('returns empty array for unknown personId', () => {
    const data: GiaphaData = { metadata: {} as any, persons: {} }
    expect(layConCai(999, data)).toEqual([])
  })

  it('skips stale child references not present in data', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        1: nguoiMau({ id: 1, conCaiIds: [2, 999] }),
        2: nguoiMau({ id: 2 }),
      },
    }
    expect(layConCai(1, data).map(p => p.id)).toEqual([2])
  })
})

describe('layBoCMe', () => {
  it('returns both parents when both exist', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        1: nguoiMau({ id: 1, boId: 2, meId: 3 }),
        2: nguoiMau({ id: 2 }),
        3: nguoiMau({ id: 3 }),
      },
    }
    const { bo, me } = layBoCMe(data.persons[1], data)
    expect(bo?.id).toBe(2)
    expect(me?.id).toBe(3)
  })

  it('returns undefined for unset parent IDs', () => {
    const data: GiaphaData = { metadata: {} as any, persons: {} }
    const { bo, me } = layBoCMe(nguoiMau({ id: 999 }), data)
    expect(bo).toBeUndefined()
    expect(me).toBeUndefined()
  })
})

describe('tinhThuTuDoi + dinhDangTenNguoi', () => {
  it('calculates generation order and formats person name with generation', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        1: nguoiMau({ id: 1, hoTen: 'Cụ Tổ', gioiTinh: 'nam', honNhan: [{ voChongId: 2 }], conCaiIds: [3] }),
        2: nguoiMau({ id: 2, hoTen: 'Bà Tổ', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: 1 }], conCaiIds: [3] }),
        3: nguoiMau({ id: 3, hoTen: 'Ông Nông', gioiTinh: 'nam', boId: 1, meId: 2, honNhan: [], conCaiIds: [] }),
      },
    }

    const thuTuDoiById = tinhThuTuDoi(data)
    expect(thuTuDoiById[1]).toBe(1)
    expect(thuTuDoiById[2]).toBe(1)
    expect(thuTuDoiById[3]).toBe(2)
    expect(dinhDangTenNguoi(data.persons[3], thuTuDoiById, true)).toBe('Ông Nông (#2)')
    expect(dinhDangTenNguoi(data.persons[3], thuTuDoiById, false)).toBe('Ông Nông')
  })
})
