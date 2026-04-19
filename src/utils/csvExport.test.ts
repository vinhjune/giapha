import { describe, it, expect } from 'vitest'
import type { GiaphaData, Person } from '../types/giapha'
import { exportGiaphaToCSV } from './csvExport'
import { importSingleCsvToGiapha } from './csvImport'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const METADATA: GiaphaData['metadata'] = {
  tenDongHo: 'Test',
  ngayTao: '2026-01-01T00:00:00.000Z',
  nguoiTao: '',
  phienBan: 1,
  cheDoCong: false,
  danhSachNguoiDung: [],
}

function nguoiMau(ghi: Partial<Person>): Person {
  return {
    id: 0,
    hoTen: 'Test',
    gioiTinh: 'nam',
    laThanhVienHo: true,
    honNhan: [],
    conCaiIds: [],
    ...ghi,
  }
}

function makeData(persons: Person[]): GiaphaData {
  return {
    metadata: METADATA,
    persons: Object.fromEntries(persons.map(p => [p.id, p])),
  }
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe('exportGiaphaToCSV', () => {
  it('produces correct 22-column header', () => {
    const csv = exportGiaphaToCSV(makeData([nguoiMau({ id: 1 })]))
    // Strip BOM
    const clean = csv.startsWith('\uFEFF') ? csv.slice(1) : csv
    const header = clean.split(/\r?\n/)[0]
    const cols = header.split(',')
    expect(cols).toHaveLength(22)
    expect(cols[0]).toBe('id')
    expect(cols[1]).toBe('hoTen')
    expect(cols[2]).toBe('gioiTinh')
    expect(cols[15]).toBe('voChongIds')
  })

  it('starts with UTF-8 BOM', () => {
    const csv = exportGiaphaToCSV(makeData([nguoiMau({ id: 1 })]))
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
  })

  it('serialises full NgayThang correctly', () => {
    const data = makeData([
      nguoiMau({ id: 1, namSinh: { nam: 1950, thang: 3, ngay: 15, amLich: false } }),
    ])
    const lines = exportGiaphaToCSV(data).replace('\uFEFF', '').split(/\r?\n/)
    const cols = lines[1].split(',')
    expect(cols[5]).toBe('1950')  // namSinh_nam
    expect(cols[6]).toBe('3')     // namSinh_thang
    expect(cols[7]).toBe('15')    // namSinh_ngay
    expect(cols[8]).toBe('false') // namSinh_amLich
  })

  it('leaves date sub-fields empty when only nam is set', () => {
    const data = makeData([nguoiMau({ id: 1, namSinh: { nam: 1920 } })])
    const lines = exportGiaphaToCSV(data).replace('\uFEFF', '').split(/\r?\n/)
    const cols = lines[1].split(',')
    expect(cols[5]).toBe('1920') // namSinh_nam
    expect(cols[6]).toBe('')     // namSinh_thang
    expect(cols[7]).toBe('')     // namSinh_ngay
    expect(cols[8]).toBe('')     // namSinh_amLich
  })

  it('quotes fields containing commas', () => {
    const data = makeData([nguoiMau({ id: 1, hoTen: '1. Hg Văn Bột, Cụ Tổ' })])
    const lines = exportGiaphaToCSV(data).replace('\uFEFF', '').split(/\r?\n/)
    expect(lines[1]).toContain('"1. Hg Văn Bột, Cụ Tổ"')
  })

  it('escapes double-quotes inside fields', () => {
    const data = makeData([nguoiMau({ id: 1, tieuSu: 'Ông nói "xin chào"' })])
    const csv = exportGiaphaToCSV(data).replace('\uFEFF', '')
    expect(csv).toContain('"Ông nói ""xin chào"""')
  })

  it('joins multiple voChongIds with semicolon', () => {
    const data = makeData([
      nguoiMau({ id: 1, honNhan: [{ voChongId: 2 }, { voChongId: 3 }] }),
      nguoiMau({ id: 2, gioiTinh: 'nu', laThanhVienHo: false }),
      nguoiMau({ id: 3, gioiTinh: 'nu', laThanhVienHo: false }),
    ])
    const lines = exportGiaphaToCSV(data).replace('\uFEFF', '').split(/\r?\n/)
    const cols = lines[1].split(',')
    expect(cols[15]).toBe('2;3') // voChongIds
  })

  it('sorts persons by id ascending', () => {
    const data = makeData([
      nguoiMau({ id: 5, hoTen: 'Năm' }),
      nguoiMau({ id: 1, hoTen: 'Một' }),
      nguoiMau({ id: 3, hoTen: 'Ba' }),
    ])
    const lines = exportGiaphaToCSV(data).replace('\uFEFF', '').split(/\r?\n/).filter(Boolean)
    expect(lines[1].startsWith('1,')).toBe(true)
    expect(lines[2].startsWith('3,')).toBe(true)
    expect(lines[3].startsWith('5,')).toBe(true)
  })

  it('exports boId and meId correctly', () => {
    const data = makeData([
      nguoiMau({ id: 1, gioiTinh: 'nam', honNhan: [{ voChongId: 2 }] }),
      nguoiMau({ id: 2, gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: 1 }] }),
      nguoiMau({ id: 3, gioiTinh: 'nam', boId: 1, meId: 2 }),
    ])
    const lines = exportGiaphaToCSV(data).replace('\uFEFF', '').split(/\r?\n/)
    const child = lines[3].split(',') // id=3 → 3rd data row
    expect(child[13]).toBe('1') // boId
    expect(child[14]).toBe('2') // meId
  })
})

// ─── Round-trip tests ─────────────────────────────────────────────────────────

describe('CSV round-trip (export → import)', () => {
  it('simple family: 0 errors and 0 warnings after reimport', () => {
    const data = makeData([
      nguoiMau({ id: 1, hoTen: 'Nguyễn Văn Tổ', gioiTinh: 'nam', laThanhVienHo: true,
        namSinh: { nam: 1870 }, honNhan: [{ voChongId: 2 }] }),
      nguoiMau({ id: 2, hoTen: 'Trần Thị Cội', gioiTinh: 'nu', laThanhVienHo: false,
        namSinh: { nam: 1875 }, honNhan: [{ voChongId: 1 }] }),
      nguoiMau({ id: 3, hoTen: 'Nguyễn Văn Con', gioiTinh: 'nam', laThanhVienHo: true,
        namSinh: { nam: 1900 }, boId: 1, meId: 2 }),
    ])

    const csv = exportGiaphaToCSV(data)
    const result = importSingleCsvToGiapha(csv, METADATA)

    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    expect(result.stats.personCount).toBe(3)
  })

  it('preserves names, dates and parent links after round-trip', () => {
    const data = makeData([
      nguoiMau({ id: 1, hoTen: 'Họ Văn Cha', gioiTinh: 'nam', laThanhVienHo: true,
        namSinh: { nam: 1890, thang: 5, ngay: 10 },
        namMat: { nam: 1965 },
        honNhan: [{ voChongId: 2 }] }),
      nguoiMau({ id: 2, hoTen: 'Lê Thị Mẹ', gioiTinh: 'nu', laThanhVienHo: false,
        namSinh: { nam: 1895 }, honNhan: [{ voChongId: 1 }] }),
      nguoiMau({ id: 3, hoTen: '1. Hg Văn Bột, Cụ Tổ', gioiTinh: 'nam', laThanhVienHo: true,
        namSinh: { nam: 1920 }, boId: 1, meId: 2 }),
    ])

    const csv = exportGiaphaToCSV(data)
    const result = importSingleCsvToGiapha(csv, METADATA)

    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)

    const persons = result.data!.persons
    expect(persons[1].hoTen).toBe('Họ Văn Cha')
    expect(persons[1].namSinh?.nam).toBe(1890)
    expect(persons[1].namSinh?.thang).toBe(5)
    expect(persons[1].namSinh?.ngay).toBe(10)
    expect(persons[1].namMat?.nam).toBe(1965)
    expect(persons[3].hoTen).toBe('1. Hg Văn Bột, Cụ Tổ')
    expect(persons[3].boId).toBe(1)
    expect(persons[3].meId).toBe(2)
  })

  it('preserves bidirectional marriage links after round-trip', () => {
    const data = makeData([
      nguoiMau({ id: 1, gioiTinh: 'nam', honNhan: [{ voChongId: 2 }, { voChongId: 3 }] }),
      nguoiMau({ id: 2, gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: 1 }] }),
      nguoiMau({ id: 3, gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: 1 }] }),
    ])

    const csv = exportGiaphaToCSV(data)
    const result = importSingleCsvToGiapha(csv, METADATA)

    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)

    const p1 = result.data!.persons[1]
    expect(p1.honNhan.map(h => h.voChongId).sort()).toEqual([2, 3])
    // Reverse links preserved
    expect(result.data!.persons[2].honNhan[0].voChongId).toBe(1)
    expect(result.data!.persons[3].honNhan[0].voChongId).toBe(1)
  })

  it('full 56-person dataset: 0 errors, 0 warnings', () => {
    // Build a representative large dataset resembling giaphahoHoang
    const persons: Person[] = [
      nguoiMau({ id: 30, hoTen: '1. Hg Văn Bột, Cụ Tổ', gioiTinh: 'nam', laThanhVienHo: true,
        namSinh: { nam: 1841 }, honNhan: [{ voChongId: 31 }] }),
      nguoiMau({ id: 31, hoTen: 'Cụ Tổ bà', gioiTinh: 'nu', laThanhVienHo: false,
        namSinh: { nam: 1846 }, honNhan: [{ voChongId: 30 }] }),
      nguoiMau({ id: 27, hoTen: '2. Hg Văn Truyền', gioiTinh: 'nam', laThanhVienHo: true,
        namSinh: { nam: 1860 }, boId: 30, meId: 31,
        honNhan: [{ voChongId: 28 }, { voChongId: 29 }] }),
      nguoiMau({ id: 28, hoTen: 'Bà Truyền cả', gioiTinh: 'nu', laThanhVienHo: false,
        honNhan: [{ voChongId: 27 }] }),
      nguoiMau({ id: 29, hoTen: 'Bà Truyền hai', gioiTinh: 'nu', laThanhVienHo: false,
        honNhan: [{ voChongId: 27 }] }),
      nguoiMau({ id: 25, hoTen: '3. Hg Văn Bút', gioiTinh: 'nam', laThanhVienHo: true,
        namSinh: { nam: 1890 }, namMat: { nam: 1950, thang: 8, ngay: 9 },
        boId: 27, meId: 29, honNhan: [{ voChongId: 26 }] }),
      nguoiMau({ id: 26, hoTen: 'Hg Thị Kỉnh', gioiTinh: 'nu', laThanhVienHo: false,
        namSinh: { nam: 1892 }, honNhan: [{ voChongId: 25 }] }),
      nguoiMau({ id: 6, hoTen: '4. Hoàng Son', gioiTinh: 'nam', laThanhVienHo: true,
        namSinh: { nam: 1925 }, namMat: { nam: 2007, thang: 12, ngay: 30 },
        boId: 25, meId: 26,
        tieuSu: 'Là Dũng sỹ diệt Mỹ, Dũng sỹ diệt máy bay.',
        honNhan: [{ voChongId: 7 }, { voChongId: 16 }, { voChongId: 24 }] }),
      nguoiMau({ id: 7, hoTen: 'Đg Thị Phát', gioiTinh: 'nu', laThanhVienHo: false,
        namSinh: { nam: 1925 }, namMat: { nam: 2017, thang: 10, ngay: 9 },
        honNhan: [{ voChongId: 6 }] }),
      nguoiMau({ id: 16, hoTen: 'Lương Thị Nghĩa', gioiTinh: 'nu', laThanhVienHo: false,
        namSinh: { nam: 1958 }, honNhan: [{ voChongId: 6 }] }),
      nguoiMau({ id: 24, hoTen: 'Ng Thị Nhiêu', gioiTinh: 'nu', laThanhVienHo: false,
        namSinh: { nam: 1924 }, namMat: { nam: 1947 }, honNhan: [{ voChongId: 6 }] }),
      nguoiMau({ id: 1, hoTen: '5. Hg Văn Nông', gioiTinh: 'nam', laThanhVienHo: true,
        namSinh: { nam: 1952, thang: 10, ngay: 13 }, boId: 6, meId: 7,
        honNhan: [{ voChongId: 2 }] }),
      nguoiMau({ id: 2, hoTen: 'Hoa Ngọc Thanh', gioiTinh: 'nu', laThanhVienHo: false,
        namSinh: { nam: 1959, thang: 12, ngay: 19 }, honNhan: [{ voChongId: 1 }] }),
    ]

    const data = makeData(persons)
    const csv = exportGiaphaToCSV(data)
    const result = importSingleCsvToGiapha(csv, METADATA)

    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    expect(result.stats.personCount).toBe(persons.length)

    // Spot-check a person with commas in name
    const cutTo = result.data!.persons[30]
    expect(cutTo.hoTen).toBe('1. Hg Văn Bột, Cụ Tổ')
    // Spot-check multi-spouse
    const son = result.data!.persons[6]
    expect(son.honNhan.map(h => h.voChongId).sort((a, b) => a - b)).toEqual([7, 16, 24])
    // Spot-check tieuSu with comma
    expect(son.tieuSu).toBe('Là Dũng sỹ diệt Mỹ, Dũng sỹ diệt máy bay.')
  })
})
