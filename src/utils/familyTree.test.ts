import { describe, it, expect } from 'vitest'
import type { GiaphaData, Person } from '../types/giapha'
import {
  timVoChong,
  tuDongDienMe,
  sapXepAnhChiEm,
  laThanhVienThuocHo,
  layConCai,
  layBoCMe,
} from './familyTree'

const nguoiMau = (ghi: Partial<Person>): Person => ({
  id: 1,
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
        10: nguoiMau({ id: 10, gioiTinh: 'nam', honNhan: [{ voChongId: 20 }] }),
        20: nguoiMau({ id: 20, gioiTinh: 'nu' }),
      },
    }
    expect(timVoChong(10, data)).toEqual([20])
  })
})

describe('tuDongDienMe', () => {
  it('returns mother ID when father has exactly one wife', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        10: nguoiMau({ id: 10, honNhan: [{ voChongId: 20 }] }),
        20: nguoiMau({ id: 20 }),
      },
    }
    expect(tuDongDienMe(10, data)).toBe(20)
  })

  it('returns null when father has multiple wives', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        10: nguoiMau({ id: 10, honNhan: [{ voChongId: 20 }, { voChongId: 21 }] }),
        20: nguoiMau({ id: 20 }),
        21: nguoiMau({ id: 21 }),
      },
    }
    expect(tuDongDienMe(10, data)).toBeNull()
  })
})

describe('sapXepAnhChiEm', () => {
  it('sorts siblings by thuTuAnhChi ascending, undeclared last', () => {
    const a = nguoiMau({ id: 101, thuTuAnhChi: 2 })
    const b = nguoiMau({ id: 102, thuTuAnhChi: 1 })
    const c = nguoiMau({ id: 103 }) // no order
    expect(sapXepAnhChiEm([a, b, c]).map(p => p.id)).toEqual([102, 101, 103])
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
        10: nguoiMau({ id: 10, conCaiIds: [30, 31] }),
        30: nguoiMau({ id: 30 }),
        31: nguoiMau({ id: 31 }),
      },
    }
    const result = layConCai(10, data)
    expect(result.map(p => p.id)).toEqual([30, 31])
  })

  it('returns empty array for unknown personId', () => {
    const data: GiaphaData = { metadata: {} as any, persons: {} }
    expect(layConCai(99, data)).toEqual([])
  })

  it('skips stale child references not present in data', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        10: nguoiMau({ id: 10, conCaiIds: [30, 99] }),
        30: nguoiMau({ id: 30 }),
      },
    }
    expect(layConCai(10, data).map(p => p.id)).toEqual([30])
  })
})

describe('layBoCMe', () => {
  it('returns both parents when both exist', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        40: nguoiMau({ id: 40, boId: 10, meId: 20 }),
        10: nguoiMau({ id: 10 }),
        20: nguoiMau({ id: 20 }),
      },
    }
    const { bo, me } = layBoCMe(data.persons[40], data)
    expect(bo?.id).toBe(10)
    expect(me?.id).toBe(20)
  })

  it('returns undefined for unset parent IDs', () => {
    const data: GiaphaData = { metadata: {} as any, persons: {} }
    const { bo, me } = layBoCMe(nguoiMau({ id: 'x' }), data)
    expect(bo).toBeUndefined()
    expect(me).toBeUndefined()
  })
})
