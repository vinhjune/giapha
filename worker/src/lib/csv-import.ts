// Ported from giaphadongho packages/api/src/utils/csv-import.ts — same parsing,
// validation and field coercion, so a giaphadongho export imports cleanly here.
// giapha has no `users` table, so userLinks are parsed (for tolerance of
// giaphadongho export files) but never persisted.
import Papa from 'papaparse'
import { UNIFIED_CSV_HEADERS, CSV_COLUMN_FIELDS } from './csv-schema'
import type { CsvMemberRow, CsvFamilyRow, CsvUnifiedRow } from './csv-schema'

const VALID_GENDERS = new Set(['male', 'female', 'other', ''])
const VALID_STATUSES = new Set(['active', 'divorced', 'widowed', ''])

function isNumericOrEmpty(v: string) { return v === '' || /^\d+$/.test(v) }

export type CsvUserLink = { personId: string; username: string; userRole: string }

export function parseUnifiedCsv(csv: string): {
  members: CsvMemberRow[]
  families: CsvFamilyRow[]
  userLinks: CsvUserLink[]
  errors: string[]
} {
  const result = Papa.parse<CsvUnifiedRow>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => CSV_COLUMN_FIELDS[h] ?? h,
  })
  const errors: string[] = []

  if (!result.meta.fields?.includes('type')) {
    return { members: [], families: [], userLinks: [], errors: ['Missing required column: type'] }
  }

  const optionalHeaders = new Set(['username', 'userRole', 'childOrder', 'ngoaiToc', 'thuTuDoi'])
  const coreHeaders = UNIFIED_CSV_HEADERS.filter(h => !optionalHeaders.has(h))
  const missingCols = coreHeaders.filter(h => !result.meta.fields?.includes(h))
  if (missingCols.length) {
    return { members: [], families: [], userLinks: [], errors: [`Missing columns: ${missingCols.join(', ')}`] }
  }

  const hasUserCols = result.meta.fields?.includes('username') && result.meta.fields?.includes('userRole')

  const members: CsvMemberRow[] = []
  const families: CsvFamilyRow[] = []
  const userLinks: CsvUserLink[] = []

  result.data.forEach((row, i) => {
    const line = i + 2
    if (row.type === 'person') {
      if (!row.id) errors.push(`Row ${line}: id is required`)
      if (!row.name) errors.push(`Row ${line}: name is required`)
      if (!VALID_GENDERS.has(row.gender)) errors.push(`Row ${line}: invalid gender "${row.gender}"`)
      if (!isNumericOrEmpty(row.birthYear)) errors.push(`Row ${line}: birthYear must be numeric`)
      if (!isNumericOrEmpty(row.birthMonth)) errors.push(`Row ${line}: birthMonth must be numeric`)
      if (!isNumericOrEmpty(row.birthDay)) errors.push(`Row ${line}: birthDay must be numeric`)
      if (!isNumericOrEmpty(row.deathYear)) errors.push(`Row ${line}: deathYear must be numeric`)
      if (!['true', 'false', ''].includes(row.isAlive)) errors.push(`Row ${line}: isAlive must be true/false`)
      if (!['true', 'false', ''].includes(row.ngoaiToc ?? '')) errors.push(`Row ${line}: ngoaiToc must be true/false`)
      if (!isNumericOrEmpty(row.thuTuDoi ?? '')) errors.push(`Row ${line}: thuTuDoi must be numeric`)
      members.push({
        id: row.id, name: row.name, gender: row.gender,
        nickname: row.nickname, bio: row.bio, address: row.address,
        email: row.email, phone: row.phone,
        birthYear: row.birthYear, birthMonth: row.birthMonth, birthDay: row.birthDay,
        birthIsLunar: row.birthIsLunar,
        deathYear: row.deathYear, deathMonth: row.deathMonth, deathDay: row.deathDay,
        deathIsLunar: row.deathIsLunar,
        isAlive: row.isAlive, notes: row.notes,
        fatherId: row.fatherId, motherId: row.motherId,
        childOrder: row.childOrder ?? '',
        ngoaiToc: row.ngoaiToc ?? '',
        thuTuDoi: row.thuTuDoi ?? '',
      })
      if (hasUserCols && row.username) {
        userLinks.push({ personId: row.id, username: row.username, userRole: row.userRole || 'viewer' })
      }
    } else if (row.type === 'family') {
      if (!row.id) errors.push(`Row ${line}: id is required`)
      if (!VALID_STATUSES.has(row.status)) errors.push(`Row ${line}: invalid status "${row.status}"`)
      families.push({
        id: row.id, fatherId: row.fatherId, motherId: row.motherId,
        orderP1: row.orderP1, orderP2: row.orderP2,
        status: row.status, notes: row.notes,
      })
    } else {
      errors.push(`Row ${line}: unknown type "${row.type}"`)
    }
  })

  return { members, families, userLinks, errors }
}

export function validateImportData(members: CsvMemberRow[], families: CsvFamilyRow[]): string[] {
  const personIds = new Set(members.map(m => m.id))
  const errors: string[] = []

  members.forEach(m => {
    if (m.fatherId && !personIds.has(m.fatherId))
      errors.push(`Person "${m.name}" (${m.id}): fatherId "${m.fatherId}" không tồn tại`)
    if (m.motherId && !personIds.has(m.motherId))
      errors.push(`Person "${m.name}" (${m.id}): motherId "${m.motherId}" không tồn tại`)
  })

  families.forEach(f => {
    if (f.fatherId && !personIds.has(f.fatherId))
      errors.push(`Family "${f.id}": fatherId "${f.fatherId}" không tồn tại`)
    if (f.motherId && !personIds.has(f.motherId))
      errors.push(`Family "${f.id}": motherId "${f.motherId}" không tồn tại`)
  })

  return errors
}

export function buildFamilyMemberships(
  members: CsvMemberRow[],
  families: CsvFamilyRow[]
): { familyId: string; personId: string; childOrder: number | null }[] {
  const memberships: { familyId: string; personId: string; childOrder: number | null }[] = []
  for (const member of members) {
    if (!member.fatherId && !member.motherId) continue
    const family = families.find(f =>
      (f.fatherId || '') === (member.fatherId || '') &&
      (f.motherId || '') === (member.motherId || '')
    )
    if (family) memberships.push({
      familyId: family.id,
      personId: member.id,
      childOrder: member.childOrder ? parseInt(member.childOrder, 10) : null,
    })
  }
  return memberships
}

const toInt = (v: string) => v ? parseInt(v, 10) : null
const toBool = (v: string) => v === 'true'
const toStr = (v: string) => v || null

export function coerceMemberRow(r: CsvMemberRow) {
  const ngoaiToc = r.ngoaiToc === 'true'
  return {
    id: r.id, name: r.name,
    gender: toStr(r.gender) as 'male' | 'female' | 'other' | null,
    nickname: toStr(r.nickname), bio: toStr(r.bio),
    address: toStr(r.address), email: toStr(r.email), phone: toStr(r.phone),
    birthYear: toInt(r.birthYear), birthMonth: toInt(r.birthMonth), birthDay: toInt(r.birthDay),
    birthIsLunar: toBool(r.birthIsLunar),
    deathYear: toInt(r.deathYear), deathMonth: toInt(r.deathMonth), deathDay: toInt(r.deathDay),
    deathIsLunar: toBool(r.deathIsLunar),
    isAlive: r.isAlive !== 'false',
    notes: toStr(r.notes),
    ngoaiToc,
    thuTuDoi: toInt(r.thuTuDoi),
  }
}

export function coerceFamilyRow(r: CsvFamilyRow) {
  return {
    id: r.id,
    parent1Id: toStr(r.fatherId), parent2Id: toStr(r.motherId),
    orderP1: toInt(r.orderP1) ?? 1, orderP2: toInt(r.orderP2) ?? 1,
    status: toStr(r.status) as 'active' | 'divorced' | 'widowed' | null,
    notes: toStr(r.notes),
  }
}
