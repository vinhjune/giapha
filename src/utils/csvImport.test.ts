import { describe, it, expect } from 'vitest'
import { importSingleCsvToGiapha } from './csvImport'

const METADATA = { tenDongHo: 'Test', nguonGoc: '', ngayCapNhat: '', phienBan: 1 } as any

// ─── Helpers ──────────────────────────────────────────────────────────────────

function csv(...rows: string[]): string {
  return rows.join('\n')
}

const HEADER = 'id,hoTen,gioiTinh,laThanhVienHo,thuTuAnhChi,namSinh_nam,namSinh_thang,namSinh_ngay,namSinh_amLich,namMat_nam,namMat_thang,namMat_ngay,namMat_amLich,boId,meId,voChongIds,queQuan,tieuSu,anhDaiDien,email,soDienThoai,ghiChu'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('importSingleCsvToGiapha', () => {
  describe('blocking validation', () => {
    it('errors on empty file', () => {
      const result = importSingleCsvToGiapha('', METADATA)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.data).toBeUndefined()
    })

    it('errors when required column is missing', () => {
      const result = importSingleCsvToGiapha(csv('hoTen,gioiTinh', 'An,nam'), METADATA)
      const codes = result.errors.map(e => e.code)
      expect(codes).toContain('MISSING_REQUIRED_COLUMN')
      expect(result.data).toBeUndefined()
    })

    it('errors on non-numeric id', () => {
      const result = importSingleCsvToGiapha(
        csv(HEADER, 'abc,Nguyễn Văn An,nam,true,,,,,,,,,,,,,,,,,, '),
        METADATA
      )
      expect(result.errors.some(e => e.code === 'INVALID_ID')).toBe(true)
      expect(result.data).toBeUndefined()
    })

    it('errors on duplicate id', () => {
      const result = importSingleCsvToGiapha(
        csv(
          HEADER,
          '1,Nguyễn Văn An,nam,true,,,,,,,,,,,,,,,,,, ',
          '1,Nguyễn Thị Bình,nu,false,,,,,,,,,,,,,,,,,, ',
        ),
        METADATA
      )
      expect(result.errors.some(e => e.code === 'DUPLICATE_ID')).toBe(true)
    })

    it('errors on empty hoTen', () => {
      const result = importSingleCsvToGiapha(
        csv(HEADER, '1,,nam,true,,,,,,,,,,,,,,,,,, '),
        METADATA
      )
      expect(result.errors.some(e => e.code === 'EMPTY_NAME')).toBe(true)
    })

    it('errors on invalid gender', () => {
      const result = importSingleCsvToGiapha(
        csv(HEADER, '1,Nguyễn Văn An,other,true,,,,,,,,,,,,,,,,,, '),
        METADATA
      )
      expect(result.errors.some(e => e.code === 'INVALID_GENDER')).toBe(true)
    })

    it('errors on unknown parent reference', () => {
      const result = importSingleCsvToGiapha(
        csv(HEADER, '1,Nguyễn Văn An,nam,true,,,,,,,,,,99,,,,,,,,'),
        METADATA
      )
      expect(result.errors.some(e => e.code === 'UNKNOWN_PARENT_REFERENCE')).toBe(true)
    })

    it('errors on self spouse reference', () => {
      const result = importSingleCsvToGiapha(
        csv(HEADER, '1,Nguyễn Văn An,nam,true,,,,,,,,,,,,1,,,,,,'),
        METADATA
      )
      expect(result.errors.some(e => e.code === 'SELF_SPOUSE_REFERENCE')).toBe(true)
    })
  })

  describe('happy path', () => {
    it('parses a simple family', () => {
      const result = importSingleCsvToGiapha(
        csv(
          HEADER,
          '1,Nguyễn Văn Cha,nam,true,,,,,,,,,,,, 2,,,,,, ',
          '2,Trần Thị Mẹ,nu,false,,,,,,,,,,,,1,,,,,, ',
          '3,Nguyễn Văn Con,nam,true,,,,,,,,,, 1,2,,,,,,,',
        ),
        METADATA
      )
      expect(result.errors).toHaveLength(0)
      expect(result.data).toBeDefined()
      expect(Object.keys(result.data!.persons)).toHaveLength(3)
    })

    it('sets person id as number', () => {
      const result = importSingleCsvToGiapha(
        csv(HEADER, '5,Nguyễn Văn An,nam,true,,,,,,,,,,,,,,,,,, '),
        METADATA
      )
      expect(result.data?.persons[5]?.id).toBe(5)
      expect(typeof result.data?.persons[5]?.id).toBe('number')
    })

    it('rebuilds conCaiIds from boId/meId', () => {
      const result = importSingleCsvToGiapha(
        csv(
          HEADER,
          '1,Bố,nam,true,,,,,,,,,,,,,,,,,, ',
          '2,Mẹ,nu,false,,,,,,,,,,,,,1,,,,,, ',
          '3,Con,nam,true,,,,,,,,,,1,2,,,,,,, ',
        ),
        METADATA
      )
      expect(result.data?.persons[1]?.conCaiIds).toContain(3)
      expect(result.data?.persons[2]?.conCaiIds).toContain(3)
    })

    it('builds bidirectional honNhan from voChongIds', () => {
      const result = importSingleCsvToGiapha(
        csv(
          HEADER,
          '1,Chồng,nam,true,,,,,,,,,,,, 2,,,,,, ',
          '2,Vợ,nu,false,,,,,,,,,,,,1,,,,,, ',
        ),
        METADATA
      )
      const chong = result.data?.persons[1]
      const vo = result.data?.persons[2]
      expect(chong?.honNhan.some(h => h.voChongId === 2)).toBe(true)
      expect(vo?.honNhan.some(h => h.voChongId === 1)).toBe(true)
    })

    it('auto-adds missing reverse spouse link (auto-fix warning)', () => {
      const result = importSingleCsvToGiapha(
        csv(
          HEADER,
          '1,Chồng,nam,true,,,,,,,,,,,, 2,,,,,, ',
          '2,Vợ,nu,false,,,,,,,,,,,,,,,,,, ', // no voChongIds declared
        ),
        METADATA
      )
      expect(result.warnings.some(w => w.code === 'MISSING_REVERSE_SPOUSE_LINK')).toBe(true)
      // Both sides should still get the link
      expect(result.data?.persons[2]?.honNhan.some(h => h.voChongId === 1)).toBe(true)
    })

    it('forces laThanhVienHo=true for males (auto-fix)', () => {
      const result = importSingleCsvToGiapha(
        csv(HEADER, '1,Nguyễn Văn An,nam,false,,,,,,,,,,,,,,,,,, '),
        METADATA
      )
      expect(result.warnings.some(w => w.code === 'MALE_FORCE_BLOODLINE_TRUE')).toBe(true)
      expect(result.data?.persons[1]?.laThanhVienHo).toBe(true)
    })

    it('parses namSinh correctly', () => {
      const result = importSingleCsvToGiapha(
        csv(HEADER, '1,Nguyễn Văn An,nam,true,,1950,3,15,false,,,,,,,,,,,,, '),
        METADATA
      )
      const p = result.data?.persons[1]
      expect(p?.namSinh?.nam).toBe(1950)
      expect(p?.namSinh?.thang).toBe(3)
      expect(p?.namSinh?.ngay).toBe(15)
      expect(p?.namSinh?.amLich).toBe(false)
    })

    it('supports multi-spouse semicolon list', () => {
      const result = importSingleCsvToGiapha(
        csv(
          HEADER,
          '1,Ông,nam,true,,,,,,,,,,,, 2;3,,,,,, ',
          '2,Vợ1,nu,false,,,,,,,,,,,,,1,,,,,, ',
          '3,Vợ2,nu,false,,,,,,,,,,,,,1,,,,,, ',
        ),
        METADATA
      )
      expect(result.data?.persons[1]?.honNhan).toHaveLength(2)
    })
  })

  describe('stats', () => {
    it('reports correct person count', () => {
      const result = importSingleCsvToGiapha(
        csv(
          HEADER,
          '1,A,nam,true,,,,,,,,,,,,,,,,,, ',
          '2,B,nu,false,,,,,,,,,,,,,,,,,, ',
        ),
        METADATA
      )
      expect(result.stats.personCount).toBe(2)
    })
  })
})
