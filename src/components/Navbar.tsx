import { useEffect, useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import SearchBar from './SearchBar'
import CsvImportModal from './CsvImportModal'
import { exportCsv } from '../services/api'
import { useIsMobile } from '../utils/useIsMobile'

export default function Navbar() {
  const { data, viewMode, setViewMode, hienThiThuTuDoi, toggleGenerationOrder } = useGiaphaStore()
  const isMobile = useIsMobile()
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const selectableViewMode = viewMode === 'list' || viewMode === 'tree' ? viewMode : ''

  async function handleExportCsv() {
    const blob = await exportCsv()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `gia-pha-export-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
    <nav className="relative bg-card border-b border-card-border flex flex-col">
      <div className="px-4 py-2 flex items-center gap-4">
        <button
          type="button"
          aria-label="Mở menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(v => !v)}
          className="px-2 py-1.5 text-lg leading-none text-muted rounded-md border border-card-border hover:bg-slate-50"
        >
          ☰
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-ink whitespace-nowrap">
            {data?.metadata.tenDongHo || 'Gia phả họ Hoàng'}
          </h1>
        </div>

        {!isMobile && <SearchBar />}
      </div>

      {isMobile && (
        <div data-testid="navbar-search-row-mobile" className="px-4 pb-2">
          <SearchBar />
        </div>
      )}

      {menuOpen && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-30"
          />
          <div className="absolute top-full left-4 mt-2 z-40 w-72 bg-card border border-card-border rounded-lg shadow-lg p-3 space-y-2">
            <div>
              <label htmlFor="navbar-view-mode" className="block text-xs text-muted mb-1">Chế độ xem</label>
              <select
                id="navbar-view-mode"
                aria-label="Chế độ xem"
                value={selectableViewMode}
                onChange={e => setViewMode(e.target.value as 'tree' | 'list')}
                className="w-full px-2 py-1.5 text-sm border border-card-border rounded-md bg-card"
              >
                <option value="" disabled>
                  {viewMode === 'members' ? 'Quản lý thành viên' : 'Chế độ xem'}
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
              className="w-full px-3 py-1.5 text-sm rounded-md border border-card-border hover:bg-slate-50 text-left"
            >
              Quản lý thành viên
            </button>
            <button
              onClick={() => {
                setCsvModalOpen(true)
                setMenuOpen(false)
              }}
              className="w-full px-3 py-1.5 text-sm rounded-md border border-card-border hover:bg-slate-50 text-left"
            >
              Nhập CSV
            </button>
            <button
              onClick={() => {
                handleExportCsv()
                setMenuOpen(false)
              }}
              className="w-full px-3 py-1.5 text-sm rounded-md border border-card-border hover:bg-slate-50 text-left"
            >
              Xuất CSV
            </button>
            <button
              onClick={() => {
                toggleGenerationOrder()
                setMenuOpen(false)
              }}
              className="w-full px-3 py-1.5 text-sm rounded-md border border-card-border hover:bg-slate-50 text-left"
            >
              Thứ tự đời: {hienThiThuTuDoi ? 'Bật' : 'Tắt'}
            </button>
          </div>
        </>
      )}
    </nav>

    {csvModalOpen && <CsvImportModal onClose={() => setCsvModalOpen(false)} />}
    </>
  )
}
