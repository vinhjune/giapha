import { useEffect, useMemo, useRef, useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { useAuthStore } from '../store/useAuthStore'
import PersonPicker from './PersonPicker'
import NgayThangInput from './NgayThangInput'
import * as api from '../services/api'
import { personToRow, isNewRow, getChangedFields } from '../utils/memberRowDiff'
import { computeThuTuDoi, computeThuTuAnhChi } from '../utils/memberAutoCompute'
import { SORTABLE_FIELDS, sortRowsForDisplay, type SortState } from '../utils/memberRowSort'
import type { GioiTinh, NgayThang, Person } from '../types/giapha'

export type StringRowField =
  | 'id' | 'hoTen' | 'gioiTinh' | 'laThanhVienHo' | 'thuTuDoi' | 'thuTuAnhChi'
  | 'boId' | 'meId' | 'voChongIds'
  | 'queQuan' | 'tieuSu' | 'email' | 'soDienThoai' | 'ghiChu'

export type DateRowField = 'namSinh' | 'namMat'

export type RowField = StringRowField | DateRowField

export interface EditableRow extends Record<StringRowField, string> {
  _key: string
  namSinh: NgayThang | undefined
  namMat: NgayThang | undefined
}

type PickerField = 'boId' | 'meId' | 'voChongIds'
interface PickerState { rowIndex: number; field: PickerField }

const COLUMNS: Array<{ key: RowField; label: string }> = [
  { key: 'id', label: 'ID' },
  { key: 'hoTen', label: 'Họ tên' },
  { key: 'thuTuDoi', label: 'Đời' },
  { key: 'gioiTinh', label: 'Giới tính' },
  { key: 'laThanhVienHo', label: 'Dâu/Rể' },
  { key: 'thuTuAnhChi', label: 'Thứ tự anh/chị' },
  { key: 'namSinh', label: 'Ngày sinh' },
  { key: 'namMat', label: 'Ngày mất' },
  { key: 'boId', label: 'Bố' },
  { key: 'meId', label: 'Mẹ' },
  { key: 'voChongIds', label: 'Vợ/chồng' },
  { key: 'queQuan', label: 'Địa chỉ' },
  { key: 'tieuSu', label: 'Tiểu sử' },
  { key: 'email', label: 'Email' },
  { key: 'soDienThoai', label: 'SĐT' },
]

const DEFAULT_COLUMN_WIDTHS: Partial<Record<RowField, number>> = {
  id: 220,
  hoTen: 160,
  gioiTinh: 120,
  laThanhVienHo: 100,
  thuTuDoi: 90,
  thuTuAnhChi: 130,
  namSinh: 200,
  namMat: 200,
  boId: 200,
  meId: 200,
  voChongIds: 240,
  queQuan: 150,
  tieuSu: 180,
  email: 170,
  soDienThoai: 120,
  ghiChu: 360,
}

const FALLBACK_COLUMN_WIDTH = 120

// The 'id' column is intentionally excluded from what's rendered in the GUI (the raw
// UUID isn't useful to end users), but stays in COLUMNS/RowField/EditableRow so all
// non-display logic (diffing, sort-by-id, import/export, cell lookups by key) is
// completely unaffected — this is a display-only change.
const VISIBLE_COLUMNS = COLUMNS.filter(col => col.key !== 'id')

function createEmptyRow(): EditableRow {
  return {
    _key: `new-${crypto.randomUUID()}`,
    id: '',
    hoTen: '',
    gioiTinh: 'nam',
    laThanhVienHo: 'true',
    thuTuDoi: '',
    thuTuAnhChi: '',
    namSinh: undefined,
    namMat: undefined,
    boId: '',
    meId: '',
    voChongIds: '',
    queQuan: '',
    tieuSu: '',
    email: '',
    soDienThoai: '',
    ghiChu: '',
  }
}

function rowToPersonPayload(row: EditableRow): Omit<Person, 'id'> {
  return {
    hoTen: row.hoTen.trim(),
    gioiTinh: row.gioiTinh as GioiTinh,
    email: row.email.trim() || undefined,
    soDienThoai: row.soDienThoai.trim() || undefined,
    namSinh: row.namSinh,
    namMat: row.namMat,
    queQuan: row.queQuan || undefined,
    tieuSu: row.tieuSu || undefined,
    laThanhVienHo: row.laThanhVienHo === 'true',
    thuTuDoi: row.thuTuDoi.trim() ? Number(row.thuTuDoi) : undefined,
    thuTuAnhChi: row.thuTuAnhChi ? Number(row.thuTuAnhChi) : undefined,
    boId: row.boId.trim() || undefined,
    meId: row.meId.trim() || undefined,
    honNhan: row.voChongIds.split(';').map(s => s.trim()).filter(Boolean).map(voChongId => ({ voChongId })),
    conCaiIds: [],
    ghiChu: row.ghiChu || undefined,
  }
}

export default function MemberManagementView() {
  const { data, loadData } = useGiaphaStore()
  const { user } = useAuthStore()
  const [rows, setRows] = useState<EditableRow[]>(() => {
    if (!data) return []
    return Object.values(data.persons).map(personToRow)
  })
  const [errorMessages, setErrorMessages] = useState<string[]>([])
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [picker, setPicker] = useState<PickerState | null>(null)
  const [autoComputeWarnings, setAutoComputeWarnings] = useState<string[]>([])
  const [sortState, setSortState] = useState<SortState>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const originalIds = useMemo(() => new Set(data ? Object.keys(data.persons) : []), [data])
  const rowDirtyInfo = useMemo(() => rows.map(row => {
    if (!data || isNewRow(row, originalIds)) return { isNew: true, changedFields: new Set<RowField>() }
    const original = personToRow(data.persons[row.id.trim()])
    return { isNew: false, changedFields: new Set(getChangedFields(row, original)) }
  }), [rows, data, originalIds])

  function getName(id: string) {
    return data?.persons[id]?.hoTen || ''
  }

  const displayRows = useMemo(
    () => sortRowsForDisplay(rows, sortState, getName),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getName is redefined each render but only reads `data`, already a dependency
    [rows, sortState, data],
  )

  const matchedRowKey = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return null
    const match = displayRows.find(({ row }) => row.hoTen.toLowerCase().includes(query))
    return match?.row._key ?? null
  }, [searchQuery, displayRows])

  useEffect(() => {
    if (!matchedRowKey) return
    const container = scrollContainerRef.current
    const rowEl = container?.querySelector<HTMLElement>(`[data-row-key="${matchedRowKey}"]`)
    if (!container || !rowEl) return
    // thead is sticky top-0 inside the scroll container; offset by its height so the
    // matched row lands as the first fully-visible data row, not hidden underneath it.
    const headerHeight = container.querySelector('thead')?.getBoundingClientRect().height ?? 0
    container.scrollTop = rowEl.offsetTop - headerHeight
  }, [matchedRowKey])

  function handleHeaderSortClick(field: RowField) {
    if (!SORTABLE_FIELDS.has(field)) return
    setSortState(prev => {
      if (!prev || prev.field !== field) return { field, direction: 'asc' }
      if (prev.direction === 'asc') return { field, direction: 'desc' }
      return null
    })
  }

  if (!data) return <div className="p-4 text-gray-400">Chưa có dữ liệu</div>

  function handleCellChange(index: number, field: RowField, value: string) {
    setRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row))
    setErrorMessages([])
    setSaveMessage(null)
    setAutoComputeWarnings([])
  }

  function handleDateChange(index: number, field: DateRowField, value: NgayThang | undefined) {
    setRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row))
    setErrorMessages([])
    setSaveMessage(null)
    setAutoComputeWarnings([])
  }

  function handleAddRow() {
    setRows(prev => [createEmptyRow(), ...prev])
    setErrorMessages([])
    setSaveMessage(null)
    setAutoComputeWarnings([])
  }

  function handleResetRows() {
    if (!data) return
    setRows(Object.values(data.persons).map(personToRow))
    setErrorMessages([])
    setSaveMessage(null)
    setAutoComputeWarnings([])
  }

  function handleDeleteRow(index: number) {
    setRows(prev => prev.filter((_, i) => i !== index))
    setErrorMessages([])
    setSaveMessage(null)
    setAutoComputeWarnings([])
  }

  function handleAutoCompute() {
    if (!data) return
    const originalById = new Map(Object.entries(data.persons).map(([id, p]) => [id, personToRow(p)] as const))
    const doiResult = computeThuTuDoi(rows)
    const anhChiResult = computeThuTuAnhChi(doiResult.updatedRows, originalById)

    setRows(anhChiResult.updatedRows)
    setErrorMessages([])
    setAutoComputeWarnings([...doiResult.warnings, ...anhChiResult.warnings])
    setSaveMessage(
      doiResult.changedCount > 0 || anhChiResult.changedCount > 0
        ? `Đã tính lại Đời cho ${doiResult.changedCount} thành viên, Thứ tự anh/chị cho ${anhChiResult.changedCount} thành viên. Bấm "Áp dụng thay đổi" để lưu.`
        : 'Không có thay đổi nào cần tính lại.',
    )
  }

  async function handleApplyChanges() {
    if (!data) return
    setSaving(true)
    setErrorMessages([])
    setAutoComputeWarnings([])
    const errors: string[] = []
    const remainingIds = new Set(rows.map(r => r.id.trim()).filter(Boolean))
    const deletedIds = [...originalIds].filter(id => !remainingIds.has(id))

    let deletedDirect = 0
    let deletedPending = 0
    for (const id of deletedIds) {
      try {
        const result = await api.deletePerson(id)
        if (result?.pending) deletedPending++
        else deletedDirect++
      } catch (e) {
        errors.push(`Xóa ${id}: ${(e as Error).message}`)
      }
    }

    let savedDirect = 0
    let savedPending = 0
    let skippedCount = 0
    for (const row of rows) {
      if (!row.hoTen.trim()) continue
      if (row.thuTuDoi.trim() && !Number.isInteger(Number(row.thuTuDoi))) {
        errors.push(`${row.hoTen || row._key}: Đời phải là số`)
        continue
      }
      const payload = rowToPersonPayload(row)
      const trimmedId = row.id.trim()
      try {
        let result: { pending?: boolean }
        if (!isNewRow(row, originalIds)) {
          const changed = getChangedFields(row, personToRow(data.persons[trimmedId]))
          if (changed.length === 0) {
            skippedCount++
            continue
          }
          result = await api.updatePerson(trimmedId, payload)
        } else {
          result = await api.createPerson(payload)
        }
        if (result?.pending) savedPending++
        else savedDirect++
      } catch (e) {
        errors.push(`${row.hoTen || row._key}: ${(e as Error).message}`)
      }
    }

    await loadData()
    setSaving(false)
    if (errors.length > 0) {
      setErrorMessages(errors)
      setSaveMessage(null)
      return
    }
    setErrorMessages([])

    const totalPending = savedPending + deletedPending
    const totalDirect = savedDirect + deletedDirect
    if (totalPending > 0 && user?.role === 'editor') {
      const directPart = totalDirect > 0 ? `Đã cập nhật ${totalDirect} thành viên. ` : ''
      setSaveMessage(`${directPart}Đã gửi ${totalPending} thay đổi để chờ admin duyệt. Bỏ qua ${skippedCount} không đổi.`)
    } else {
      setSaveMessage(`Đã cập nhật ${totalDirect} thành viên, bỏ qua ${skippedCount} không đổi.`)
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-2 shrink-0">
        <h2 className="text-base font-semibold text-gray-800">Quản lý thành viên</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm theo họ tên..."
            aria-label="Tìm theo họ tên"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md w-48"
          />
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
            onClick={handleAutoCompute}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
          >
            Tự động cập nhật
          </button>
          <button
            onClick={handleApplyChanges}
            disabled={saving}
            className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Áp dụng thay đổi'}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 border border-gray-200 rounded-lg overflow-hidden">
        <div
          ref={scrollContainerRef}
          data-testid="member-table-scroll"
          className="h-full overflow-auto"
        >
        <table className="min-w-[2400px] w-full text-xs">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {VISIBLE_COLUMNS.map(col => {
                const isSortable = SORTABLE_FIELDS.has(col.key)
                const isActive = sortState?.field === col.key
                const ariaSort = isActive ? (sortState!.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                return (
                <th
                  key={col.key}
                  aria-sort={isSortable ? ariaSort : undefined}
                  role={isSortable ? 'button' : undefined}
                  tabIndex={isSortable ? 0 : undefined}
                  onClick={isSortable ? () => handleHeaderSortClick(col.key) : undefined}
                  onKeyDown={isSortable ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleHeaderSortClick(col.key)
                    }
                  } : undefined}
                  data-testid={`sort-header-${col.key}`}
                  className={`px-2 py-2 text-left font-semibold text-gray-600 border-b border-r last:border-r-0${isSortable ? ' cursor-pointer select-none hover:bg-gray-100' : ''}`}
                  style={{
                    width: `${DEFAULT_COLUMN_WIDTHS[col.key] ?? FALLBACK_COLUMN_WIDTH}px`,
                    minWidth: `${DEFAULT_COLUMN_WIDTHS[col.key] ?? FALLBACK_COLUMN_WIDTH}px`,
                  }}
                >
                  <span>
                    {col.label}
                    {isActive && (sortState!.direction === 'asc' ? ' \u25B2' : ' \u25BC')}
                  </span>
                </th>
                )
              })}
              <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b">Xóa</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map(({ row, originalIndex: rowIndex }) => {
              const dirty = rowDirtyInfo[rowIndex]
              return (
              <tr
                key={row._key}
                data-row-key={row._key}
                className={`hover:bg-blue-50/30${dirty.isNew ? ' bg-emerald-50/60' : ''}`}
              >
                {VISIBLE_COLUMNS.map(col => {
                  const isDirtyCell = !dirty.isNew && dirty.changedFields.has(col.key)
                  return (
                  <td
                    key={col.key}
                    data-dirty={isDirtyCell ? 'true' : undefined}
                    className={`px-1 py-1 border-b border-r last:border-r-0${isDirtyCell ? ' bg-amber-50 ring-1 ring-inset ring-amber-300' : ''}`}
                    style={{
                      width: `${DEFAULT_COLUMN_WIDTHS[col.key] ?? FALLBACK_COLUMN_WIDTH}px`,
                      minWidth: `${DEFAULT_COLUMN_WIDTHS[col.key] ?? FALLBACK_COLUMN_WIDTH}px`,
                    }}
                  >
                    {col.key === 'gioiTinh' ? (
                      <select
                        value={row.gioiTinh}
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
                          checked={row.laThanhVienHo === 'false'}
                          onChange={e => handleCellChange(rowIndex, col.key, String(!e.target.checked))}
                          aria-label={`Dâu/Rể dòng ${rowIndex + 1}`}
                          data-testid={`${col.key}-${rowIndex}`}
                          className="h-4 w-4"
                        />
                      </div>
                    ) : col.key === 'id' ? (
                      <input
                        value={row[col.key]}
                        disabled
                        data-testid={`${col.key}-${rowIndex}`}
                        className="w-full px-2 py-1 border rounded bg-gray-50 text-gray-400"
                      />
                    ) : col.key === 'boId' || col.key === 'meId' ? (
                      <div className="flex items-center gap-1">
                        <span
                          data-testid={`${col.key}-${rowIndex}`}
                          className="flex-1 truncate text-gray-700"
                        >
                          {row[col.key] ? getName(row[col.key]) || row[col.key] : <span className="text-gray-400">Chưa chọn</span>}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPicker({ rowIndex, field: col.key as PickerField })}
                          aria-label={`Chọn ${col.key === 'boId' ? 'bố' : 'mẹ'} dòng ${rowIndex + 1}`}
                          className="shrink-0 rounded px-1.5 py-0.5 text-blue-600 hover:bg-blue-50"
                        >
                          {row[col.key] ? 'Đổi' : 'Chọn'}
                        </button>
                        {row[col.key] && (
                          <button
                            type="button"
                            onClick={() => handleCellChange(rowIndex, col.key, '')}
                            aria-label={`Bỏ ${col.key === 'boId' ? 'bố' : 'mẹ'} dòng ${rowIndex + 1}`}
                            className="shrink-0 rounded px-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ) : col.key === 'voChongIds' ? (
                      <div className="flex flex-wrap items-center gap-1" data-testid={`${col.key}-${rowIndex}`}>
                        {row.voChongIds.split(';').map(s => s.trim()).filter(Boolean).map(spouseId => (
                          <span
                            key={spouseId}
                            className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-gray-700"
                          >
                            {getName(spouseId) || spouseId}
                            <button
                              type="button"
                              onClick={() => {
                                const remaining = row.voChongIds.split(';').map(s => s.trim()).filter(Boolean).filter(id => id !== spouseId)
                                handleCellChange(rowIndex, 'voChongIds', remaining.join(';'))
                              }}
                              aria-label={`Bỏ vợ/chồng ${getName(spouseId) || spouseId} dòng ${rowIndex + 1}`}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPicker({ rowIndex, field: 'voChongIds' })}
                          aria-label={`Thêm vợ/chồng dòng ${rowIndex + 1}`}
                          className="shrink-0 rounded px-1.5 py-0.5 text-blue-600 hover:bg-blue-50"
                        >
                          + Thêm
                        </button>
                      </div>
                    ) : col.key === 'namSinh' || col.key === 'namMat' ? (
                      <NgayThangInput
                        value={row[col.key]}
                        onChange={v => handleDateChange(rowIndex, col.key as DateRowField, v)}
                        testIdPrefix={`${col.key}-${rowIndex}`}
                      />
                    ) : (
                      <input
                        value={row[col.key]}
                        onChange={e => handleCellChange(rowIndex, col.key, e.target.value)}
                        data-testid={`${col.key}-${rowIndex}`}
                        className="w-full px-2 py-1 border rounded"
                      />
                    )}
                  </td>
                  )
                })}
                <td className="px-2 py-1 border-b text-center">
                  <button
                    type="button"
                    onClick={() => handleDeleteRow(rowIndex)}
                    aria-label={`Xóa thành viên dòng ${rowIndex + 1}`}
                    className="inline-flex items-center rounded px-1.5 py-1 text-red-600 hover:bg-red-50"
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
                  </button>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      <div className="shrink-0 max-h-[30vh] overflow-y-auto">
        <p className="mt-2 text-xs text-gray-500">
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-50 ring-1 ring-inset ring-emerald-300 align-middle" /> Dòng mới ·{' '}
          <span className="inline-block h-3 w-3 rounded-sm bg-amber-50 ring-1 ring-inset ring-amber-300 align-middle" /> Trường đã sửa, chưa lưu
        </p>

        {saveMessage && <p className="mt-3 text-sm text-green-700">{saveMessage}</p>}
        {errorMessages.length > 0 && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-700 mb-1">Không thể áp dụng một số thay đổi:</p>
            <ul className="text-xs text-red-700 list-disc pl-5 space-y-1">
              {errorMessages.slice(0, 10).map((msg, idx) => <li key={idx}>{msg}</li>)}
            </ul>
          </div>
        )}
        {autoComputeWarnings.length > 0 && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-800 mb-1">Một số thành viên không thể tính tự động:</p>
            <ul className="text-xs text-amber-800 list-disc pl-5 space-y-1">
              {autoComputeWarnings.slice(0, 10).map((msg, idx) => <li key={idx}>{msg}</li>)}
            </ul>
          </div>
        )}
      </div>

      {picker && (() => {
        const row = rows[picker.rowIndex]
        if (!row) return null
        const currentSpouseIds = row.voChongIds.split(';').map(s => s.trim()).filter(Boolean)
        const title = picker.field === 'boId' ? 'Chọn bố' : picker.field === 'meId' ? 'Chọn mẹ' : 'Chọn vợ/chồng'
        const excludeIds =
          picker.field === 'boId' ? [row.id, ...(row.meId ? [row.meId] : [])]
          : picker.field === 'meId' ? [row.id, ...(row.boId ? [row.boId] : [])]
          : [row.id, ...currentSpouseIds]
        return (
          <PersonPicker
            title={title}
            excludeIds={excludeIds}
            onSelect={(person: Person) => {
              if (picker.field === 'voChongIds') {
                handleCellChange(picker.rowIndex, 'voChongIds', [...currentSpouseIds, person.id].join(';'))
              } else {
                handleCellChange(picker.rowIndex, picker.field, person.id)
              }
              setPicker(null)
            }}
            onClose={() => setPicker(null)}
          />
        )
      })()}
    </div>
  )
}
