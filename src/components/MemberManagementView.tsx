import { useMemo, useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { importSingleCsvToGiapha } from '../utils/csvImport'
import { tinhThuTuDoi } from '../utils/familyTree'
import type { GioiTinh, Person } from '../types/giapha'

type RowField =
  | 'id' | 'hoTen' | 'gioiTinh' | 'laThanhVienHo' | 'thuTuAnhChi'
  | 'namSinh_nam' | 'namSinh_thang' | 'namSinh_ngay' | 'namSinh_amLich'
  | 'namMat_nam' | 'namMat_thang' | 'namMat_ngay' | 'namMat_amLich'
  | 'boId' | 'meId' | 'voChongIds'
  | 'queQuan' | 'tieuSu' | 'anhDaiDien' | 'email' | 'soDienThoai' | 'ghiChu'

interface EditableRow extends Record<RowField, string> {
  _key: string
}

const CSV_HEADERS: RowField[] = [
  'id', 'hoTen', 'gioiTinh', 'laThanhVienHo', 'thuTuAnhChi',
  'namSinh_nam', 'namSinh_thang', 'namSinh_ngay', 'namSinh_amLich',
  'namMat_nam', 'namMat_thang', 'namMat_ngay', 'namMat_amLich',
  'boId', 'meId', 'voChongIds',
  'queQuan', 'tieuSu', 'anhDaiDien', 'email', 'soDienThoai', 'ghiChu',
]

const COLUMNS: Array<{ key: RowField; label: string }> = [
  { key: 'id', label: 'ID' },
  { key: 'hoTen', label: 'Họ tên' },
  { key: 'gioiTinh', label: 'Giới tính' },
  { key: 'laThanhVienHo', label: 'Thành viên họ' },
  { key: 'thuTuAnhChi', label: 'Thứ tự anh/chị' },
  { key: 'namSinh_nam', label: 'Năm sinh' },
  { key: 'namSinh_thang', label: 'Tháng sinh' },
  { key: 'namSinh_ngay', label: 'Ngày sinh' },
  { key: 'namSinh_amLich', label: 'NS âm lịch' },
  { key: 'namMat_nam', label: 'Năm mất' },
  { key: 'namMat_thang', label: 'Tháng mất' },
  { key: 'namMat_ngay', label: 'Ngày mất' },
  { key: 'namMat_amLich', label: 'NM âm lịch' },
  { key: 'boId', label: 'Bố ID' },
  { key: 'meId', label: 'Mẹ ID' },
  { key: 'voChongIds', label: 'Vợ/chồng IDs (;)' },
  { key: 'queQuan', label: 'Địa chỉ' },
  { key: 'tieuSu', label: 'Tiểu sử' },
  { key: 'email', label: 'Email' },
  { key: 'soDienThoai', label: 'SĐT' },
  { key: 'ghiChu', label: 'Ghi chú' },
]

const DEFAULT_COLUMN_WIDTHS: Partial<Record<RowField, number>> = {
  id: 72,
  hoTen: 160,
  gioiTinh: 120,
  laThanhVienHo: 116,
  thuTuAnhChi: 130,
  namSinh_nam: 110,
  namSinh_thang: 110,
  namSinh_ngay: 110,
  namSinh_amLich: 110,
  namMat_nam: 110,
  namMat_thang: 110,
  namMat_ngay: 110,
  namMat_amLich: 110,
  boId: 100,
  meId: 100,
  voChongIds: 140,
  queQuan: 150,
  tieuSu: 180,
  email: 170,
  soDienThoai: 120,
  ghiChu: 360,
}

const FALLBACK_COLUMN_WIDTH = 120
const MIN_COLUMN_WIDTH = 60
const MAX_COLUMN_WIDTH = 600

function dateToParts(d?: Person['namSinh']) {
  return {
    nam: d?.nam != null ? String(d.nam) : '',
    thang: d?.thang != null ? String(d.thang) : '',
    ngay: d?.ngay != null ? String(d.ngay) : '',
    amLich: d?.amLich != null ? String(d.amLich) : '',
  }
}

function personToRow(person: Person): EditableRow {
  const namSinh = dateToParts(person.namSinh)
  const namMat = dateToParts(person.namMat)
  return {
    _key: `existing-${person.id}`,
    id: String(person.id),
    hoTen: person.hoTen,
    gioiTinh: person.gioiTinh,
    laThanhVienHo: String(person.laThanhVienHo),
    thuTuAnhChi: person.thuTuAnhChi != null ? String(person.thuTuAnhChi) : '',
    namSinh_nam: namSinh.nam,
    namSinh_thang: namSinh.thang,
    namSinh_ngay: namSinh.ngay,
    namSinh_amLich: namSinh.amLich,
    namMat_nam: namMat.nam,
    namMat_thang: namMat.thang,
    namMat_ngay: namMat.ngay,
    namMat_amLich: namMat.amLich,
    boId: person.boId != null ? String(person.boId) : '',
    meId: person.meId != null ? String(person.meId) : '',
    voChongIds: person.honNhan.map(h => h.voChongId).join(';'),
    queQuan: person.queQuan ?? '',
    tieuSu: person.tieuSu ?? '',
    anhDaiDien: person.anhDaiDien ?? '',
    email: person.email ?? '',
    soDienThoai: person.soDienThoai ?? '',
    ghiChu: person.ghiChu ?? '',
  }
}

function createEmptyRow(index: number): EditableRow {
  return {
    _key: `new-${index}`,
    id: '',
    hoTen: '',
    gioiTinh: 'nam',
    laThanhVienHo: 'true',
    thuTuAnhChi: '',
    namSinh_nam: '',
    namSinh_thang: '',
    namSinh_ngay: '',
    namSinh_amLich: '',
    namMat_nam: '',
    namMat_thang: '',
    namMat_ngay: '',
    namMat_amLich: '',
    boId: '',
    meId: '',
    voChongIds: '',
    queQuan: '',
    tieuSu: '',
    anhDaiDien: '',
    email: '',
    soDienThoai: '',
    ghiChu: '',
  }
}

function escapeCsvField(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export default function MemberManagementView() {
  const { data, currentRole } = useGiaphaStore()
  const canEdit = currentRole === 'admin' || currentRole === 'editor'
  const [rows, setRows] = useState<EditableRow[]>(() => {
    if (!data) return []
    return Object.values(data.persons).sort((a, b) => a.id - b.id).map(personToRow)
  })
  const [columnWidths, setColumnWidths] = useState(() =>
    COLUMNS.reduce<Record<RowField, number>>((acc, col) => {
      acc[col.key] = DEFAULT_COLUMN_WIDTHS[col.key] ?? FALLBACK_COLUMN_WIDTH
      return acc
    }, {} as Record<RowField, number>)
  )
  const [errorMessages, setErrorMessages] = useState<string[]>([])
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const generationById = useMemo(() => (data ? tinhThuTuDoi(data) : {}), [data])

  if (!data) return <div className="p-4 text-gray-400">Chưa có dữ liệu</div>

  function handleCellChange(index: number, field: RowField, value: string) {
    setRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row))
    setErrorMessages([])
    setSaveMessage(null)
  }

  function handleAddRow() {
    if (!canEdit) return
    setRows(prev => [...prev, createEmptyRow(prev.length + 1)])
    setErrorMessages([])
    setSaveMessage(null)
  }

  function handleResetRows() {
    if (!data) return
    setRows(Object.values(data.persons).sort((a, b) => a.id - b.id).map(personToRow))
    setErrorMessages([])
    setSaveMessage(null)
  }

  function handleDeleteRow(index: number) {
    if (!canEdit) return
    setRows(prev => prev.filter((_, i) => i !== index))
    setErrorMessages([])
    setSaveMessage(null)
  }

  function handleColumnWidthChange(field: RowField, width: number) {
    const nextWidth = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, width))
    setColumnWidths(prev => ({ ...prev, [field]: nextWidth }))
  }

  function handleApplyChanges() {
    if (!data || !canEdit) return

    const usedIds = new Set(
      rows
        .map(row => Number(row.id.trim()))
        .filter(id => Number.isInteger(id) && id > 0)
    )
    let nextId = usedIds.size > 0 ? Math.max(...usedIds) + 1 : 1

    const rowsWithGeneratedIds = rows.map(row => {
      if (row.id.trim()) return row
      while (usedIds.has(nextId)) nextId++
      const generatedId = nextId
      usedIds.add(generatedId)
      nextId++
      return { ...row, id: String(generatedId) }
    })

    const csvLines = [
      CSV_HEADERS.join(','),
      ...rowsWithGeneratedIds.map(row => CSV_HEADERS.map(key => escapeCsvField(row[key])).join(',')),
    ]
    const csvText = csvLines.join('\r\n')
    const result = importSingleCsvToGiapha(csvText, data.metadata)

    if (result.errors.length > 0 || !result.data) {
      setErrorMessages(result.errors.map(err => err.message))
      setSaveMessage(null)
      return
    }

    useGiaphaStore.setState({ data: result.data, isDirty: true })
    setRows(Object.values(result.data.persons).sort((a, b) => a.id - b.id).map(personToRow))
    setErrorMessages([])
    setSaveMessage(
      result.warnings.length > 0
        ? `Đã cập nhật ${result.stats.personCount} thành viên (có ${result.warnings.length} cảnh báo tự xử lý).`
        : `Đã cập nhật ${result.stats.personCount} thành viên.`
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-800">Quản lý thành viên</h2>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <button
                onClick={handleAddRow}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
              >
                Thêm dòng mới
              </button>
              <button
                onClick={handleResetRows}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
              >
                Hoàn tác
              </button>
              <button
                onClick={handleApplyChanges}
                className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                Áp dụng thay đổi
              </button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-auto border border-gray-200 rounded-lg">
        <table className="min-w-[2400px] w-full text-xs">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-r">Đời</th>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-r last:border-r-0"
                  style={{ width: `${columnWidths[col.key]}px`, minWidth: `${columnWidths[col.key]}px` }}
                >
                  <div className="flex flex-col gap-1">
                    <span>{col.label}</span>
                    <label className="flex items-center gap-1 text-[10px] font-normal text-gray-500">
                      <span>W</span>
                      <input
                        type="number"
                        min={MIN_COLUMN_WIDTH}
                        max={MAX_COLUMN_WIDTH}
                        value={columnWidths[col.key]}
                        onChange={e => handleColumnWidthChange(col.key, Number(e.target.value) || MIN_COLUMN_WIDTH)}
                        aria-label={`Độ rộng cột ${col.label}`}
                        className="w-14 rounded border px-1 py-0.5 text-[10px]"
                      />
                    </label>
                  </div>
                </th>
              ))}
              <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b">Xóa</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row._key} className="hover:bg-blue-50/30">
                <td className="px-2 py-1 border-b border-r text-gray-700">
                  {generationById[Number(row.id)] || ''}
                </td>
                {COLUMNS.map(col => (
                  <td
                    key={col.key}
                    className="px-1 py-1 border-b border-r last:border-r-0"
                    style={{ width: `${columnWidths[col.key]}px`, minWidth: `${columnWidths[col.key]}px` }}
                  >
                    {col.key === 'gioiTinh' ? (
                      <select
                        value={row.gioiTinh}
                        disabled={!canEdit}
                        onChange={e => handleCellChange(rowIndex, col.key, e.target.value as GioiTinh)}
                        data-testid={`${col.key}-${rowIndex}`}
                        className="w-full px-2 py-1 border rounded"
                      >
                        <option value="nam">Nam</option>
                        <option value="nu">Nữ</option>
                        <option value="khac">Khác</option>
                      </select>
                    ) : col.key === 'laThanhVienHo' ? (
                      <div className="flex justify-center">
                        <input
                          type="checkbox"
                          checked={row.laThanhVienHo === 'true'}
                          disabled={!canEdit}
                          onChange={e => handleCellChange(rowIndex, col.key, String(e.target.checked))}
                          aria-label={`Thành viên họ dòng ${rowIndex + 1}`}
                          data-testid={`${col.key}-${rowIndex}`}
                          className="h-4 w-4"
                        />
                      </div>
                    ) : (
                      <input
                        value={row[col.key]}
                        disabled={!canEdit}
                        onChange={e => handleCellChange(rowIndex, col.key, e.target.value)}
                        data-testid={`${col.key}-${rowIndex}`}
                        className="w-full px-2 py-1 border rounded"
                      />
                    )}
                  </td>
                ))}
                <td className="px-2 py-1 border-b text-center">
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => handleDeleteRow(rowIndex)}
                    aria-label={`Xóa thành viên dòng ${rowIndex + 1}`}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-300"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-4 w-4"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V5h6v2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="m7 7 1 12h8l1-12" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v5m4-5v5" />
                    </svg>
                    <span className="text-[11px]">Xóa</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {saveMessage && <p className="mt-3 text-sm text-green-700">{saveMessage}</p>}
      {errorMessages.length > 0 && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-700 mb-1">Không thể áp dụng thay đổi:</p>
          <ul className="text-xs text-red-700 list-disc pl-5 space-y-1">
            {errorMessages.slice(0, 10).map((msg, idx) => <li key={idx}>{msg}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
