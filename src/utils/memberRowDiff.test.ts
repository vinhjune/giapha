import { describe, expect, it } from 'vitest'
import { isNewRow, getChangedFields } from './memberRowDiff'
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

describe('isNewRow', () => {
  it('is true for a row with empty id', () => {
    expect(isNewRow(makeRow({ id: '' }), new Set(['1']))).toBe(true)
  })

  it('is true for a row whose id is not in originalIds', () => {
    expect(isNewRow(makeRow({ id: '2' }), new Set(['1']))).toBe(true)
  })

  it('is false for a row whose id is in originalIds', () => {
    expect(isNewRow(makeRow({ id: '1' }), new Set(['1']))).toBe(false)
  })
})

describe('getChangedFields', () => {
  it('returns [] for two identical rows', () => {
    expect(getChangedFields(makeRow(), makeRow())).toEqual([])
  })

  it('detects a changed plain string field', () => {
    expect(getChangedFields(makeRow({ hoTen: 'Người B' }), makeRow())).toContain('hoTen')
  })

  it('does not flag namSinh when both sides represent no date via different shapes', () => {
    const a = makeRow({ namSinh: undefined })
    const b = makeRow({ namSinh: { nam: undefined, thang: undefined, ngay: undefined, amLich: undefined } })
    expect(getChangedFields(a, b)).not.toContain('namSinh')
  })

  it('flags namSinh when amLich differs but year/month/day match', () => {
    const a = makeRow({ namSinh: { nam: 1954, amLich: true } })
    const b = makeRow({ namSinh: { nam: 1954, amLich: false } })
    expect(getChangedFields(a, b)).toContain('namSinh')
  })

  it('does not flag voChongIds when the same ids appear in a different order', () => {
    const a = makeRow({ voChongIds: 'x;y' })
    const b = makeRow({ voChongIds: 'y;x' })
    expect(getChangedFields(a, b)).not.toContain('voChongIds')
  })

  it('flags voChongIds when the set of ids differs', () => {
    const a = makeRow({ voChongIds: 'x;y' })
    const b = makeRow({ voChongIds: 'x' })
    expect(getChangedFields(a, b)).toContain('voChongIds')
  })
})
