import type { GiaphaData, Person } from '../types/giapha'

export function timVoChong(personId: number, data: GiaphaData): number[] {
  const person = data.persons[personId]
  if (!person) return []
  return person.honNhan.map(h => h.voChongId)
}

/**
 * Given a fatherId, if father has exactly one wife, return her ID.
 * If multiple wives, return null (caller must show dropdown).
 */
export function tuDongDienMe(boId: number, data: GiaphaData): number | null {
  const bo = data.persons[boId]
  if (!bo) return null
  if (bo.honNhan.length === 1) return bo.honNhan[0].voChongId
  return null
}

/**
 * Given a motherId, if mother has exactly one husband, return his ID.
 */
export function tuDongDienBo(meId: number, data: GiaphaData): number | null {
  const me = data.persons[meId]
  if (!me) return null
  if (me.honNhan.length === 1) return me.honNhan[0].voChongId
  return null
}

export function sapXepAnhChiEm(persons: Person[]): Person[] {
  return [...persons].sort((a, b) => {
    if (a.thuTuAnhChi == null && b.thuTuAnhChi == null) return 0
    if (a.thuTuAnhChi == null) return 1
    if (b.thuTuAnhChi == null) return -1
    return a.thuTuAnhChi - b.thuTuAnhChi
  })
}

export function laThanhVienThuocHo(person: Person): boolean {
  // Males are always clan members; females and 'khac' follow the laThanhVienHo flag
  if (person.gioiTinh !== 'nam' && !person.laThanhVienHo) return false
  return true
}

/** Get all children of a person */
export function layConCai(personId: number, data: GiaphaData): Person[] {
  const person = data.persons[personId]
  if (!person) return []
  return person.conCaiIds.map(id => data.persons[id]).filter(Boolean) as Person[]
}

/** Get both parents of a person */
export function layBoCMe(person: Person, data: GiaphaData): { bo?: Person; me?: Person } {
  return {
    bo: person.boId ? data.persons[person.boId] : undefined,
    me: person.meId ? data.persons[person.meId] : undefined,
  }
}
