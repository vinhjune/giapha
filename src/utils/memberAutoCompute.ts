import type { EditableRow } from '../components/MemberManagementView'
import { isNewRow, getChangedFields } from './memberRowDiff'

export interface AutoComputeResult {
  updatedRows: EditableRow[]
  changedCount: number
  warnings: string[]
}

function resolveThuTuDoiCandidate(
  row: EditableRow,
  doiById: Map<string, number>,
  keyById: Map<string, string>,
): number | undefined {
  const boKey = row.boId.trim() ? keyById.get(row.boId.trim()) : undefined
  const meKey = row.meId.trim() ? keyById.get(row.meId.trim()) : undefined
  const boDoi = boKey ? doiById.get(boKey) : undefined
  const meDoi = meKey ? doiById.get(meKey) : undefined

  if (boDoi != null) return boDoi + 1
  if (meDoi != null) return meDoi + 1

  const spouseIds = row.voChongIds.split(';').map(s => s.trim()).filter(Boolean)
  for (const spouseId of spouseIds) {
    const spouseKey = keyById.get(spouseId)
    const spouseDoi = spouseKey ? doiById.get(spouseKey) : undefined
    if (spouseDoi != null) return spouseDoi
  }
  return undefined
}

/**
 * Whole-graph fixed-point propagation of Đời (generation number): parent Đời + 1,
 * falling back to a spouse's Đời when no blood parent is resolvable. Any row whose
 * freshly-computed value differs from its current one is staged (including rows
 * whose ancestor's Đời shifted, not just newly-added/edited rows) — see plan.md's
 * "Đời cascading" decision.
 */
export function computeThuTuDoi(rows: EditableRow[]): AutoComputeResult {
  const warnings: string[] = []
  const doiById = new Map<string, number>()
  const keyById = new Map<string, string>()

  for (const row of rows) {
    const n = Number(row.thuTuDoi)
    if (row.thuTuDoi.trim() && Number.isInteger(n)) doiById.set(row._key, n)
    if (row.id.trim()) keyById.set(row.id.trim(), row._key)
  }

  let changed = true
  let iterations = 0
  const maxIterations = rows.length + 1
  while (changed && iterations < maxIterations) {
    changed = false
    iterations++
    for (const row of rows) {
      const candidate = resolveThuTuDoiCandidate(row, doiById, keyById)
      if (candidate != null && doiById.get(row._key) !== candidate) {
        doiById.set(row._key, candidate)
        changed = true
      }
    }
  }

  if (changed) {
    const unstable = rows
      .filter(row => {
        const candidate = resolveThuTuDoiCandidate(row, doiById, keyById)
        return candidate != null && doiById.get(row._key) !== candidate
      })
      .map(row => row.hoTen || row._key)
    if (unstable.length > 0) {
      warnings.push(`Không thể tính Đời ổn định cho: ${unstable.join(', ')} (có thể do quan hệ vòng lặp trong dữ liệu).`)
    }
  }

  for (const row of rows) {
    const boKey = row.boId.trim() ? keyById.get(row.boId.trim()) : undefined
    const meKey = row.meId.trim() ? keyById.get(row.meId.trim()) : undefined
    const boDoi = boKey ? doiById.get(boKey) : undefined
    const meDoi = meKey ? doiById.get(meKey) : undefined
    if (boDoi != null && meDoi != null && boDoi !== meDoi) {
      warnings.push(`${row.hoTen || row._key}: Đời của bố và mẹ không khớp nhau (đã ưu tiên theo bố).`)
      continue
    }
    if (boDoi == null && meDoi == null) {
      const spouseIds = row.voChongIds.split(';').map(s => s.trim()).filter(Boolean)
      const spouseDois = new Set(
        spouseIds
          .map(id => keyById.get(id))
          .map(key => key ? doiById.get(key) : undefined)
          .filter((v): v is number => v != null),
      )
      if (spouseDois.size > 1) {
        warnings.push(`${row.hoTen || row._key}: Đời của các vợ/chồng không khớp nhau (đã ưu tiên theo người đầu tiên).`)
      }
    }
  }

  let changedCount = 0
  const updatedRows = rows.map(row => {
    const computed = doiById.get(row._key)
    if (computed == null) {
      if (!row.thuTuDoi.trim()) {
        warnings.push(`Không thể tính Đời cho ${row.hoTen || row._key}: thiếu thông tin bố/mẹ hoặc vợ/chồng có Đời.`)
      }
      return row
    }
    const computedStr = String(computed)
    if (row.thuTuDoi === computedStr) return row
    changedCount++
    return { ...row, thuTuDoi: computedStr }
  })

  return { updatedRows, changedCount, warnings }
}

function birthOrderTiebreak(a: EditableRow, b: EditableRow): number {
  const an = a.thuTuAnhChi.trim() ? Number(a.thuTuAnhChi) : null
  const bn = b.thuTuAnhChi.trim() ? Number(b.thuTuAnhChi) : null
  if (an != null && bn != null && an !== bn) return an - bn
  if (an != null && bn == null) return -1
  if (an == null && bn != null) return 1
  return 0 // stable sort preserves current table row order as the final tiebreak
}

function compareBirthOrder(a: EditableRow, b: EditableRow): number {
  const ay = a.namSinh?.nam
  const by = b.namSinh?.nam
  if (ay == null && by == null) return birthOrderTiebreak(a, b)
  if (ay == null) return 1
  if (by == null) return -1
  if (ay !== by) return ay - by
  const am = a.namSinh?.thang ?? 0
  const bm = b.namSinh?.thang ?? 0
  if (am !== bm) return am - bm
  const ad = a.namSinh?.ngay ?? 0
  const bd = b.namSinh?.ngay ?? 0
  if (ad !== bd) return ad - bd
  return birthOrderTiebreak(a, b)
}

/**
 * Recomputes Thứ tự anh/chị (sibling order) for every laThanhVienHo family whose
 * children include at least one "target member" (new / edited this session /
 * missing thuTuAnhChi) — full family recompute, not just the target children, per
 * plan.md's confirmed decision. Ngoại tộc children are excluded entirely.
 */
export function computeThuTuAnhChi(rows: EditableRow[], originalById: Map<string, EditableRow>): AutoComputeResult {
  const originalIds = new Set(originalById.keys())

  const isTargetMember = (row: EditableRow): boolean => {
    if (isNewRow(row, originalIds)) return true
    if (!row.thuTuAnhChi.trim()) return true
    const original = originalById.get(row.id.trim())
    if (!original) return true
    return getChangedFields(row, original).length > 0
  }

  const families = new Map<string, EditableRow[]>()
  for (const row of rows) {
    if (row.laThanhVienHo !== 'true') continue
    if (!row.boId.trim() && !row.meId.trim()) continue
    const key = `${row.boId.trim()}|${row.meId.trim()}`
    const list = families.get(key) ?? []
    list.push(row)
    families.set(key, list)
  }

  const updatedByKey = new Map<string, EditableRow>()
  let changedCount = 0

  for (const children of families.values()) {
    if (!children.some(isTargetMember)) continue

    const sorted = [...children].sort(compareBirthOrder)
    sorted.forEach((row, index) => {
      const order = String(index + 1)
      if (row.thuTuAnhChi !== order) {
        updatedByKey.set(row._key, { ...row, thuTuAnhChi: order })
        changedCount++
      }
    })
  }

  const updatedRows = rows.map(row => updatedByKey.get(row._key) ?? row)
  return { updatedRows, changedCount, warnings: [] }
}
