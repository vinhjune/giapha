import type { GiaphaData, Person } from '../types/giapha'

export function timVoChong(personId: string, data: GiaphaData): string[] {
  const person = data.persons[personId]
  if (!person) return []
  return person.honNhan.map(h => h.voChongId)
}

/**
 * Given a fatherId, if father has exactly one wife, return her ID.
 * If multiple wives, return null (caller must show dropdown).
 */
export function tuDongDienMe(boId: string, data: GiaphaData): string | null {
  const bo = data.persons[boId]
  if (!bo) return null
  if (bo.honNhan.length === 1) return bo.honNhan[0].voChongId
  return null
}

/**
 * Given a motherId, if mother has exactly one husband, return his ID.
 */
export function tuDongDienBo(meId: string, data: GiaphaData): string | null {
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

export function dinhDangTenNguoi(person: Person, hienThiThuTuDoi: boolean): string {
  if (!hienThiThuTuDoi) return person.hoTen
  if (!Number.isFinite(person.thuTuDoi)) return person.hoTen
  return `${person.hoTen} (#${person.thuTuDoi})`
}

export function timChuTrinhQuanHe(data: GiaphaData): string[][] {
  const persons = data.persons
  const ids = Object.keys(persons)
  const adjacency: Record<string, string[]> = Object.fromEntries(ids.map(id => [id, []]))
  const edgeSet = new Set<string>()

  const themCanh = (fromId: string, toId: string) => {
    if (!persons[fromId] || !persons[toId]) return
    const key = `${fromId}->${toId}`
    if (edgeSet.has(key)) return
    edgeSet.add(key)
    adjacency[fromId].push(toId)
  }

  for (const person of Object.values(persons)) {
    person.conCaiIds.forEach(childId => themCanh(person.id, childId))
  }

  for (const person of Object.values(persons)) {
    if (person.boId) themCanh(person.boId, person.id)
    if (person.meId) themCanh(person.meId, person.id)
  }

  const status: Record<string, 0 | 1 | 2> = Object.fromEntries(ids.map(id => [id, 0]))
  const stack: string[] = []
  const stackPos = new Map<string, number>()
  const cycles: string[][] = []
  const signatures = new Set<string>()

  const themChuTrinh = (chain: string[]) => {
    if (chain.length < 2) return
    const uniquePath = chain.slice(0, -1)
    const minId = uniquePath.reduce((min, id) => (id < min ? id : min), uniquePath[0])
    const startIdx = uniquePath.indexOf(minId)
    const normalized = [
      ...uniquePath.slice(startIdx),
      ...uniquePath.slice(0, startIdx),
      minId,
    ]
    const signature = normalized.join('>')
    if (signatures.has(signature)) return
    signatures.add(signature)
    cycles.push(chain)
  }

  const dfs = (id: string) => {
    status[id] = 1
    stackPos.set(id, stack.length)
    stack.push(id)

    for (const nextId of adjacency[id]) {
      if (status[nextId] === 0) {
        dfs(nextId)
      } else if (status[nextId] === 1) {
        const start = stackPos.get(nextId)
        if (start != null) {
          const cycle = [...stack.slice(start), nextId]
          themChuTrinh(cycle)
        }
      }
    }

    stack.pop()
    stackPos.delete(id)
    status[id] = 2
  }

  for (const id of ids) {
    if (status[id] === 0) dfs(id)
  }

  return cycles
}

export function taoCanhBaoQuanHeVongLap(data: GiaphaData): string[] {
  const cycles = timChuTrinhQuanHe(data)
  return cycles.map(cycle => {
    const names = cycle.map(id => data.persons[id]?.hoTen ?? `#${id}`)
    return `Phát hiện quan hệ vòng lặp: ${names.join(' → ')}`
  })
}

/** Get all children of a person */
export function layConCai(personId: string, data: GiaphaData): Person[] {
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
