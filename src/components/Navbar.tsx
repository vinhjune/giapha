import { useEffect, useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import SearchBar from './SearchBar'
import CsvImportModal from './CsvImportModal'
import { chiaSeCong, docFileCong, ghiFile, xoaChiaSeCong } from '../services/googleDrive'
import { exportGiaphaToCSV, downloadCsv } from '../utils/csvExport'
import { dangXuat } from '../services/googleAuth'
import { dangXuatZalo } from '../services/zaloAuth'

export default function Navbar() {
  const { data, fileId, isDirty, isSaving, currentRole, currentUserEmail, loginType, viewMode, setViewMode, setData, setIsSaving, markSaved, setConflictDetected, logout } = useGiaphaStore()
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
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

  function handleLogout() {
    if (loginType === 'zalo') {
      dangXuatZalo()
    } else {
      dangXuat()
    }
    logout()
  }

  function handleExportCsv() {
    if (!data) return
    const csv = exportGiaphaToCSV(data)
    const tenDongHo = data.metadata.tenDongHo.replace(/\s+/g, '_')
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(`giaphaHo${tenDongHo}_${date}.csv`, csv)
  }

  async function handleTogglePublic() {
    if (!data || !fileId) return false
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
      return true
    } catch (e: unknown) {
      alert('Lỗi: ' + (e as Error).message)
      return false
    } finally {
      setTogglingPublic(false)
    }
  }

  async function handleToggleGenerationOrder() {
    if (!data || !fileId) return false
    setTogglingGenerationOrder(true)
    try {
      const updated = {
        ...data,
        metadata: { ...data.metadata, hienThiThuTuDoi: !showGenerationOrder },
      }
      await ghiFile(fileId, updated)
      setData(updated)
      return true
    } catch (e: unknown) {
      alert('Lỗi: ' + (e as Error).message)
      return false
    } finally {
      setTogglingGenerationOrder(false)
    }
  }

  useEffect(() => {
    if (!menuOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return (
    <>
    <nav className="relative bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4">
      <button
        type="button"
        aria-label="Mở menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(v => !v)}
        className="px-2 py-1.5 text-lg leading-none rounded-md border border-gray-300 hover:bg-gray-50"
      >
        ☰
      </button>
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-red-700 whitespace-nowrap">
          {data?.metadata.tenDongHo || 'Gia Phả'}
        </h1>
      </div>

      <SearchBar />

      <div className="ml-auto flex items-center gap-3">
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
          <span className="text-sm text-gray-600 hidden sm:inline">{currentUserEmail}</span>
        )}
        {currentRole !== 'public' && (
          <button
            onClick={handleLogout}
            title="Đăng xuất"
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Đăng xuất
          </button>
        )}
      </div>

      {menuOpen && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-30"
          />
          <div className="absolute top-full left-4 mt-2 z-40 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-2">
            <div>
              <label htmlFor="navbar-view-mode" className="block text-xs text-gray-500 mb-1">Chế độ xem</label>
              <select
                id="navbar-view-mode"
                aria-label="Chế độ xem"
                value={selectableViewMode}
                onChange={e => setViewMode(e.target.value as 'tree' | 'list')}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
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
            </div>
            <button
              onClick={() => {
                setViewMode('members')
                setMenuOpen(false)
              }}
              className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 text-left"
            >
              Quản lý thành viên
            </button>
            {currentRole === 'admin' && (
              <button
                onClick={() => {
                  setViewMode('permissions')
                  setMenuOpen(false)
                }}
                className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 text-left"
              >
                Quản lý quyền truy cập
              </button>
            )}
            {currentRole === 'admin' && (
              <button
                onClick={() => {
                  setCsvModalOpen(true)
                  setMenuOpen(false)
                }}
                className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 text-left"
              >
                Nhập CSV
              </button>
            )}
            {canEdit && data && (
              <button
                onClick={() => {
                  handleExportCsv()
                  setMenuOpen(false)
                }}
                className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 text-left"
              >
                Xuất CSV
              </button>
            )}
            {currentRole === 'admin' && (
              <>
                <button
                  onClick={async () => {
                    const ok = await handleTogglePublic()
                    if (ok) setMenuOpen(false)
                  }}
                  disabled={togglingPublic}
                  className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-left"
                >
                  Chế độ công khai: {isPublic ? 'Bật' : 'Tắt'}
                </button>
                <button
                  onClick={async () => {
                    const ok = await handleToggleGenerationOrder()
                    if (ok) setMenuOpen(false)
                  }}
                  disabled={togglingGenerationOrder}
                  className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-left"
                >
                  Thứ tự đời: {showGenerationOrder ? 'Bật' : 'Tắt'}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </nav>

    {csvModalOpen && <CsvImportModal onClose={() => setCsvModalOpen(false)} />}
    </>
  )
}
