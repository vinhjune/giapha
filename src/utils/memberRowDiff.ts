import type { EditableRow, RowField, DateRowField, StringRowField } from '../components/MemberManagementView'
import type { NgayThang, Person } from '../types/giapha'

export function personToRow(person: Person): EditableRow {
  return {
    _key: person.id,
    id: person.id,
    hoTen: person.hoTen,
    gioiTinh: person.gioiTinh,
    laThanhVienHo: String(person.laThanhVienHo),
    thuTuDoi: person.thuTuDoi != null ? String(person.thuTuDoi) : '',
    thuTuAnhChi: person.thuTuAnhChi != null ? String(person.thuTuAnhChi) : '',
    namSinh: person.namSinh,
    namMat: person.namMat,
    boId: person.boId ?? '',
    meId: person.meId ?? '',
    voChongIds: person.honNhan.map(h => h.voChongId).join(';'),
    queQuan: person.queQuan ?? '',
    tieuSu: person.tieuSu ?? '',
    email: person.email ?? '',
    soDienThoai: person.soDienThoai ?? '',
    ghiChu: person.ghiChu ?? '',
  }
}

const DATE_FIELDS: DateRowField[] = ['namSinh', 'namMat']

function ngayThangEqual(a: NgayThang | undefined, b: NgayThang | undefined): boolean {
  const normalize = (v: NgayThang | undefined) => ({
    nam: v?.nam, thang: v?.thang, ngay: v?.ngay, amLich: !!v?.amLich,
  })
  const na = normalize(a)
  const nb = normalize(b)
  return na.nam === nb.nam && na.thang === nb.thang && na.ngay === nb.ngay && na.amLich === nb.amLich
}

function voChongIdsEqual(a: string, b: string): boolean {
  const normalize = (s: string) => s.split(';').map(id => id.trim()).filter(Boolean).sort()
  const idsA = normalize(a)
  const idsB = normalize(b)
  if (idsA.length !== idsB.length) return false
  return idsA.every((id, i) => id === idsB[i])
}

export function isNewRow(row: EditableRow, originalIds: Set<string>): boolean {
  const trimmedId = row.id.trim()
  return !trimmedId || !originalIds.has(trimmedId)
}

export function getChangedFields(row: EditableRow, originalRow: EditableRow): RowField[] {
  const changed: RowField[] = []

  for (const field of DATE_FIELDS) {
    if (!ngayThangEqual(row[field], originalRow[field])) changed.push(field)
  }

  const stringFields = Object.keys(originalRow).filter(
    (key): key is StringRowField => key !== '_key' && !(DATE_FIELDS as string[]).includes(key),
  )
  for (const field of stringFields) {
    if (field === 'voChongIds') {
      if (!voChongIdsEqual(row.voChongIds, originalRow.voChongIds)) changed.push(field)
      continue
    }
    if (row[field] !== originalRow[field]) changed.push(field)
  }

  return changed
}
