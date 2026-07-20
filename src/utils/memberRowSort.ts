import type { EditableRow, RowField } from '../components/MemberManagementView'

export type SortDirection = 'asc' | 'desc'
export type SortState = { field: RowField; direction: SortDirection } | null

export interface IndexedRow {
  row: EditableRow
  originalIndex: number
}

/** All columns except 'voChongIds' (multi-value, no meaningful sort order). */
export const SORTABLE_FIELDS: ReadonlySet<RowField> = new Set<RowField>([
  'id', 'hoTen', 'gioiTinh', 'laThanhVienHo', 'thuTuDoi', 'thuTuAnhChi',
  'namSinh', 'namMat', 'boId', 'meId',
  'queQuan', 'tieuSu', 'email', 'soDienThoai', 'ghiChu',
])

const GIOI_TINH_RANK: Record<string, number> = { nam: 0, nu: 1, khac: 2 }
const LA_THANH_VIEN_HO_RANK: Record<string, number> = { true: 0, false: 1 }

type SortKey = string | number | null

function getSortKey(row: EditableRow, field: RowField, getName: (id: string) => string): SortKey {
  switch (field) {
    case 'gioiTinh':
      return GIOI_TINH_RANK[row.gioiTinh] ?? null
    case 'laThanhVienHo':
      return LA_THANH_VIEN_HO_RANK[row.laThanhVienHo] ?? null
    case 'thuTuDoi':
    case 'thuTuAnhChi': {
      const trimmed = row[field].trim()
      if (!trimmed) return null
      const n = Number(trimmed)
      return Number.isFinite(n) ? n : null
    }
    case 'namSinh':
    case 'namMat': {
      const value = row[field]
      if (!value || value.nam == null) return null
      return value.nam * 10000 + (value.thang ?? 0) * 100 + (value.ngay ?? 0)
    }
    case 'boId':
    case 'meId': {
      const id = row[field].trim()
      if (!id) return null
      return getName(id) || id
    }
    default: {
      const trimmed = row[field].trim()
      return trimmed || null
    }
  }
}

function compareSortKeys(a: SortKey, b: SortKey): number {
  if (a === null && b === null) return 0
  if (a === null) return -1
  if (b === null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'vi', { sensitivity: 'base', numeric: true })
}

/**
 * Returns rows in display order for the given sort state, pairing each with its
 * originalIndex so callers can keep mutating the underlying `rows` array by its
 * real position (edit handlers, autocompute tie-breaks, etc. depend on that order
 * staying untouched). Array.prototype.sort is stable (ES2019+), so equal keys keep
 * their original relative order.
 */
export function sortRowsForDisplay(
  rows: EditableRow[],
  sortState: SortState,
  getName: (id: string) => string,
): IndexedRow[] {
  const indexed = rows.map((row, originalIndex) => ({ row, originalIndex }))
  if (!sortState) return indexed

  const { field, direction } = sortState
  const dir = direction === 'asc' ? 1 : -1
  return [...indexed].sort((a, b) => {
    const ka = getSortKey(a.row, field, getName)
    const kb = getSortKey(b.row, field, getName)
    return compareSortKeys(ka, kb) * dir
  })
}
