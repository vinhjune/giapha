import { useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import SearchBar from './SearchBar'
import CsvImportModal from './CsvImportModal'
import { chiaSeCong, docFileCong, ghiFile, xoaChiaSeCong } from '../services/googleDrive'
import { exportGiaphaToCSV, downloadCsv } from '../utils/csvExport'

export default function Navbar() {
  const { data, fileId, isDirty, isSaving, currentRole, currentUserEmail, viewMode, setViewMode, setData, setIsSaving, markSaved, setConflictDetected } = useGiaphaStore()
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [togglingPublic, setTogglingPublic] = useState(false)
  const [togglingGenerationOrder, setTogglingGenerationOrder] = useState(false)

  async function handleSave() {
    if (!data || !fileId) return
    setIsSaving(true)
    try {
      await ghiFile(fileId, data)
      markSaved()
    } catch (e: unknown) {
      const err = e as Error
      if (err.message.includes('412') || err.message.includes('conflict')) {
        setConflictDetected(true)
      } else {
        alert('Lưu thất bại: ' + err.message)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const canEdit = currentRole === 'admin' || currentRole === 'editor'
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY
  const isPublic = Boolean(data?.metadata.cheDoCong)
  const showGenerationOrder = Boolean(data?.metadata.hienThiThuTuDoi)
  const selectableViewMode = viewMode === 'list' || viewMode === 'tree' ? viewMode : ''

  function handleExportCsv() {
    if (!data) return
    const csv = exportGiaphaToCSV(data)
    const tenDongHo = data.metadata.tenDongHo.replace(/\s+/g, '_')
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(`giaphaHo${tenDongHo}_${date}.csv`, csv)
  }

  async function handleTogglePublic() {
    if (!data || !fileId) return
    setTogglingPublic(true)
    try {
      if (isPublic) {
        const inherited = await xoaChiaSeCong(fileId)
        if (inherited) {
          alert(
            'Quyền công khai được thừa kế từ thư mục cha — không thể tắt qua API. ' +
            'Hãy vào Google Drive và tắt chia sẻ cho thư mục giapha thủ công.'
          )
        }
      } else {
        await chiaSeCong(fileId)
        if (apiKey) {
          try {
            await docFileCong(fileId, apiKey)
          } catch (e: unknown) {
            const msg = (e as Error).message
            alert(
              `Đã chia sẻ Drive nhưng đọc bằng API key thất bại:\n${msg}\n\n` +
              'Kiểm tra Drive API và giới hạn API key.'
            )
          }
        }
      }

      const updated = {
        ...data,
        metadata: { ...data.metadata, cheDoCong: !isPublic },
      }
      await ghiFile(fileId, updated)
      setData(updated)
    } catch (e: unknown) {
      alert('Lỗi: ' + (e as Error).message)
    } finally {
      setTogglingPublic(false)
    }
  }

  async function handleToggleGenerationOrder() {
    if (!data || !fileId) return
    setTogglingGenerationOrder(true)
    try {
      const updated = {
        ...data,
        metadata: { ...data.metadata, hienThiThuTuDoi: !showGenerationOrder },
      }
      await ghiFile(fileId, updated)
      setData(updated)
    } catch (e: unknown) {
      alert('Lỗi: ' + (e as Error).message)
    } finally {
      setTogglingGenerationOrder(false)
    }
  }

  return (
    <>
    <nav className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-lg font-bold text-red-700 mr-2 whitespace-nowrap">
          {data?.metadata.tenDongHo || 'Gia Phả'}
        </h1>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span className="text-gray-300">/</span>
          <select
            aria-label="Chế độ xem"
            value={selectableViewMode}
            onChange={e => setViewMode(e.target.value as 'tree' | 'list')}
            className="px-2 py-1 border border-gray-300 rounded-md bg-white"
          >
            <option value="" disabled>
              {viewMode === 'members'
                ? 'Quản lý thành viên'
                : viewMode === 'permissions'
                  ? 'Quản lý quyền truy cập'
                  : 'Chế độ xem'}
            </option>
            <option value="tree">Cây</option>
            <option value="list">Danh sách</option>
          </select>

          <span className="text-gray-300">/</span>
          <button
            onClick={() => setViewMode('members')}
            className={`px-2 py-1 rounded-md border ${viewMode === 'members' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 hover:bg-gray-50'}`}
          >
            Quản lý thành viên
          </button>

          {currentRole === 'admin' && (
            <>
              <span className="text-gray-300">/</span>
              <button
                onClick={() => setViewMode('permissions')}
                className={`px-2 py-1 rounded-md border ${viewMode === 'permissions' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 hover:bg-gray-50'}`}
              >
                Quản lý quyền truy cập
              </button>
            </>
          )}
        </div>
      </div>

      <SearchBar />

      <div className="ml-auto flex items-center gap-3">
        {currentRole === 'admin' && (
          <>
            <button
              onClick={() => setCsvModalOpen(true)}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Nhập CSV
            </button>
            <button
              onClick={handleTogglePublic}
              disabled={togglingPublic}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              Chế độ công khai: {isPublic ? 'Bật' : 'Tắt'}
            </button>
            <button
              onClick={handleToggleGenerationOrder}
              disabled={togglingGenerationOrder}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              Thứ tự đời: {showGenerationOrder ? 'Bật' : 'Tắt'}
            </button>
          </>
        )}
        {canEdit && data && (
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
          >
            Xuất CSV
          </button>
        )}
        {canEdit && isDirty && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu'}
          </button>
        )}
        {currentUserEmail && (
          <span className="text-sm text-gray-600">{currentUserEmail}</span>
        )}
      </div>
    </nav>

    {csvModalOpen && <CsvImportModal onClose={() => setCsvModalOpen(false)} />}
    </>
  )
}
