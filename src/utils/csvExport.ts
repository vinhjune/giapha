import type { GiaphaData, NgayThang, Person } from '../types/giapha'

// ─── Column order — must match csvImport.ts KNOWN_COLS ────────────────────────

const HEADERS = [
  'id', 'hoTen', 'gioiTinh', 'laThanhVienHo', 'thuTuAnhChi',
  'namSinh_nam', 'namSinh_thang', 'namSinh_ngay', 'namSinh_amLich',
  'namMat_nam', 'namMat_thang', 'namMat_ngay', 'namMat_amLich',
  'boId', 'meId', 'voChongIds',
  'queQuan', 'tieuSu', 'anhDaiDien', 'email', 'soDienThoai', 'ghiChu',
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wrap a field in quotes if it contains commas, quotes, or newlines. */
function quoteField(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

function flattenDate(d: NgayThang | undefined): [string, string, string, string] {
  if (!d) return ['', '', '', '']
  const nam = d.nam !== undefined ? String(d.nam) : ''
  const thang = d.thang !== undefined ? String(d.thang) : ''
  const ngay = d.ngay !== undefined ? String(d.ngay) : ''
  const amLich = d.amLich !== undefined ? String(d.amLich) : ''
  return [nam, thang, ngay, amLich]
}

function personToRow(p: Person): string[] {
  const [sNam, sThang, sNgay, sAmLich] = flattenDate(p.namSinh)
  const [mNam, mThang, mNgay, mAmLich] = flattenDate(p.namMat)
  const voChongIds = p.honNhan.map(h => h.voChongId).join(';')

  return [
    String(p.id),
    p.hoTen,
    p.gioiTinh,
    String(p.laThanhVienHo),
    p.thuTuAnhChi !== undefined ? String(p.thuTuAnhChi) : '',
    sNam, sThang, sNgay, sAmLich,
    mNam, mThang, mNgay, mAmLich,
    p.boId !== undefined ? String(p.boId) : '',
    p.meId !== undefined ? String(p.meId) : '',
    voChongIds,
    p.queQuan ?? '',
    p.tieuSu ?? '',
    p.anhDaiDien ?? '',
    p.email ?? '',
    p.soDienThoai ?? '',
    p.ghiChu ?? '',
  ]
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Serialise a GiaphaData object to a CSV string.
 * The output is UTF-8 with a BOM prefix so Excel opens it correctly.
 * Column order matches the import format exactly, enabling lossless round-trips.
 */
export function exportGiaphaToCSV(data: GiaphaData): string {
  const headerLine = HEADERS.join(',')

  const dataLines = Object.values(data.persons)
    .sort((a, b) => a.id - b.id)
    .map(person => personToRow(person).map(quoteField).join(','))

  // BOM (\uFEFF) ensures Excel reads UTF-8 correctly on all platforms
  return '\uFEFF' + [headerLine, ...dataLines].join('\r\n')
}

/**
 * Trigger a file download in the browser.
 */
export function downloadCsv(filename: string, csvText: string): void {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
