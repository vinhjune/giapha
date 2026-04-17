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
  id: 'x',
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
        bo: nguoiMau({ id: 'bo', gioiTinh: 'nam', honNhan: [{ voChongId: 'me' }] }),
        me: nguoiMau({ id: 'me', gioiTinh: 'nu' }),
      },
    }
    expect(timVoChong('bo', data)).toEqual(['me'])
  })
})

describe('tuDongDienMe', () => {
  it('returns mother ID when father has exactly one wife', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        bo: nguoiMau({ id: 'bo', honNhan: [{ voChongId: 'me' }] }),
        me: nguoiMau({ id: 'me' }),
      },
    }
    expect(tuDongDienMe('bo', data)).toBe('me')
  })

  it('returns null when father has multiple wives', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        bo: nguoiMau({ id: 'bo', honNhan: [{ voChongId: 'me1' }, { voChongId: 'me2' }] }),
        me1: nguoiMau({ id: 'me1' }),
        me2: nguoiMau({ id: 'me2' }),
      },
    }
    expect(tuDongDienMe('bo', data)).toBeNull()
  })
})

describe('sapXepAnhChiEm', () => {
  it('sorts siblings by thuTuAnhChi ascending, undeclared last', () => {
    const a = nguoiMau({ id: 'a', thuTuAnhChi: 2 })
    const b = nguoiMau({ id: 'b', thuTuAnhChi: 1 })
    const c = nguoiMau({ id: 'c' }) // no order
    expect(sapXepAnhChiEm([a, b, c]).map(p => p.id)).toEqual(['b', 'a', 'c'])
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
        bo: nguoiMau({ id: 'bo', conCaiIds: ['c1', 'c2'] }),
        c1: nguoiMau({ id: 'c1' }),
        c2: nguoiMau({ id: 'c2' }),
      },
    }
    const result = layConCai('bo', data)
    expect(result.map(p => p.id)).toEqual(['c1', 'c2'])
  })

  it('returns empty array for unknown personId', () => {
    const data: GiaphaData = { metadata: {} as any, persons: {} }
    expect(layConCai('nobody', data)).toEqual([])
  })

  it('skips stale child references not present in data', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        bo: nguoiMau({ id: 'bo', conCaiIds: ['c1', 'ghost'] }),
        c1: nguoiMau({ id: 'c1' }),
      },
    }
    expect(layConCai('bo', data).map(p => p.id)).toEqual(['c1'])
  })
})

describe('layBoCMe', () => {
  it('returns both parents when both exist', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        con: nguoiMau({ id: 'con', boId: 'bo', meId: 'me' }),
        bo: nguoiMau({ id: 'bo' }),
        me: nguoiMau({ id: 'me' }),
      },
    }
    const { bo, me } = layBoCMe(data.persons['con'], data)
    expect(bo?.id).toBe('bo')
    expect(me?.id).toBe('me')
  })

  it('returns undefined for unset parent IDs', () => {
    const data: GiaphaData = { metadata: {} as any, persons: {} }
    const { bo, me } = layBoCMe(nguoiMau({ id: 'x' }), data)
    expect(bo).toBeUndefined()
    expect(me).toBeUndefined()
  })
})
