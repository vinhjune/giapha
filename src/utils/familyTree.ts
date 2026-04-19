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

export function tinhThuTuDoi(data: GiaphaData): Record<number, number> {
  const persons = data.persons
  const ids = Object.keys(persons).map(Number)
  if (ids.length === 0) return {}

  const spousesById: Record<number, number[]> = {}
  const childrenByParentId: Record<number, number[]> = {}

  const themCon = (parentId: number, childId: number) => {
    if (!persons[parentId] || !persons[childId]) return
    if (!childrenByParentId[parentId]) childrenByParentId[parentId] = []
    if (!childrenByParentId[parentId].includes(childId)) childrenByParentId[parentId].push(childId)
  }

  for (const person of Object.values(persons)) {
    spousesById[person.id] = person.honNhan
      .map(h => h.voChongId)
      .filter(spouseId => Boolean(persons[spouseId]))

    for (const childId of person.conCaiIds) themCon(person.id, childId)
  }

  for (const person of Object.values(persons)) {
    if (person.boId) themCon(person.boId, person.id)
    if (person.meId) themCon(person.meId, person.id)
  }

  const idsKhongCoBoMe = ids.filter(id => {
    const person = persons[id]
    const hasKnownFather = Boolean(person.boId && persons[person.boId])
    const hasKnownMother = Boolean(person.meId && persons[person.meId])
    return !hasKnownFather && !hasKnownMother
  })
  const roots = idsKhongCoBoMe.filter(id => persons[id].laThanhVienHo)

  const generationDistance: Record<number, number> = Object.fromEntries(ids.map(id => [id, Number.POSITIVE_INFINITY]))

  const bfsGenerationTraversal = (seedId: number) => {
    if (!persons[seedId] || generationDistance[seedId] === 0) return
    generationDistance[seedId] = 0
    const deque: number[] = [seedId]

    while (deque.length > 0) {
      const currentId = deque.shift()!
      const currentDist = generationDistance[currentId]

      for (const spouseId of spousesById[currentId] ?? []) {
        if (generationDistance[spouseId] > currentDist) {
          generationDistance[spouseId] = currentDist
          deque.unshift(spouseId)
        }
      }

      for (const childId of childrenByParentId[currentId] ?? []) {
        const childDist = currentDist + 1
        if (generationDistance[childId] > childDist) {
          generationDistance[childId] = childDist
          deque.push(childId)
        }
      }
    }
  }

  const primarySeeds = roots
  const fallbackSeeds = idsKhongCoBoMe
  const lastResortSeed = [Math.min(...ids)]
  const seeds = primarySeeds.length > 0
    ? primarySeeds
    : (fallbackSeeds.length > 0 ? fallbackSeeds : lastResortSeed)
  seeds.forEach(bfsGenerationTraversal)

  for (const id of ids) {
    if (generationDistance[id] !== Number.POSITIVE_INFINITY) continue
    bfsGenerationTraversal(id)
  }

  return Object.fromEntries(ids.map(id => [id, generationDistance[id] + 1]))
}

export function dinhDangTenNguoi(person: Person, thuTuDoiById: Record<number, number>, hienThiThuTuDoi: boolean): string {
  if (!hienThiThuTuDoi) return person.hoTen
  const thuTuDoi = thuTuDoiById[person.id]
  if (!Number.isFinite(thuTuDoi)) return person.hoTen
  return `${person.hoTen} (#${thuTuDoi})`
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
