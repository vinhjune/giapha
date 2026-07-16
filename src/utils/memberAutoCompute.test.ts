import { describe, expect, it } from 'vitest'
import { computeThuTuDoi, computeThuTuAnhChi } from './memberAutoCompute'
import type { EditableRow } from '../components/MemberManagementView'

function makeRow(overrides: Partial<EditableRow> = {}): EditableRow {
  return {
    _key: overrides.id || '1',
    id: '1',
    hoTen: 'Người A',
    gioiTinh: 'nam',
    laThanhVienHo: 'true',
    thuTuDoi: '',
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

describe('computeThuTuDoi', () => {
  it('computes a child Đời as parent Đời + 1', () => {
    const bo = makeRow({ id: 'bo', hoTen: 'Bố', thuTuDoi: '1' })
    const con = makeRow({ id: 'con', hoTen: 'Con', boId: 'bo' })
    const result = computeThuTuDoi([bo, con])

    const updatedCon = result.updatedRows.find(r => r.id === 'con')!
    expect(updatedCon.thuTuDoi).toBe('2')
    expect(result.warnings).toEqual([])
  })

  it('falls back to spouse Đời for a member with no blood parent', () => {
    const bloodMember = makeRow({ id: 'a', hoTen: 'A', thuTuDoi: '3' })
    const marriedIn = makeRow({ id: 'b', hoTen: 'B (dâu)', voChongIds: 'a', laThanhVienHo: 'false' })
    const result = computeThuTuDoi([bloodMember, marriedIn])

    const updatedSpouse = result.updatedRows.find(r => r.id === 'b')!
    expect(updatedSpouse.thuTuDoi).toBe('3')
  })

  it('warns and leaves blank when a member has no parent, spouse, or existing Đời', () => {
    const orphan = makeRow({ id: 'orphan', hoTen: 'Người cô lập' })
    const result = computeThuTuDoi([orphan])

    expect(result.updatedRows[0].thuTuDoi).toBe('')
    expect(result.warnings.some(w => w.includes('Người cô lập'))).toBe(true)
  })

  it('leaves an existing root Đời untouched when there is no parent or spouse basis', () => {
    const root = makeRow({ id: 'root', hoTen: 'Cụ tổ', thuTuDoi: '1' })
    const result = computeThuTuDoi([root])

    expect(result.updatedRows[0].thuTuDoi).toBe('1')
    expect(result.changedCount).toBe(0)
    expect(result.warnings).toEqual([])
  })

  it('overwrites a manually-typed Đời that disagrees with the parent-derived value', () => {
    const bo = makeRow({ id: 'bo', hoTen: 'Bố', thuTuDoi: '3' })
    const con = makeRow({ id: 'con', hoTen: 'Con', boId: 'bo', thuTuDoi: '5' })
    const result = computeThuTuDoi([bo, con])

    expect(result.updatedRows.find(r => r.id === 'con')!.thuTuDoi).toBe('4')
  })

  it('cascades when a new senior ancestor is reparented above an existing root', () => {
    // Old root previously had Đời=1 with no parent. A newly-discovered senior
    // ancestor is added (Đời=1, still no parent) and the old root is reparented to them.
    const newAncestor = makeRow({ id: 'newAncestor', hoTen: 'Cụ tổ mới', thuTuDoi: '1' })
    const oldRoot = makeRow({ id: 'oldRoot', hoTen: 'Cụ tổ cũ', thuTuDoi: '1', boId: 'newAncestor' })
    const grandchild = makeRow({ id: 'grandchild', hoTen: 'Cháu', boId: 'oldRoot', thuTuDoi: '2' })

    const result = computeThuTuDoi([newAncestor, oldRoot, grandchild])

    expect(result.updatedRows.find(r => r.id === 'newAncestor')!.thuTuDoi).toBe('1')
    expect(result.updatedRows.find(r => r.id === 'oldRoot')!.thuTuDoi).toBe('2')
    expect(result.updatedRows.find(r => r.id === 'grandchild')!.thuTuDoi).toBe('3')
  })

  it('prefers boId and warns when boId/meId Đời disagree', () => {
    const bo = makeRow({ id: 'bo', hoTen: 'Bố', thuTuDoi: '3' })
    const me = makeRow({ id: 'me', hoTen: 'Mẹ', thuTuDoi: '5' })
    const con = makeRow({ id: 'con', hoTen: 'Con', boId: 'bo', meId: 'me' })
    const result = computeThuTuDoi([bo, me, con])

    expect(result.updatedRows.find(r => r.id === 'con')!.thuTuDoi).toBe('4')
    expect(result.warnings.some(w => w.includes('Con'))).toBe(true)
  })

  it('warns when multiple spouses have conflicting known Đời', () => {
    const spouse1 = makeRow({ id: 's1', hoTen: 'Vợ 1', thuTuDoi: '2' })
    const spouse2 = makeRow({ id: 's2', hoTen: 'Vợ 2', thuTuDoi: '4' })
    const member = makeRow({ id: 'm', hoTen: 'Chồng', voChongIds: 's1;s2' })
    const result = computeThuTuDoi([spouse1, spouse2, member])

    expect(result.updatedRows.find(r => r.id === 'm')!.thuTuDoi).toBe('2')
    expect(result.warnings.some(w => w.includes('Chồng'))).toBe(true)
  })
})

describe('computeThuTuAnhChi', () => {
  it('recomputes the whole family by birth year when one child is a target member', () => {
    const c1 = makeRow({ id: 'c1', hoTen: 'Cả', boId: 'bo', meId: 'me', thuTuAnhChi: '1', namSinh: { nam: 1980 } })
    const c2 = makeRow({ id: 'c2', hoTen: 'Hai', boId: 'bo', meId: 'me', thuTuAnhChi: '2', namSinh: { nam: 1982 } })
    // Newly added third child, born between c1 and c2 — should shift the whole family's order.
    const c3 = makeRow({ id: '', _key: 'new-1', hoTen: 'Út', boId: 'bo', meId: 'me', namSinh: { nam: 1981 } })

    const originalById = new Map([
      ['c1', c1],
      ['c2', c2],
    ])
    const result = computeThuTuAnhChi([c1, c2, c3], originalById)

    expect(result.updatedRows.find(r => r._key === 'c1')!.thuTuAnhChi).toBe('1')
    expect(result.updatedRows.find(r => r._key === 'new-1')!.thuTuAnhChi).toBe('2')
    expect(result.updatedRows.find(r => r._key === 'c2')!.thuTuAnhChi).toBe('3')
  })

  it('leaves a family untouched when it has no target member', () => {
    const c1 = makeRow({ id: 'c1', hoTen: 'Cả', boId: 'bo', meId: 'me', thuTuAnhChi: '2', namSinh: { nam: 1980 } })
    const c2 = makeRow({ id: 'c2', hoTen: 'Hai', boId: 'bo', meId: 'me', thuTuAnhChi: '1', namSinh: { nam: 1982 } })
    const originalById = new Map([
      ['c1', c1],
      ['c2', c2],
    ])
    const result = computeThuTuAnhChi([c1, c2], originalById)

    // Even though birth-year order would swap these, neither is a target member (both
    // already have thuTuAnhChi set and unchanged), so the family is left alone.
    expect(result.updatedRows.find(r => r.id === 'c1')!.thuTuAnhChi).toBe('2')
    expect(result.updatedRows.find(r => r.id === 'c2')!.thuTuAnhChi).toBe('1')
    expect(result.changedCount).toBe(0)
  })

  it('never assigns a sibling order to ngoại tộc children', () => {
    const bloodChild = makeRow({ id: 'c1', hoTen: 'Con ruột', boId: 'bo', meId: 'me', namSinh: { nam: 1980 } })
    const ngoaiTocChild = makeRow({
      id: 'c2', hoTen: 'Cháu ngoại', boId: 'bo', meId: 'me', laThanhVienHo: 'false', namSinh: { nam: 1978 },
    })
    const originalById = new Map<string, EditableRow>()
    const result = computeThuTuAnhChi([bloodChild, ngoaiTocChild], originalById)

    expect(result.updatedRows.find(r => r.id === 'c1')!.thuTuAnhChi).toBe('1')
    expect(result.updatedRows.find(r => r.id === 'c2')!.thuTuAnhChi).toBe('')
  })
})
