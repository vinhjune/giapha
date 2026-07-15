// COPIED FROM giaphadongho packages/shared/src/csv-schema.ts — keep header
// order and labels byte-identical so exported files stay compatible between
// both apps.
// Unified CSV row — one file, two row types: "person" and "family"
export interface CsvUnifiedRow {
  type: string         // 'person' | 'family'
  id: string
  // person fields (filled when type=person, empty when type=family)
  name: string
  gender: string       // 'male' | 'female' | 'other' | ''
  nickname: string
  bio: string
  address: string
  email: string
  phone: string
  birthYear: string    // number or ''
  birthMonth: string
  birthDay: string
  birthIsLunar: string // 'true' | 'false'
  deathYear: string
  deathMonth: string
  deathDay: string
  deathIsLunar: string
  isAlive: string      // 'true' | 'false'
  childOrder: string   // birth order within family (1=cả, 2=hai…), or '' for family rows / unset
  ngoaiToc: string     // 'true' | 'false' — married-in spouse/descendant (con dâu, con rể, cháu ngoại)
  thuTuDoi: string     // generation number (set for ngoại tộc members too, via spouse/parent); '' if unresolved
  // fatherId/motherId: person rows = parent IDs; family rows = the couple (husband/wife)
  fatherId: string
  motherId: string
  // family-only fields (filled when type=family, empty when type=person)
  orderP1: string      // marriage order for this person within their families (1 = first marriage…)
  orderP2: string
  status: string       // 'active' | 'divorced' | 'widowed' | ''
  notes: string        // shared by both types
  // user-link columns (person rows only; empty for family rows) — giapha has no users
  // table, so these are always emitted empty on export but still accepted on import
  // for byte-compatibility with giaphadongho's files.
  username: string
  userRole: string
}

export const UNIFIED_CSV_HEADERS: readonly (keyof CsvUnifiedRow)[] = [
  'type', 'id',
  // person columns
  'name', 'gender', 'nickname', 'bio', 'address', 'email', 'phone',
  'birthYear', 'birthMonth', 'birthDay', 'birthIsLunar',
  'deathYear', 'deathMonth', 'deathDay', 'deathIsLunar',
  'isAlive', 'childOrder', 'ngoaiToc', 'thuTuDoi', 'fatherId', 'motherId',
  // family-only columns
  'orderP1', 'orderP2', 'status',
  // shared
  'notes',
  // user-link (person rows only)
  'username', 'userRole',
] as const

// Sub-types for csv-export/import utilities
export type CsvMemberRow = Pick<CsvUnifiedRow,
  'id' | 'name' | 'gender' | 'nickname' | 'bio' | 'address' | 'email' | 'phone' |
  'birthYear' | 'birthMonth' | 'birthDay' | 'birthIsLunar' |
  'deathYear' | 'deathMonth' | 'deathDay' | 'deathIsLunar' |
  'isAlive' | 'childOrder' | 'ngoaiToc' | 'thuTuDoi' | 'notes' | 'fatherId' | 'motherId'
>

// fatherId/motherId in CsvFamilyRow = the couple (maps to DB parent1Id/parent2Id)
export type CsvFamilyRow = Pick<CsvUnifiedRow,
  'id' | 'fatherId' | 'motherId' | 'orderP1' | 'orderP2' | 'status' | 'notes'
>

// Vietnamese no-diacritics labels for CSV column headers (internal field → CSV label)
export const CSV_COLUMN_LABELS: Record<keyof CsvUnifiedRow, string> = {
  type:         'loai',
  id:           'ma',
  name:         'ho_ten',
  gender:       'gioi_tinh',
  nickname:     'ten_goi',
  bio:          'tieu_su',
  address:      'dia_chi',
  email:        'email',
  phone:        'dien_thoai',
  birthYear:    'nam_sinh',
  birthMonth:   'thang_sinh',
  birthDay:     'ngay_sinh',
  birthIsLunar: 'sinh_am_lich',
  deathYear:    'nam_mat',
  deathMonth:   'thang_mat',
  deathDay:     'ngay_mat',
  deathIsLunar: 'mat_am_lich',
  isAlive:      'con_song',
  childOrder:   'thu_tu_con',
  ngoaiToc:     'ngoai_toc',
  thuTuDoi:     'thu_tu_doi',
  fatherId:     'ma_cha',
  motherId:     'ma_me',
  orderP1:      'thu_tu_cha',
  orderP2:      'thu_tu_me',
  status:       'tinh_trang',
  notes:        'ghi_chu',
  username:     'tai_khoan',
  userRole:     'vai_tro',
}

// Reverse map: CSV label → internal field name (for import / backward-compat)
export const CSV_COLUMN_FIELDS: Record<string, keyof CsvUnifiedRow> = Object.fromEntries(
  (Object.entries(CSV_COLUMN_LABELS) as [keyof CsvUnifiedRow, string][]).map(([k, v]) => [v, k])
) as Record<string, keyof CsvUnifiedRow>
