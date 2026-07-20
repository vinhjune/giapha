import { describe, expect, it } from 'vitest'
import { sortRowsForDisplay, SORTABLE_FIELDS } from './memberRowSort'
import type { EditableRow } from '../components/MemberManagementView'

function makeRow(overrides: Partial<EditableRow> = {}): EditableRow {
  return {
    _key: '1',
    id: '1',
    hoTen: 'Người A',
    gioiTinh: 'nam',
    laThanhVienHo: 'true',
    thuTuDoi: '1',
    thuTuAnhChi: '',
    boId: '',
    meId: '',
    voChongIds: '',
    queQuan: '',
    tieuSu: '',
    email: '',
    soDienThoai: '',
    ghiChu: '',
    namSinh: undefined,
    namMat: undefined,
    ...overrides,
  }
}

const noName = () => ''

describe('SORTABLE_FIELDS', () => {
  it('excludes voChongIds', () => {
    expect(SORTABLE_FIELDS.has('voChongIds')).toBe(false)
  })

  it('includes all other columns', () => {
    expect(SORTABLE_FIELDS.has('hoTen')).toBe(true)
    expect(SORTABLE_FIELDS.has('boId')).toBe(true)
    expect(SORTABLE_FIELDS.has('namSinh')).toBe(true)
  })
})

describe('sortRowsForDisplay', () => {
  it('returns rows in original order with matching originalIndex when sortState is null', () => {
    const rows = [makeRow({ _key: 'a' }), makeRow({ _key: 'b' }), makeRow({ _key: 'c' })]
    const result = sortRowsForDisplay(rows, null, noName)
    expect(result.map(r => r.originalIndex)).toEqual([0, 1, 2])
    expect(result.map(r => r.row._key)).toEqual(['a', 'b', 'c'])
  })

  it('sorts string field (hoTen) with Vietnamese collation, ASC', () => {
    const rows = [
      makeRow({ _key: 'a', hoTen: 'Đông' }),
      makeRow({ _key: 'b', hoTen: 'Ân' }),
      makeRow({ _key: 'c', hoTen: 'Bình' }),
    ]
    const result = sortRowsForDisplay(rows, { field: 'hoTen', direction: 'asc' }, noName)
    expect(result.map(r => r.row._key)).toEqual(['b', 'c', 'a'])
  })

  it('puts blank string values first on ASC and last on DESC', () => {
    const rows = [
      makeRow({ _key: 'a', email: 'z@example.com' }),
      makeRow({ _key: 'b', email: '' }),
      makeRow({ _key: 'c', email: 'a@example.com' }),
    ]
    const asc = sortRowsForDisplay(rows, { field: 'email', direction: 'asc' }, noName)
    expect(asc.map(r => r.row._key)).toEqual(['b', 'c', 'a'])

    const desc = sortRowsForDisplay(rows, { field: 'email', direction: 'desc' }, noName)
    expect(desc.map(r => r.row._key)).toEqual(['a', 'c', 'b'])
  })

  it('sorts numeric field (thuTuDoi) numerically, not lexicographically', () => {
    const rows = [
      makeRow({ _key: 'a', thuTuDoi: '10' }),
      makeRow({ _key: 'b', thuTuDoi: '2' }),
      makeRow({ _key: 'c', thuTuDoi: '' }),
    ]
    const result = sortRowsForDisplay(rows, { field: 'thuTuDoi', direction: 'asc' }, noName)
    expect(result.map(r => r.row._key)).toEqual(['c', 'b', 'a'])
  })

  it('treats non-numeric thuTuDoi as blank', () => {
    const rows = [
      makeRow({ _key: 'a', thuTuDoi: '3' }),
      makeRow({ _key: 'b', thuTuDoi: 'x' }),
    ]
    const result = sortRowsForDisplay(rows, { field: 'thuTuDoi', direction: 'asc' }, noName)
    expect(result.map(r => r.row._key)).toEqual(['b', 'a'])
  })

  it('sorts date field (namSinh) by year, month, day; undefined is blank', () => {
    const rows = [
      makeRow({ _key: 'a', namSinh: { nam: 1990, thang: 5, ngay: 1 } }),
      makeRow({ _key: 'b', namSinh: undefined }),
      makeRow({ _key: 'c', namSinh: { nam: 1990, thang: 1, ngay: 20 } }),
      makeRow({ _key: 'd', namSinh: { nam: 1980, thang: 12, ngay: 31 } }),
    ]
    const result = sortRowsForDisplay(rows, { field: 'namSinh', direction: 'asc' }, noName)
    expect(result.map(r => r.row._key)).toEqual(['b', 'd', 'c', 'a'])
  })

  it('ranks gioiTinh as nam < nu < khac on ASC, reversed on DESC', () => {
    const rows = [
      makeRow({ _key: 'a', gioiTinh: 'khac' }),
      makeRow({ _key: 'b', gioiTinh: 'nam' }),
      makeRow({ _key: 'c', gioiTinh: 'nu' }),
    ]
    const asc = sortRowsForDisplay(rows, { field: 'gioiTinh', direction: 'asc' }, noName)
    expect(asc.map(r => r.row._key)).toEqual(['b', 'c', 'a'])

    const desc = sortRowsForDisplay(rows, { field: 'gioiTinh', direction: 'desc' }, noName)
    expect(desc.map(r => r.row._key)).toEqual(['a', 'c', 'b'])
  })

  it('ranks laThanhVienHo members-of-family before ngoai toc on ASC', () => {
    const rows = [
      makeRow({ _key: 'a', laThanhVienHo: 'false' }),
      makeRow({ _key: 'b', laThanhVienHo: 'true' }),
    ]
    const result = sortRowsForDisplay(rows, { field: 'laThanhVienHo', direction: 'asc' }, noName)
    expect(result.map(r => r.row._key)).toEqual(['b', 'a'])
  })

  it('sorts boId/meId by resolved display name, not raw id', () => {
    const rows = [
      makeRow({ _key: 'a', boId: 'p1' }),
      makeRow({ _key: 'b', boId: 'p2' }),
      makeRow({ _key: 'c', boId: '' }),
    ]
    const getName = (id: string) => (id === 'p1' ? 'Zed' : id === 'p2' ? 'Anh' : '')
    const result = sortRowsForDisplay(rows, { field: 'boId', direction: 'asc' }, getName)
    expect(result.map(r => r.row._key)).toEqual(['c', 'b', 'a'])
  })

  it('is a stable sort: equal keys keep original relative order', () => {
    const rows = [
      makeRow({ _key: 'a', gioiTinh: 'nam', hoTen: 'First' }),
      makeRow({ _key: 'b', gioiTinh: 'nam', hoTen: 'Second' }),
      makeRow({ _key: 'c', gioiTinh: 'nam', hoTen: 'Third' }),
    ]
    const result = sortRowsForDisplay(rows, { field: 'gioiTinh', direction: 'asc' }, noName)
    expect(result.map(r => r.row._key)).toEqual(['a', 'b', 'c'])
  })
})
