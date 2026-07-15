// Ported from giaphadongho packages/api/src/utils/csv-export.ts — username/userRole
// always emitted empty since giapha has no `users` table, but the columns stay
// in the header row for byte-compatibility with giaphadongho's CSV format.
import Papa from 'papaparse'
import { UNIFIED_CSV_HEADERS, CSV_COLUMN_LABELS } from './csv-schema'
import type { CsvUnifiedRow } from './csv-schema'

type PersonRow = {
  id: string; name: string; gender: string | null; nickname: string | null
  bio: string | null; address: string | null; email: string | null; phone: string | null
  birthYear: number | null; birthMonth: number | null; birthDay: number | null; birthIsLunar: boolean | null
  deathYear: number | null; deathMonth: number | null; deathDay: number | null; deathIsLunar: boolean | null
  isAlive: boolean; notes: string | null; fatherId: string | null; motherId: string | null
  childOrder: number | null; ngoaiToc: boolean; thuTuDoi: number | null
}

type FamilyRow = {
  id: string; fatherId: string | null; motherId: string | null; orderP1: number; orderP2: number
  status: string | null; notes: string | null
}

const nullToEmpty = (v: unknown): string =>
  v === null || v === undefined ? '' : typeof v === 'boolean' ? String(v) : String(v)

function personToUnifiedRow(p: PersonRow): CsvUnifiedRow {
  return {
    type: 'person', id: p.id,
    name: nullToEmpty(p.name), gender: nullToEmpty(p.gender),
    nickname: nullToEmpty(p.nickname), bio: nullToEmpty(p.bio),
    address: nullToEmpty(p.address), email: nullToEmpty(p.email), phone: nullToEmpty(p.phone),
    birthYear: nullToEmpty(p.birthYear), birthMonth: nullToEmpty(p.birthMonth), birthDay: nullToEmpty(p.birthDay),
    birthIsLunar: nullToEmpty(p.birthIsLunar),
    deathYear: nullToEmpty(p.deathYear), deathMonth: nullToEmpty(p.deathMonth), deathDay: nullToEmpty(p.deathDay),
    deathIsLunar: nullToEmpty(p.deathIsLunar),
    isAlive: nullToEmpty(p.isAlive),
    childOrder: nullToEmpty(p.childOrder),
    ngoaiToc: nullToEmpty(p.ngoaiToc),
    thuTuDoi: nullToEmpty(p.thuTuDoi),
    fatherId: nullToEmpty(p.fatherId), motherId: nullToEmpty(p.motherId),
    orderP1: '', orderP2: '', status: '',
    notes: nullToEmpty(p.notes),
    username: '', userRole: '',
  }
}

function familyToUnifiedRow(f: FamilyRow): CsvUnifiedRow {
  return {
    type: 'family', id: f.id,
    name: '', gender: '', nickname: '', bio: '', address: '', email: '', phone: '',
    birthYear: '', birthMonth: '', birthDay: '', birthIsLunar: '',
    deathYear: '', deathMonth: '', deathDay: '', deathIsLunar: '',
    isAlive: '', childOrder: '', ngoaiToc: '', thuTuDoi: '',
    fatherId: nullToEmpty(f.fatherId), motherId: nullToEmpty(f.motherId),
    orderP1: nullToEmpty(f.orderP1), orderP2: nullToEmpty(f.orderP2),
    status: nullToEmpty(f.status),
    notes: nullToEmpty(f.notes),
    username: '', userRole: '',
  }
}

export function serializeToUnifiedCsv(persons: PersonRow[], families: FamilyRow[]): string {
  const rows: CsvUnifiedRow[] = [
    ...persons.map(personToUnifiedRow),
    ...families.map(familyToUnifiedRow),
  ]
  const viColumns = UNIFIED_CSV_HEADERS.map(f => CSV_COLUMN_LABELS[f])
  const viRows = rows.map(row =>
    Object.fromEntries(UNIFIED_CSV_HEADERS.map(f => [CSV_COLUMN_LABELS[f], row[f]]))
  )
  return Papa.unparse(viRows, { columns: viColumns })
}
