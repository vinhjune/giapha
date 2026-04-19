import type { GiaphaData, GioiTinh, Metadata, NgayThang, Person } from '../types/giapha'

// ─── Public types ─────────────────────────────────────────────────────────────

export type ImportIssueLevel = 'error' | 'warning' | 'auto-fix'

export interface ImportIssue {
  level: ImportIssueLevel
  code: string
  message: string
  rowNumber?: number
  personId?: number
  columnName?: string
}

export interface ImportStats {
  totalRows: number
  parsedRows: number
  personCount: number
  marriageLinksInput: number
  marriageLinksBuilt: number
  childrenLinksBuilt: number
}

export interface ImportResult {
  /** Present only when there are no blocking errors */
  data?: GiaphaData
  stats: ImportStats
  warnings: ImportIssue[]
  errors: ImportIssue[]
}

// ─── CSV canonical header ─────────────────────────────────────────────────────

const REQUIRED_COLS = ['id', 'hoTen', 'gioiTinh'] as const
const KNOWN_COLS = new Set([
  'id', 'hoTen', 'gioiTinh', 'email', 'soDienThoai',
  'namSinh_nam', 'namSinh_thang', 'namSinh_ngay', 'namSinh_amLich',
  'namMat_nam', 'namMat_thang', 'namMat_ngay', 'namMat_amLich',
  'queQuan', 'tieuSu', 'anhDaiDien',
  'laThanhVienHo', 'thuTuAnhChi',
  'boId', 'meId', 'voChongIds', 'ghiChu',
  'conCaiIds', // audit-only, not used as source
])

// ─── Internal helpers ─────────────────────────────────────────────────────────

function parseCsvRows(csvText: string): string[][] {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const rows: string[][] = []
  for (const line of lines) {
    if (!line.trim()) continue
    rows.push(splitCsvLine(line))
  }
  return rows
}

/** Minimal RFC 4180-compatible CSV line splitter (handles quoted fields). */
function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuote = false
      else cur += ch
    } else {
      if (ch === '"') inQuote = true
      else if (ch === ',') { fields.push(cur.trim()); cur = '' }
      else cur += ch
    }
  }
  fields.push(cur.trim())
  return fields
}

function str(v: string): string | undefined {
  const t = v.trim()
  return t === '' ? undefined : t
}

function parseBool(v: string): boolean | undefined {
  const t = v.trim().toLowerCase()
  if (t === '' || t == null) return undefined
  if (['true', '1', 'yes', 'đúng', 'co'].includes(t)) return true
  if (['false', '0', 'no', 'sai', 'khong'].includes(t)) return false
  return undefined
}

function parseDateGroup(
  rowMap: Map<string, string>,
  prefix: string,
  rowNum: number,
  issues: ImportIssue[],
): NgayThang | undefined {
  const namStr = rowMap.get(`${prefix}_nam`) ?? ''
  const thangStr = rowMap.get(`${prefix}_thang`) ?? ''
  const ngayStr = rowMap.get(`${prefix}_ngay`) ?? ''
  const amLichStr = rowMap.get(`${prefix}_amLich`) ?? ''

  if (!namStr && !thangStr && !ngayStr) return undefined

  const result: NgayThang = {}
  if (namStr) {
    const n = Number(namStr.trim())
    if (!Number.isInteger(n)) {
      issues.push({ level: 'warning', code: 'INVALID_BIRTH_DATE_PART',
        message: `Dòng ${rowNum}: ${prefix}_nam "${namStr}" không phải số nguyên, bỏ qua.`,
        rowNumber: rowNum, columnName: `${prefix}_nam` })
    } else {
      result.nam = n
    }
  }
  if (thangStr) {
    const n = Number(thangStr.trim())
    if (!Number.isInteger(n)) {
      issues.push({ level: 'warning', code: 'INVALID_BIRTH_DATE_PART',
        message: `Dòng ${rowNum}: ${prefix}_thang "${thangStr}" không phải số nguyên, bỏ qua.`,
        rowNumber: rowNum, columnName: `${prefix}_thang` })
    } else {
      if (n < 1 || n > 12)
        issues.push({ level: 'warning', code: 'UNUSUAL_DATE_VALUE',
          message: `Dòng ${rowNum}: ${prefix}_thang = ${n} nằm ngoài phạm vi 1-12.`,
          rowNumber: rowNum, columnName: `${prefix}_thang` })
      result.thang = n
    }
  }
  if (ngayStr) {
    const n = Number(ngayStr.trim())
    if (!Number.isInteger(n)) {
      issues.push({ level: 'warning', code: 'INVALID_BIRTH_DATE_PART',
        message: `Dòng ${rowNum}: ${prefix}_ngay "${ngayStr}" không phải số nguyên, bỏ qua.`,
        rowNumber: rowNum, columnName: `${prefix}_ngay` })
    } else {
      if (n < 1 || n > 31)
        issues.push({ level: 'warning', code: 'UNUSUAL_DATE_VALUE',
          message: `Dòng ${rowNum}: ${prefix}_ngay = ${n} nằm ngoài phạm vi 1-31.`,
          rowNumber: rowNum, columnName: `${prefix}_ngay` })
      result.ngay = n
    }
  }
  const amLich = parseBool(amLichStr)
  if (amLich !== undefined) result.amLich = amLich

  return Object.keys(result).length > 0 ? result : undefined
}

// ─── Phase 1: Parse rows ──────────────────────────────────────────────────────

interface ParsedRow {
  rowNumber: number
  id: number
  hoTen: string
  gioiTinh: GioiTinh
  email?: string
  soDienThoai?: string
  namSinh?: NgayThang
  namMat?: NgayThang
  queQuan?: string
  tieuSu?: string
  anhDaiDien?: string
  laThanhVienHo: boolean
  thuTuAnhChi?: number
  boId?: number
  meId?: number
  voChongIds: number[]
  ghiChu?: string
}

function parseRows(
  headers: string[],
  dataRows: string[][],
  issues: ImportIssue[],
): ParsedRow[] {
  const colIndex = new Map<string, number>()
  headers.forEach((h, i) => colIndex.set(h.trim(), i))

  // Warn about unknown columns (except conCaiIds which is explicitly allowed as audit)
  for (const h of headers) {
    const name = h.trim()
    if (!KNOWN_COLS.has(name) && name !== '') {
      issues.push({ level: 'warning', code: 'UNKNOWN_COLUMN_IGNORED',
        message: `Cột "${name}" không thuộc schema chuẩn, sẽ bị bỏ qua.`,
        columnName: name })
    }
  }

  const get = (row: string[], col: string): string => {
    const i = colIndex.get(col)
    return i != null && i < row.length ? row[i] : ''
  }

  const results: ParsedRow[] = []
  const seenIds = new Map<number, number>() // id → first rowNumber

  for (let ri = 0; ri < dataRows.length; ri++) {
    const row = dataRows[ri]
    const rowNum = ri + 2 // 1-based, row 1 is header
    const rowMap = new Map<string, string>(headers.map((h, i) => [h.trim(), row[i] ?? '']))

    // Required: id
    const idStr = get(row, 'id')
    if (!idStr.trim()) {
      issues.push({ level: 'error', code: 'EMPTY_ID',
        message: `Dòng ${rowNum}: cột "id" bị trống.`, rowNumber: rowNum, columnName: 'id' })
      continue
    }
    const idRaw = Number(idStr.trim())
    if (!Number.isInteger(idRaw) || idRaw <= 0) {
      issues.push({ level: 'error', code: 'INVALID_ID',
        message: `Dòng ${rowNum}: id "${idStr.trim()}" không phải số nguyên dương.`,
        rowNumber: rowNum, columnName: 'id' })
      continue
    }
    const id = idRaw

    if (seenIds.has(id)) {
      issues.push({ level: 'error', code: 'DUPLICATE_ID',
        message: `Dòng ${rowNum}: id ${id} đã xuất hiện ở dòng ${seenIds.get(id)}.`,
        rowNumber: rowNum, personId: id, columnName: 'id' })
      // Still collect but mark; will be excluded from result later
    } else {
      seenIds.set(id, rowNum)
    }

    // Required: hoTen
    const hoTen = str(get(row, 'hoTen'))
    if (!hoTen) {
      issues.push({ level: 'error', code: 'EMPTY_NAME',
        message: `Dòng ${rowNum} (id=${id}): cột "hoTen" bị trống.`,
        rowNumber: rowNum, personId: id, columnName: 'hoTen' })
      continue
    }

    // Required: gioiTinh
    const gioiTinhRaw = get(row, 'gioiTinh').trim().toLowerCase()
    if (!['nam', 'nu', 'khac'].includes(gioiTinhRaw)) {
      issues.push({ level: 'error', code: 'INVALID_GENDER',
        message: `Dòng ${rowNum} (id=${id}): gioiTinh "${gioiTinhRaw}" không hợp lệ (nam/nu/khac).`,
        rowNumber: rowNum, personId: id, columnName: 'gioiTinh' })
      continue
    }
    const gioiTinh = gioiTinhRaw as GioiTinh

    // laThanhVienHo — default true; respect whatever the CSV says for both genders
    const laThanhVienHoRaw = parseBool(get(row, 'laThanhVienHo'))
    const laThanhVienHo = laThanhVienHoRaw ?? true

    // Optional numeric: thuTuAnhChi
    let thuTuAnhChi: number | undefined
    const thuTuStr = get(row, 'thuTuAnhChi').trim()
    if (thuTuStr) {
      const n = Number(thuTuStr)
      if (!Number.isInteger(n) || n < 1) {
        issues.push({ level: 'warning', code: 'INVALID_SIBLING_ORDER_IGNORED',
          message: `Dòng ${rowNum} (id=${id}): thuTuAnhChi "${thuTuStr}" không hợp lệ, bỏ qua.`,
          rowNumber: rowNum, personId: id, columnName: 'thuTuAnhChi' })
      } else {
        thuTuAnhChi = n
      }
    }

    // Optional FK: boId, meId
    const boIdStr = get(row, 'boId').trim()
    let boId: number | undefined
    if (boIdStr) {
      const n = Number(boIdStr)
      if (!Number.isInteger(n) || n <= 0) {
        issues.push({ level: 'error', code: 'INVALID_PARENT_ID',
          message: `Dòng ${rowNum} (id=${id}): boId "${boIdStr}" không phải số nguyên dương.`,
          rowNumber: rowNum, personId: id, columnName: 'boId' })
      } else {
        boId = n
      }
    }

    const meIdStr = get(row, 'meId').trim()
    let meId: number | undefined
    if (meIdStr) {
      const n = Number(meIdStr)
      if (!Number.isInteger(n) || n <= 0) {
        issues.push({ level: 'error', code: 'INVALID_PARENT_ID',
          message: `Dòng ${rowNum} (id=${id}): meId "${meIdStr}" không phải số nguyên dương.`,
          rowNumber: rowNum, personId: id, columnName: 'meId' })
      } else {
        meId = n
      }
    }

    // Self-reference checks for boId/meId
    if (boId === id) {
      issues.push({ level: 'error', code: 'SELF_PARENT_REFERENCE',
        message: `Dòng ${rowNum} (id=${id}): boId không được trỏ vào chính mình.`,
        rowNumber: rowNum, personId: id, columnName: 'boId' })
      boId = undefined
    }
    if (meId === id) {
      issues.push({ level: 'error', code: 'SELF_PARENT_REFERENCE',
        message: `Dòng ${rowNum} (id=${id}): meId không được trỏ vào chính mình.`,
        rowNumber: rowNum, personId: id, columnName: 'meId' })
      meId = undefined
    }

    // voChongIds — semicolon-separated
    const voChongStr = get(row, 'voChongIds').trim()
    const voChongIds: number[] = []
    if (voChongStr) {
      for (const token of voChongStr.split(';')) {
        const t = token.trim()
        if (!t) continue
        const n = Number(t)
        if (!Number.isInteger(n) || n <= 0) {
          issues.push({ level: 'error', code: 'INVALID_SPOUSE_ID',
            message: `Dòng ${rowNum} (id=${id}): voChongIds chứa giá trị không hợp lệ "${t}".`,
            rowNumber: rowNum, personId: id, columnName: 'voChongIds' })
        } else if (n === id) {
          issues.push({ level: 'error', code: 'SELF_SPOUSE_REFERENCE',
            message: `Dòng ${rowNum} (id=${id}): không thể là vợ/chồng của chính mình.`,
            rowNumber: rowNum, personId: id, columnName: 'voChongIds' })
        } else {
          voChongIds.push(n)
        }
      }
    }

    // Dates
    const namSinh = parseDateGroup(rowMap, 'namSinh', rowNum, issues)
    const namMat = parseDateGroup(rowMap, 'namMat', rowNum, issues)

    results.push({
      rowNumber: rowNum,
      id,
      hoTen,
      gioiTinh,
      email: str(get(row, 'email')),
      soDienThoai: str(get(row, 'soDienThoai')),
      namSinh,
      namMat,
      queQuan: str(get(row, 'queQuan')),
      tieuSu: str(get(row, 'tieuSu')),
      anhDaiDien: str(get(row, 'anhDaiDien')),
      laThanhVienHo,
      thuTuAnhChi,
      boId,
      meId,
      voChongIds,
      ghiChu: str(get(row, 'ghiChu')),
    })
  }

  return results
}

// ─── Phase 2: Reference resolution ───────────────────────────────────────────

function resolveRefs(rows: ParsedRow[], issues: ImportIssue[]): ParsedRow[] {
  const ids = new Set(rows.map(r => r.id))

  for (const row of rows) {
    if (row.boId !== undefined && !ids.has(row.boId)) {
      issues.push({ level: 'error', code: 'UNKNOWN_PARENT_REFERENCE',
        message: `Dòng ${row.rowNumber} (id=${row.id}): boId ${row.boId} không tồn tại trong file.`,
        rowNumber: row.rowNumber, personId: row.id, columnName: 'boId' })
      row.boId = undefined
    }
    if (row.meId !== undefined && !ids.has(row.meId)) {
      issues.push({ level: 'error', code: 'UNKNOWN_PARENT_REFERENCE',
        message: `Dòng ${row.rowNumber} (id=${row.id}): meId ${row.meId} không tồn tại trong file.`,
        rowNumber: row.rowNumber, personId: row.id, columnName: 'meId' })
      row.meId = undefined
    }

    // Validate spouse references exist
    const validSpouses: number[] = []
    for (const sId of row.voChongIds) {
      if (!ids.has(sId)) {
        issues.push({ level: 'error', code: 'UNKNOWN_SPOUSE_REFERENCE',
          message: `Dòng ${row.rowNumber} (id=${row.id}): voChongIds chứa id ${sId} không tồn tại.`,
          rowNumber: row.rowNumber, personId: row.id, columnName: 'voChongIds' })
      } else {
        validSpouses.push(sId)
      }
    }
    row.voChongIds = validSpouses

    // Business warnings (do not block)
    const boRow = rows.find(r => r.id === row.boId)
    if (boRow && boRow.gioiTinh !== 'nam') {
      issues.push({ level: 'warning', code: 'FATHER_GENDER_MISMATCH',
        message: `Dòng ${row.rowNumber} (id=${row.id}): boId ${row.boId} không phải nam giới.`,
        rowNumber: row.rowNumber, personId: row.id })
    }
    const meRow = rows.find(r => r.id === row.meId)
    if (meRow && meRow.gioiTinh !== 'nu') {
      issues.push({ level: 'warning', code: 'MOTHER_GENDER_MISMATCH',
        message: `Dòng ${row.rowNumber} (id=${row.id}): meId ${row.meId} không phải nữ giới.`,
        rowNumber: row.rowNumber, personId: row.id })
    }
    if (row.boId !== undefined && row.boId === row.meId) {
      issues.push({ level: 'warning', code: 'SAME_FATHER_AND_MOTHER',
        message: `Dòng ${row.rowNumber} (id=${row.id}): boId và meId cùng trỏ tới ${row.boId}.`,
        rowNumber: row.rowNumber, personId: row.id })
    }
  }

  return rows
}

// ─── Phase 3-5: Build runtime data ───────────────────────────────────────────

function buildPersons(rows: ParsedRow[], issues: ImportIssue[]): Record<string, Person> {
  const persons: Record<string, Person> = {}

  // Phase 3: init persons (no honNhan/conCaiIds yet)
  for (const row of rows) {
    persons[row.id] = {
      id: row.id,
      hoTen: row.hoTen,
      gioiTinh: row.gioiTinh,
      email: row.email,
      soDienThoai: row.soDienThoai,
      namSinh: row.namSinh,
      namMat: row.namMat,
      queQuan: row.queQuan,
      tieuSu: row.tieuSu,
      anhDaiDien: row.anhDaiDien,
      laThanhVienHo: row.laThanhVienHo,
      thuTuAnhChi: row.thuTuAnhChi,
      boId: row.boId,
      meId: row.meId,
      honNhan: [],
      conCaiIds: [],
      ghiChu: row.ghiChu,
    }
  }

  // Phase 4: build honNhan bidirectionally
  // canonical key = `min-max` to detect pairs already processed
  const processedPairs = new Set<string>()
  let marriageLinksInput = 0
  let marriageLinksBuilt = 0

  for (const row of rows) {
    for (const sId of row.voChongIds) {
      marriageLinksInput++
      const pairKey = `${Math.min(row.id, sId)}-${Math.max(row.id, sId)}`

      // Check if reverse link was declared by the other side
      const sRow = rows.find(r => r.id === sId)
      const hasReverse = sRow?.voChongIds.includes(row.id) ?? false
      if (!hasReverse) {
        issues.push({ level: 'auto-fix', code: 'MISSING_REVERSE_SPOUSE_LINK',
          message: `id=${row.id} khai vợ/chồng ${sId} nhưng ${sId} không khai lại — đã tự bổ sung liên kết ngược.`,
          personId: row.id })
      }

      if (processedPairs.has(pairKey)) continue
      processedPairs.add(pairKey)

      // Add to both sides
      if (persons[row.id] && !persons[row.id].honNhan.some(h => h.voChongId === sId)) {
        persons[row.id].honNhan.push({ voChongId: sId })
        marriageLinksBuilt++
      }
      if (persons[sId] && !persons[sId].honNhan.some(h => h.voChongId === row.id)) {
        persons[sId].honNhan.push({ voChongId: row.id })
        marriageLinksBuilt++
      }
    }
  }

  // Phase 5: rebuild conCaiIds from boId/meId
  let childrenLinksBuilt = 0
  for (const row of rows) {
    if (row.boId !== undefined && persons[row.boId]) {
      if (!persons[row.boId].conCaiIds.includes(row.id)) {
        persons[row.boId].conCaiIds.push(row.id)
        childrenLinksBuilt++
      }
    }
    if (row.meId !== undefined && persons[row.meId]) {
      if (!persons[row.meId].conCaiIds.includes(row.id)) {
        persons[row.meId].conCaiIds.push(row.id)
        childrenLinksBuilt++
      }
    }
  }

  return persons
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Parse a single CSV file into GiaphaData.
 * @param csvText   Raw CSV string (UTF-8, comma-separated, RFC 4180 quoting).
 * @param existingMetadata  Metadata from the current session; kept unchanged.
 */
export function importSingleCsvToGiapha(
  csvText: string,
  existingMetadata: Metadata,
): ImportResult {
  const issues: ImportIssue[] = []
  const stats: ImportStats = {
    totalRows: 0,
    parsedRows: 0,
    personCount: 0,
    marriageLinksInput: 0,
    marriageLinksBuilt: 0,
    childrenLinksBuilt: 0,
  }

  // Parse CSV
  const allRows = parseCsvRows(csvText)
  if (allRows.length < 2) {
    issues.push({ level: 'error', code: 'MISSING_REQUIRED_COLUMN',
      message: 'File CSV cần ít nhất 1 dòng header và 1 dòng dữ liệu.' })
    return { stats, warnings: [], errors: issues }
  }

  const headers = allRows[0]
  const dataRows = allRows.slice(1)
  stats.totalRows = dataRows.length

  // Check required columns exist
  for (const col of REQUIRED_COLS) {
    if (!headers.map(h => h.trim()).includes(col)) {
      issues.push({ level: 'error', code: 'MISSING_REQUIRED_COLUMN',
        message: `File CSV thiếu cột bắt buộc: "${col}".`, columnName: col })
    }
  }
  if (issues.some(i => i.level === 'error')) {
    return { stats, warnings: [], errors: issues }
  }

  // Phase 1: parse rows
  const parsed = parseRows(headers, dataRows, issues)
  stats.parsedRows = parsed.length

  // Remove rows with duplicate IDs (keep only first occurrence)
  const dupeIds = new Set(
    issues
      .filter(i => i.code === 'DUPLICATE_ID' && i.personId != null)
      .map(i => i.personId!)
  )
  const validRows = parsed.filter(r => !dupeIds.has(r.id))

  // Phase 2: resolve references (mutates rows in place, may add more errors)
  resolveRefs(validRows, issues)

  const errors = issues.filter(i => i.level === 'error')
  const warnings = issues.filter(i => i.level !== 'error')

  if (errors.length > 0) {
    return { stats, warnings, errors }
  }

  // Phase 3-5: build runtime
  const persons = buildPersons(validRows, warnings)

  stats.personCount = Object.keys(persons).length
  // Count stats from what was built
  let marriageLinksInput = 0
  let marriageLinksBuilt = 0
  let childrenLinksBuilt = 0
  for (const row of validRows) {
    marriageLinksInput += row.voChongIds.length
  }
  for (const p of Object.values(persons)) {
    marriageLinksBuilt += p.honNhan.length
    childrenLinksBuilt += p.conCaiIds.length
  }
  stats.marriageLinksInput = marriageLinksInput
  stats.marriageLinksBuilt = marriageLinksBuilt
  stats.childrenLinksBuilt = childrenLinksBuilt

  const data: GiaphaData = { metadata: existingMetadata, persons }
  return { data, stats, warnings, errors: [] }
}
